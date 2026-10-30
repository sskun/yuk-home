// 图片治理工具客户端入口（v5 改版）
// 布局：上传区(空态) → 工作区(左:图片预览 + 右:控件面板) → 结果区（原图 / 结果对比滑块）
// 页头由 Astro 页面渲染；样式在 src/styles/image-tool.css；处理完成的提示用 Starwind Toast。
// 算法（lib/image-tools）、选区交互（crop-interaction）与 Worker（image-worker）沿用原实现。

import { calcCoverRect, type Rect } from '../../lib/image-tools/crop';
import { compressToTarget, type EncodeResult } from '../../lib/image-tools/compress';
import { formatBytes, ratioPercent, inferExt, buildOutputName } from '../../lib/image-tools/format';
import { ICON } from './icons';
import { attachCropInteraction, paintOverlay } from './crop-interaction';
import { toast } from '@/components/starwind/toast';

type Tab = 'crop' | 'compress';

interface State {
  file: File | null;
  bitmap: ImageBitmap | null;
  srcWidth: number;
  srcHeight: number;
  tab: Tab;
  // crop
  cropW: number;
  cropH: number;
  cropLock: boolean;
  /** 锁定时记录的宽高比（宽 / 高），用于输入框联动 */
  lockRatio: number;
  cropRect: Rect | null;
  cropResult: { blob: Blob; w: number; h: number } | null;
  // compress
  targetKB: number;
  quality: number;
  compressResult: EncodeResult | null;
  busy: boolean;
  errors: string[];
  urlsToRevoke: string[];
}

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 50_000_000;
const ACCEPT_RE = /^image\/(jpeg|png|webp)$/;

/** 裁剪比例预设；ratio 为 0 表示「原图比例」 */
const CROP_PRESETS: { label: string; ratio: number }[] = [
  { label: '原图', ratio: 0 },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '9:16', ratio: 9 / 16 },
];
/** 压缩目标体积预设（KB） */
const SIZE_PRESETS = [50, 100, 200, 500, 1024];

// ---- 工具函数 ----

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | null | undefined> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'style') node.style.cssText = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    // for / tabindex 不是同名 DOM 属性（对应 htmlFor / tabIndex），按 attribute 设置，
    // 否则 <label for> 不会关联到输入框
    else if (k.startsWith('aria-') || k === 'role' || k === 'for' || k === 'tabindex') node.setAttribute(k, String(v));
    else if (k.startsWith('data-')) node.setAttribute(k, String(v));
    else (node as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children) {
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function trackedURL(state: State, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  state.urlsToRevoke.push(url);
  return url;
}

function revokeAllURLs(state: State): void {
  for (const u of state.urlsToRevoke) URL.revokeObjectURL(u);
  state.urlsToRevoke = [];
}

function truncate(name: string, max: number): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  if (dot > 0 && name.length - dot <= 6) {
    const ext = name.slice(dot);
    return `${name.slice(0, Math.max(1, max - ext.length - 1))}…${ext}`;
  }
  return `${name.slice(0, max - 1)}…`;
}

function formatRatio(w: number, h: number): string {
  if (!w || !h) return '—';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(w, h) || 1;
  const rw = w / g;
  const rh = h / g;
  return rw <= 100 && rh <= 100 ? `${rw}:${rh}` : (w / h).toFixed(2);
}

// ---- 入口 ----

/** 挂载工具，返回清理函数（页面切换时释放位图、blob URL 和全局监听） */
export function mountImageGovernance(root: HTMLElement): () => void {
  const state: State = {
    file: null, bitmap: null,
    srcWidth: 0, srcHeight: 0,
    tab: 'crop',
    cropW: 800, cropH: 600, cropLock: false, lockRatio: 4 / 3,
    cropRect: null, cropResult: null,
    targetKB: 200, quality: 75,
    compressResult: null,
    busy: false, errors: [],
    urlsToRevoke: [],
  };
  root.innerHTML = '';
  root.appendChild(buildView(root, state));

  // 支持直接粘贴图片（截图后 Ctrl/⌘+V），输入框聚焦时不拦截
  const ac = new AbortController();
  document.addEventListener('paste', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (!file || state.busy) return;
    e.preventDefault();
    void handleFile(file, root, state);
  }, { signal: ac.signal });
  return () => {
    ac.abort();
    state.bitmap?.close();
    revokeAllURLs(state);
  };
}

// ============================================================
// 视图构建：一次性组装整棵树，后续通过 refresh* 局部刷新
// ============================================================

function buildView(root: HTMLElement, state: State): HTMLElement {
  const view = el('div', { class: 'ig-view' });

  // 错误横幅
  const errorSlot = el('div', { class: 'ig-error-slot', role: 'alert', 'aria-live': 'polite' });
  view.appendChild(errorSlot);

  // 上传区（空态）
  view.appendChild(buildDropZone(root, state));

  // 工作区（有文件后显示）
  view.appendChild(buildWorkspace(root, state));

  // 结果区
  view.appendChild(buildResult(root, state));

  return view;
}

// ---- 上传区 ----

function buildDropZone(root: HTMLElement, state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-empty' });
  wrap.hidden = !!state.file;

  const label = el('label', { class: 'ig-drop', for: 'ig-file-input' });
  const fileInput = el('input', {
    type: 'file', id: 'ig-file-input',
    accept: 'image/jpeg,image/png,image/webp',
    class: 'ig-file-input',
  }) as HTMLInputElement;

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) void handleFile(f, root, state);
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    label.addEventListener(ev, (e) => { e.preventDefault(); label.classList.add('drag'); }),
  );
  ['dragleave', 'drop'].forEach((ev) =>
    label.addEventListener(ev, (e) => { e.preventDefault(); label.classList.remove('drag'); }),
  );
  label.addEventListener('drop', (e) => {
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (f) void handleFile(f, root, state);
  });

  label.appendChild(fileInput);
  label.appendChild(el('span', { class: 'ig-drop-icon', html: ICON.folder }));
  label.appendChild(el('span', { class: 'ig-drop-title' }, ['拖拽图片到这里']));
  label.appendChild(el('span', { class: 'ig-drop-hint' }, ['或点击选择，也可以直接 Ctrl / ⌘ + V 粘贴截图']));
  label.appendChild(
    el('div', { class: 'ig-drop-chips' }, [
      el('span', { class: 'ig-drop-chip' }, ['JPEG / PNG / WebP']),
      el('span', { class: 'ig-drop-chip' }, ['最大 20 MB']),
      el('span', { class: 'ig-drop-chip' }, ['不上传服务器']),
    ]),
  );
  wrap.appendChild(label);
  return wrap;
}

// ---- 工作区 ----

function buildWorkspace(root: HTMLElement, state: State): HTMLElement {
  const ws = el('div', { class: 'ig-workspace' });
  ws.hidden = !state.file;

  // 左列：图片预览
  const previewCol = el('div', { class: 'ig-preview-col' });
  ws.appendChild(previewCol);

  // 右列：控件面板
  const panel = el('div', { class: 'ig-panel' });
  ws.appendChild(panel);

  // 把刷新钩子挂在 ws 上
  const hooks = ws as unknown as {
    __refreshFileBar: () => void;
    __refreshStage: () => void;
    __refreshPanel: () => void;
    __refresh: () => void;
  };

  hooks.__refreshFileBar = () => {
    const old = previewCol.querySelector('.ig-file-bar');
    const next = buildFileBar(root, state);
    if (old) previewCol.replaceChild(next, old);
    else previewCol.insertBefore(next, previewCol.firstChild);
  };

  hooks.__refreshStage = () => {
    const old = previewCol.querySelector('.ig-stage');
    const next = buildStage(root, state);
    if (old) previewCol.replaceChild(next, old);
    else previewCol.appendChild(next);
  };

  hooks.__refreshPanel = () => {
    panel.innerHTML = '';
    panel.appendChild(buildPanelContent(root, state));
  };

  hooks.__refresh = () => {
    hooks.__refreshFileBar();
    hooks.__refreshStage();
    hooks.__refreshPanel();
  };

  // 初始渲染
  if (state.file) {
    previewCol.appendChild(buildFileBar(root, state));
    previewCol.appendChild(buildStage(root, state));
    panel.appendChild(buildPanelContent(root, state));
  }

  return ws;
}

// 文件信息栏
function buildFileBar(root: HTMLElement, state: State): HTMLElement {
  const bar = el('div', { class: 'ig-file-bar' });
  if (!state.file) return bar;

  const thumbUrl = trackedURL(state, state.file);
  bar.appendChild(el('img', { class: 'ig-file-thumb', src: thumbUrl, alt: '' }));

  const info = el('div', { class: 'ig-file-info' });
  info.appendChild(el('div', { class: 'ig-file-name', title: state.file.name }, [truncate(state.file.name, 32)]));
  info.appendChild(
    el('div', { class: 'ig-file-meta' }, [
      `${state.srcWidth} × ${state.srcHeight}  ·  ${formatBytes(state.file.size)}`,
    ]),
  );
  bar.appendChild(info);

  const replaceBtn = el('button', {
    type: 'button',
    class: 'ig-replace-btn',
    title: '换一张图片',
  }, [
    el('span', { html: ICON.reset }),
    '换一张',
  ]);
  replaceBtn.addEventListener('click', () => reset(root, state));
  bar.appendChild(replaceBtn);

  return bar;
}

// 图片 stage（裁剪 or 压缩预览）
function buildStage(root: HTMLElement, state: State): HTMLElement {
  const stage = el('div', { class: 'ig-stage' });
  if (!state.file || !state.bitmap) return stage;

  const imgUrl = trackedURL(state, state.file);
  const img = el('img', {
    class: 'ig-stage-img',
    src: imgUrl,
    alt: '原图',
  });
  // 画布与图片显示尺寸一致：选区百分比坐标和拖拽换算都基于它，
  // 避免竖图在 object-fit: contain 下出现留白导致选区错位
  const canvas = el('div', { class: 'ig-canvas' });
  canvas.appendChild(img);
  stage.appendChild(canvas);

  if (state.tab === 'crop') {
    // 裁剪 overlay
    const rect = state.cropRect ?? calcCoverRect(state.srcWidth, state.srcHeight, state.cropW, state.cropH, 'cover');
    const pct = {
      left:   (rect.x / state.srcWidth)  * 100,
      top:    (rect.y / state.srcHeight) * 100,
      width:  (rect.w / state.srcWidth)  * 100,
      height: (rect.h / state.srcHeight) * 100,
    };
    const overlay = el('div', {
      class: 'ig-crop-overlay',
      style: `left:${pct.left}%;top:${pct.top}%;width:${pct.width}%;height:${pct.height}%`,
      role: 'region',
      tabindex: 0,
      'aria-label': '裁剪选区：拖动移动，拖动四角或边缘缩放，方向键微调',
    });
    // 三分线，辅助构图
    overlay.appendChild(el('span', { class: 'ig-thirds', 'aria-hidden': 'true' }));
    // 8 个把手
    for (const cls of ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br']) {
      overlay.appendChild(el('span', { class: `ig-handle ${cls}`, 'aria-hidden': 'true' }));
    }
    canvas.appendChild(overlay);

    // 尺寸标签
    stage.appendChild(
      el('div', { class: 'ig-stage-tag' }, [`输出 ${state.cropW} × ${state.cropH}`]),
    );

    attachCropInteraction(canvas, overlay, state, root);
  } else {
    // 压缩模式只显示原图 + 尺寸标签
    stage.appendChild(
      el('div', { class: 'ig-stage-tag' }, [
        `${state.srcWidth} × ${state.srcHeight}  ·  ${formatBytes(state.file.size)}`,
      ]),
    );
  }

  return stage;
}

// 右侧控件面板
function buildPanelContent(root: HTMLElement, state: State): DocumentFragment {
  const frag = document.createDocumentFragment();

  // 源文件信息
  const srcSection = el('div', { class: 'ig-panel-section' });
  srcSection.appendChild(el('p', { class: 'ig-section-title' }, ['源文件']));
  const grid = el('div', { class: 'ig-src-grid' });
  const mime = state.file?.type ?? '';
  const rows: [string, string][] = [
    ['尺寸', state.srcWidth ? `${state.srcWidth} × ${state.srcHeight}` : '—'],
    ['体积', state.file ? formatBytes(state.file.size) : '—'],
    ['格式', mime === 'image/png' ? 'PNG' : mime === 'image/jpeg' ? 'JPEG' : mime === 'image/webp' ? 'WebP' : '—'],
    ['比例', formatRatio(state.srcWidth, state.srcHeight)],
  ];
  for (const [lbl, val] of rows) {
    grid.appendChild(el('div', { class: 'ig-src-item' }, [
      el('span', { class: 'ig-src-label' }, [lbl]),
      el('span', { class: 'ig-src-value' }, [val]),
    ]));
  }
  srcSection.appendChild(grid);
  frag.appendChild(srcSection);

  // Tab 切换
  const tabSection = el('div', { class: 'ig-panel-section' });
  tabSection.appendChild(el('p', { class: 'ig-section-title' }, ['操作']));
  tabSection.appendChild(buildTabs(root, state));

  // 参数控件
  const paramsWrap = el('div', { class: 'ig-params', id: 'ig-params', role: 'tabpanel' });
  if (state.tab === 'crop') {
    paramsWrap.appendChild(buildCropParams(root, state));
  } else {
    paramsWrap.appendChild(buildCompressParams(root, state));
  }
  tabSection.appendChild(paramsWrap);

  // 执行按钮
  tabSection.appendChild(buildRunBtn(root, state));
  frag.appendChild(tabSection);

  return frag;
}

// Tab
function buildTabs(root: HTMLElement, state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-tabs', role: 'tablist', 'aria-label': '操作' });
  const tabs: [Tab, string][] = [['crop', '裁剪'], ['compress', '压缩']];

  for (const [tab, label] of tabs) {
    const on = state.tab === tab;
    const btn = el('button', {
      type: 'button',
      class: `ig-tab${on ? ' active' : ''}`,
      role: 'tab',
      'data-tab': tab,
      'aria-selected': on ? 'true' : 'false',
      'aria-controls': 'ig-params',
      tabindex: on ? 0 : -1,
    }, [label]);
    // 方向键切换（WAI-ARIA tablist，自动激活）
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = tabs[(tabs.findIndex(([t]) => t === tab) + 1) % tabs.length][0];
      wrap.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.click();
      root.querySelector<HTMLButtonElement>(`.ig-tab[data-tab="${next}"]`)?.focus();
    });
    btn.addEventListener('click', () => {
      if (state.tab === tab) return;
      state.tab = tab;
      state.cropResult = null;
      state.compressResult = null;
      state.cropRect = null;
      revokeAllURLs(state);
      refreshWorkspace(root, state);
      refreshResult(root, state);
    });
    wrap.appendChild(btn);
  }
  return wrap;
}

// 裁剪参数
function buildCropParams(root: HTMLElement, state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-crop-params' });

  // 比例预设：一键得到该比例下尽可能大的选区（输出为原图像素，不放大）
  const presetWrap = el('div', { class: 'ig-field' });
  presetWrap.appendChild(el('span', { class: 'ig-field-label' }, ['比例']));
  const chips = el('div', { class: 'ig-chips', role: 'group', 'aria-label': '裁剪比例预设' });
  const current = state.cropW / state.cropH;
  for (const p of CROP_PRESETS) {
    const r = p.ratio || state.srcWidth / state.srcHeight;
    const active = Math.abs(current - r) < 0.005;
    const chip = el('button', {
      type: 'button',
      class: `ig-chip${active ? ' active' : ''}`,
      'aria-pressed': active ? 'true' : 'false',
    }, [p.label]);
    chip.addEventListener('click', () => {
      if (p.ratio === 0) {
        state.cropW = state.srcWidth;
        state.cropH = state.srcHeight;
      } else if (state.srcWidth / state.srcHeight > r) {
        state.cropH = state.srcHeight;
        state.cropW = Math.max(1, Math.round(state.srcHeight * r));
      } else {
        state.cropW = state.srcWidth;
        state.cropH = Math.max(1, Math.round(state.srcWidth / r));
      }
      state.lockRatio = state.cropW / state.cropH;
      state.cropRect = null;
      updateCropOverlay(root, state);
      refreshPanel(root, state);
    });
    chips.appendChild(chip);
  }
  presetWrap.appendChild(chips);
  wrap.appendChild(presetWrap);
  // 宽高输入行
  const row = el('div', { class: 'ig-field-row' });

  const wField = el('div', { class: 'ig-field' });
  wField.appendChild(el('label', { class: 'ig-field-label', for: 'ig-crop-w' }, ['宽 (px)']));
  const wInput = el('input', {
    type: 'number', id: 'ig-crop-w',
    class: 'ig-number', min: 1, max: 10000, value: state.cropW,
  }) as HTMLInputElement;
  wInput.addEventListener('input', () => {
    const v = parseInt(wInput.value, 10);
    if (!isNaN(v) && v >= 1 && v <= 10000) {
      state.cropW = v;
      if (state.cropLock) {
        syncRatio(state, 'w');
        hInput.value = String(state.cropH);
      }
      state.cropRect = null;
      updateCropOverlay(root, state);
      refreshChips(root, state);
    }
  });
  wField.appendChild(wInput);
  row.appendChild(wField);

  const hField = el('div', { class: 'ig-field' });
  hField.appendChild(el('label', { class: 'ig-field-label', for: 'ig-crop-h' }, ['高 (px)']));
  const hInput = el('input', {
    type: 'number', id: 'ig-crop-h',
    class: 'ig-number', min: 1, max: 10000, value: state.cropH,
  }) as HTMLInputElement;
  hInput.addEventListener('input', () => {
    const v = parseInt(hInput.value, 10);
    if (!isNaN(v) && v >= 1 && v <= 10000) {
      state.cropH = v;
      if (state.cropLock) {
        syncRatio(state, 'h');
        wInput.value = String(state.cropW);
      }
      state.cropRect = null;
      updateCropOverlay(root, state);
      refreshChips(root, state);
    }
  });
  hField.appendChild(hInput);
  row.appendChild(hField);
  wrap.appendChild(row);

  // 锁定比例
  const lockBtn = buildLockBtn(root, state);
  wrap.appendChild(lockBtn);

  wrap.appendChild(
    el('p', { class: 'ig-hint' }, ['在左侧拖动选区选择画面，四角和边缘可缩放，选区始终保持输出比例。']),
  );

  return wrap;
}

// 只刷新比例预设的选中态，不重建面板（保持输入框焦点）
function refreshChips(root: HTMLElement, state: State): void {
  const current = state.cropW / state.cropH;
  root.querySelectorAll<HTMLButtonElement>('.ig-crop-params .ig-chip').forEach((chip, i) => {
    const p = CROP_PRESETS[i];
    const r = p.ratio || state.srcWidth / state.srcHeight;
    const active = Math.abs(current - r) < 0.005;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function buildLockBtn(root: HTMLElement, state: State): HTMLElement {
  const btn = el('button', {
    type: 'button',
    class: `ig-lock-btn${state.cropLock ? ' active' : ''}`,
    'aria-pressed': state.cropLock ? 'true' : 'false',
  }, [
    el('span', { html: state.cropLock ? ICON.lockClosed : ICON.lockOpen }),
    state.cropLock ? '宽高已联动' : '联动宽高',
  ]);
  btn.title = '开启后修改宽或高，另一项按当前比例自动换算';
  btn.addEventListener('click', () => {
    state.cropLock = !state.cropLock;
    if (state.cropLock) state.lockRatio = state.cropW / state.cropH;
    refreshPanel(root, state);
  });
  return btn;
}

// 压缩参数
function buildCompressParams(_root: HTMLElement, state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-compress-params' });

  // 目标体积
  const sizeField = el('div', { class: 'ig-field' });
  sizeField.appendChild(el('label', { class: 'ig-field-label', for: 'ig-target-kb' }, ['目标体积 (KB)']));
  const sizeInput = el('input', {
    type: 'number', id: 'ig-target-kb',
    class: 'ig-number', min: 5, max: 10000, value: state.targetKB,
  }) as HTMLInputElement;
  const sizeChips = el('div', { class: 'ig-chips', role: 'group', 'aria-label': '目标体积预设' });
  const paintSizeChips = () => {
    sizeChips.querySelectorAll<HTMLButtonElement>('.ig-chip').forEach((c, i) => {
      const on = SIZE_PRESETS[i] === state.targetKB;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    warn.hidden = !(state.file && state.file.size <= state.targetKB * 1024);
  };
  const warn = el('p', { class: 'ig-hint ig-hint-warn' }, ['原图已小于目标体积，压缩后可能反而变大。']);
  sizeInput.addEventListener('input', () => {
    const v = parseInt(sizeInput.value, 10);
    if (!isNaN(v) && v >= 5 && v <= 10000) state.targetKB = v;
    paintSizeChips();
  });
  for (const kb of SIZE_PRESETS) {
    const chip = el('button', { type: 'button', class: 'ig-chip' }, [kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`]);
    chip.addEventListener('click', () => {
      state.targetKB = kb;
      sizeInput.value = String(kb);
      paintSizeChips();
    });
    sizeChips.appendChild(chip);
  }
  sizeField.appendChild(sizeChips);
  sizeField.appendChild(sizeInput);
  wrap.appendChild(sizeField);
  wrap.appendChild(warn);
  paintSizeChips();

  // 初始质量滑块：大多数人不需要动，收进「高级设置」
  const advanced = el('details', { class: 'ig-advanced' });
  advanced.appendChild(el('summary', {}, ['高级设置']));
  const qualityWrap = el('div', { class: 'ig-range-wrap' });
  const qHeader = el('div', { class: 'ig-range-header' });
  qHeader.appendChild(el('label', { class: 'ig-field-label', for: 'ig-quality' }, ['初始质量']));
  const qVal = el('span', { class: 'ig-range-val' }, [String(state.quality)]);
  qHeader.appendChild(qVal);
  qualityWrap.appendChild(qHeader);
  const qRange = el('input', {
    type: 'range', id: 'ig-quality',
    class: 'ig-range', min: 30, max: 99, value: state.quality,
  }) as HTMLInputElement;
  qRange.addEventListener('input', () => {
    state.quality = parseInt(qRange.value, 10);
    qVal.textContent = String(state.quality);
  });
  qualityWrap.appendChild(qRange);
  advanced.appendChild(qualityWrap);
  advanced.appendChild(
    el('p', { class: 'ig-hint' }, ['从初始质量向下迭代逼近目标体积，质量降到 30 仍超出时自动缩小尺寸再试。']),
  );
  wrap.appendChild(advanced);

  const isPng = state.file?.type === 'image/png';
  wrap.appendChild(
    el('p', { class: 'ig-hint' }, [
      isPng ? '输出为 JPEG，透明区域会填充为白色。' : '输出为 JPEG。',
    ]),
  );

  return wrap;
}

// 执行按钮
function buildRunBtn(root: HTMLElement, state: State): HTMLButtonElement {
  const idleLabel = state.tab === 'crop' ? '应用裁剪' : '开始压缩';
  const btn = el('button', {
    type: 'button',
    class: `ig-run-btn${state.busy ? ' busy' : ''}`,
    disabled: state.busy,
  });
  if (state.busy) {
    btn.appendChild(el('span', { class: 'ig-spinner', 'aria-hidden': 'true' }));
    btn.appendChild(document.createTextNode('处理中…'));
  } else {
    btn.appendChild(document.createTextNode(idleLabel));
  }
  btn.addEventListener('click', () => {
    if (state.tab === 'crop') void runCrop(root, state);
    else void runCompress(root, state);
  });
  return btn;
}

// ---- 结果区 ----

function buildResult(root: HTMLElement, state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-result' });
  wrap.hidden = !hasResult(state);

  const hooks = wrap as unknown as { __refresh: () => void };
  hooks.__refresh = () => {
    wrap.hidden = !hasResult(state);
    wrap.innerHTML = '';
    if (hasResult(state)) wrap.appendChild(buildResultInner(state));
  };

  if (hasResult(state)) wrap.appendChild(buildResultInner(state));
  return wrap;
}

function hasResult(state: State): boolean {
  return !!(state.cropResult || state.compressResult);
}

function buildResultInner(state: State): HTMLElement {
  const inner = el('div', { class: 'ig-result-inner' });

  // 头部：标签 + 统计 + 下载
  const head = el('div', { class: 'ig-result-head' });
  head.appendChild(el('span', { class: 'ig-result-label' }, ['处理结果']));

  const stats = el('div', { class: 'ig-result-stats' });
  const srcSize = state.file?.size ?? 0;

  let resultBlob: Blob | null = null;
  let resultMeta = '';
  let downloadName = '';

  if (state.tab === 'crop' && state.cropResult) {
    resultBlob = state.cropResult.blob;
    const ratio = ratioPercent(srcSize, resultBlob.size);
    stats.appendChild(el('span', { class: 'ig-result-size' }, [formatBytes(resultBlob.size)]));
    stats.appendChild(el('span', { class: 'ig-result-dim' }, [`${state.cropResult.w} × ${state.cropResult.h}`]));
    if (ratio !== 0) {
      stats.appendChild(el('span', {
        class: 'ig-delta',
        'data-dir': ratio < 0 ? 'down' : 'up',
      }, [`${ratio < 0 ? '↓' : '↑'} ${Math.abs(ratio)}%`]));
    }
    resultMeta = `${state.cropResult.w} × ${state.cropResult.h}`;
    downloadName = buildOutputName(state.file?.name ?? 'image', 'cropped', inferExt(resultBlob.type));
  } else if (state.tab === 'compress' && state.compressResult) {
    resultBlob = state.compressResult.blob;
    const ratio = ratioPercent(srcSize, resultBlob.size);
    stats.appendChild(el('span', { class: 'ig-result-size' }, [formatBytes(resultBlob.size)]));
    if (ratio !== 0) {
      stats.appendChild(el('span', {
        class: 'ig-delta',
        'data-dir': ratio < 0 ? 'down' : 'up',
      }, [`${ratio < 0 ? '↓' : '↑'} ${Math.abs(ratio)}%`]));
    }
    stats.appendChild(el('span', { class: 'ig-result-dim' }, [
      `质量 ${Math.round(state.compressResult.quality * 100)}  ·  迭代 ${state.compressResult.iterations} 次`,
    ]));
    resultMeta = `质量 ${Math.round(state.compressResult.quality * 100)}`;
    downloadName = buildOutputName(state.file?.name ?? 'image', 'compressed', inferExt(resultBlob.type));
  }

  head.appendChild(stats);
  const missedTarget =
    state.tab === 'compress' && !!state.compressResult && state.compressResult.blob.size > state.targetKB * 1024;
  if (missedTarget) {
    inner.appendChild(
      el('p', { class: 'ig-result-note' }, [
        `已尽力压缩，仍略高于目标 ${state.targetKB} KB：这张图细节较多，可以调高目标体积或先裁剪缩小尺寸。`,
      ]),
    );
  } else if (resultBlob && resultBlob.size >= srcSize) {
    inner.appendChild(
      el('p', { class: 'ig-result-note' }, ['结果没有比原图更小：原图已经足够精简，可以直接使用原图。']),
    );
  }
  if (resultBlob) {
    const dlUrl = trackedURL(state, resultBlob);
    const dlLink = el('a', {
      class: 'ig-result-dl',
      href: dlUrl,
      download: downloadName,
    }, [
      el('span', { html: ICON.download }),
      `下载`,
    ]);
    head.appendChild(dlLink);
  }
  inner.insertBefore(head, inner.firstChild);
  // 对比预览：原图与结果叠放，拖动滑块左右对比（键盘方向键也可调）
  const preview = el('div', { class: 'ig-result-preview' });
  if (state.file && resultBlob) {
    const cmp = el('div', { class: 'ig-compare', style: '--pos:50%' });
    cmp.appendChild(el('img', { class: 'ig-compare-img ig-compare-src', src: trackedURL(state, state.file), alt: '原图' }));
    const top = el('div', { class: 'ig-compare-top' });
    top.appendChild(el('img', { class: 'ig-compare-img', src: trackedURL(state, resultBlob), alt: '处理结果' }));
    cmp.appendChild(top);
    cmp.appendChild(el('span', { class: 'ig-compare-tag l' }, ['结果']));
    cmp.appendChild(el('span', { class: 'ig-compare-tag r' }, ['原图']));
    cmp.appendChild(el('span', { class: 'ig-compare-line', 'aria-hidden': 'true' }));
    const range = el('input', {
      type: 'range', class: 'ig-compare-range', min: 0, max: 100, value: 50,
      'aria-label': '对比位置：左侧为结果，右侧为原图',
    }) as HTMLInputElement;
    range.addEventListener('input', () => cmp.style.setProperty('--pos', `${range.value}%`));
    cmp.appendChild(range);
    preview.appendChild(cmp);
    preview.appendChild(el('p', { class: 'ig-compare-hint' }, ['拖动中间的分隔线对比：左侧是结果，右侧是原图。']));
  }
  inner.appendChild(preview);
  return inner;
}

// ============================================================
// 刷新钩子（局部刷新，避免完整重渲染）
// ============================================================

function refreshWorkspace(root: HTMLElement, state: State): void {
  const ws = root.querySelector<HTMLElement>('.ig-workspace');
  if (!ws) return;
  ws.hidden = !state.file;
  if (!state.file) return;
  (ws as unknown as { __refresh: () => void }).__refresh();
}

// 裁剪参数变化时只重绘选区与尺寸标签，不重建 <img>（避免每次输入都重新解码图片、画面闪烁）
function updateCropOverlay(root: HTMLElement, state: State): void {
  const overlay = root.querySelector<HTMLElement>('.ig-crop-overlay');
  if (!overlay) {
    refreshStage(root, state);
    return;
  }
  const rect = calcCoverRect(state.srcWidth, state.srcHeight, state.cropW, state.cropH, 'cover');
  paintOverlay(overlay, rect, state);
  const tag = root.querySelector<HTMLElement>('.ig-stage-tag');
  if (tag) tag.textContent = `输出 ${state.cropW} × ${state.cropH}`;
}

function refreshStage(root: HTMLElement, state: State): void {
  const ws = root.querySelector<HTMLElement>('.ig-workspace');
  if (!ws) return;
  (ws as unknown as { __refreshStage: () => void }).__refreshStage();
}

function refreshPanel(root: HTMLElement, state: State): void {
  const ws = root.querySelector<HTMLElement>('.ig-workspace');
  if (!ws) return;
  (ws as unknown as { __refreshPanel: () => void }).__refreshPanel();
}

function refreshRunBtn(root: HTMLElement, state: State): void {
  // 只刷新执行按钮（轻量刷新，不重建整个 panel）
  const old = root.querySelector<HTMLButtonElement>('.ig-run-btn');
  if (!old) return;
  const next = buildRunBtn(root, state);
  old.replaceWith(next);
}

function refreshResult(root: HTMLElement, state: State): void {
  const result = root.querySelector<HTMLElement>('.ig-result');
  if (!result) return;
  (result as unknown as { __refresh: () => void }).__refresh();
}

function refreshErrors(root: HTMLElement, state: State): void {
  const slot = root.querySelector<HTMLElement>('.ig-error-slot');
  if (!slot) return;
  slot.innerHTML = '';
  for (const msg of state.errors) {
    const banner = el('div', { class: 'ig-error' });
    banner.appendChild(el('span', { class: 'ig-error-icon', html: ICON.alert }));
    banner.appendChild(el('span', { class: 'ig-error-text' }, [msg]));
    const closeBtn = el('button', {
      type: 'button', class: 'ig-error-close', 'aria-label': '关闭',
    }, [el('span', { html: ICON.close })]);
    closeBtn.addEventListener('click', () => {
      state.errors = state.errors.filter((m) => m !== msg);
      refreshErrors(root, state);
    });
    banner.appendChild(closeBtn);
    slot.appendChild(banner);
  }
}

// ============================================================
// 文件处理
// ============================================================

async function handleFile(file: File, root: HTMLElement, state: State): Promise<void> {
  if (!ACCEPT_RE.test(file.type)) {
    pushError(root, state, `暂不支持 ${file.type || '该'} 格式，请使用 JPEG / PNG / WebP 图片`);
    return;
  }
  if (file.size > MAX_BYTES) {
    pushError(root, state, `文件过大（${formatBytes(file.size)}），上限 ${formatBytes(MAX_BYTES)}`);
    return;
  }
  state.cropResult = null;
  state.compressResult = null;
  revokeAllURLs(state);

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch (e) {
    pushError(root, state, `无法解析图片：${(e as Error).message}`);
    return;
  }
  if (bmp.width * bmp.height > MAX_PIXELS) {
    bmp.close();
    pushError(root, state, `像素过多（${bmp.width}×${bmp.height}），可能耗尽内存`);
    return;
  }
  if (state.bitmap) state.bitmap.close();
  state.bitmap = bmp;
  state.srcWidth = bmp.width;
  state.srcHeight = bmp.height;
  state.file = file;
  state.cropRect = null;
  state.errors = [];
  // 默认裁剪尺寸：沿用当前比例，限制在原图范围内，避免默认就放大
  if (state.cropW > bmp.width || state.cropH > bmp.height) {
    const s = Math.min(bmp.width / state.cropW, bmp.height / state.cropH);
    state.cropW = Math.max(1, Math.round(state.cropW * s));
    state.cropH = Math.max(1, Math.round(state.cropH * s));
  }
  // 显示工作区
  const empty = root.querySelector<HTMLElement>('.ig-empty');
  const ws = root.querySelector<HTMLElement>('.ig-workspace');
  if (empty) empty.hidden = true;
  if (ws) {
    ws.hidden = false;
    (ws as unknown as { __refresh: () => void }).__refresh();
  }
  refreshResult(root, state);
  refreshErrors(root, state);
}

function reset(root: HTMLElement, state: State): void {
  if (state.bitmap) state.bitmap.close();
  state.bitmap = null;
  state.file = null;
  state.cropResult = null;
  state.compressResult = null;
  state.cropRect = null;
  state.srcWidth = 0;
  state.srcHeight = 0;
  state.errors = [];
  revokeAllURLs(state);
  root.innerHTML = '';
  root.appendChild(buildView(root, state));
}

function pushError(root: HTMLElement, state: State, msg: string): void {
  state.errors.push(msg);
  refreshErrors(root, state);
}

function syncRatio(state: State, from: 'w' | 'h'): void {
  if (!state.cropLock) return;
  const ratio = state.lockRatio || state.cropW / state.cropH;
  if (from === 'w') state.cropH = Math.max(1, Math.round(state.cropW / ratio));
  else state.cropW = Math.max(1, Math.round(state.cropH * ratio));
}

// ============================================================
// 算法执行
// ============================================================

async function runCrop(root: HTMLElement, state: State): Promise<void> {
  if (!state.bitmap || !state.file || state.busy) return;
  state.busy = true;
  refreshRunBtn(root, state);
  try {
    const rect = state.cropRect ?? calcCoverRect(state.srcWidth, state.srcHeight, state.cropW, state.cropH, 'cover');
    const canvas = document.createElement('canvas');
    canvas.width = state.cropW;
    canvas.height = state.cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 canvas context');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, state.cropW, state.cropH);
    const outType = state.file.type === 'image/png' || state.file.type === 'image/webp' ? state.file.type : 'image/jpeg';
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob 返回空'))), outType, 0.95),
    );
    state.cropResult = { blob, w: state.cropW, h: state.cropH };
    notify('裁剪完成', `${state.cropW} × ${state.cropH} · ${formatBytes(blob.size)}，可以下载了。`);
  } catch (e) {
    pushError(root, state, `裁剪失败：${(e as Error).message}`);
  } finally {
    state.busy = false;
    refreshPanel(root, state);
    refreshResult(root, state);
    revealResult(root, state);
  }
}

async function runCompress(root: HTMLElement, state: State): Promise<void> {
  if (!state.bitmap || state.busy) return;
  state.busy = true;
  refreshRunBtn(root, state);
  try {
    const targetBytes = state.targetKB * 1024;
    const initialQuality = Math.min(0.99, Math.max(0.3, state.quality / 100));
    if (typeof Worker !== 'undefined') {
      state.compressResult = await runCompressInWorker(state, targetBytes, initialQuality);
    } else {
      state.compressResult = await compressToTarget(state.bitmap, {
        targetBytes, initialQuality,
        encode: encodeWithCanvas,
        resize: resizeWithCanvas,
      });
    }
    const r = state.compressResult;
    if (r) notify('压缩完成', `${formatBytes(state.file?.size ?? 0)} → ${formatBytes(r.blob.size)}，可以下载了。`);
  } catch (e) {
    pushError(root, state, `压缩失败：${(e as Error).message}`);
  } finally {
    state.busy = false;
    refreshPanel(root, state);
    refreshResult(root, state);
    revealResult(root, state);
  }
}

function notify(title: string, description: string): void {
  try {
    toast.success(title, { description });
  } catch {
    // Toaster 不存在时静默：结果区本身已经展示了结果
  }
}

// 结果出现在工作区下方，常在首屏之外：处理完成后滚动到可见
function revealResult(root: HTMLElement, state: State): void {
  if (!hasResult(state)) return;
  const target = root.querySelector<HTMLElement>('.ig-result');
  if (!target) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
}

async function runCompressInWorker(state: State, targetBytes: number, initialQuality: number): Promise<EncodeResult> {
  if (!state.bitmap) throw new Error('no bitmap');
  // 转移（transfer）后原位图会被 detach；这里转移一份副本，主线程保留原图，
  // 否则第二次压缩、切回裁剪都会报 "ImageBitmap is detached"。
  const copy = await createImageBitmap(state.bitmap);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./image-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const msg = ev.data as { ok: boolean; result?: EncodeResult; message?: string };
      if (msg.ok && msg.result) resolve(msg.result);
      else reject(new Error(msg.message ?? 'worker failed'));
      worker.terminate();
    };
    worker.onerror = (e) => { reject(new Error(e.message || 'worker error')); worker.terminate(); };
    worker.postMessage(
      { bitmap: copy, targetBytes, initialQuality, mime: 'image/jpeg', maxQualityIters: 8, maxDownscaleIters: 6 },
      [copy],
    );
  });
}

async function encodeWithCanvas(bitmap: ImageBitmap, mime: string, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas context');
  // JPEG 不支持透明，未铺底时透明像素会变成黑色
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), mime, quality),
  );
}

async function resizeWithCanvas(bitmap: ImageBitmap, longestEdge: number): Promise<ImageBitmap> {
  const ratio = longestEdge / Math.max(bitmap.width, bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas context（缩放）');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return createImageBitmap(canvas);
}
