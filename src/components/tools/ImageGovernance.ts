// 图片治理工具客户端入口（重设计版）
// 布局：页头 → 上传区(空态) → 工作区(左:图片预览 + 右:控件面板) → 结果区
// 不依赖 daisyUI 类名，所有样式来自 image-governance.astro 的全局 CSS。

import { calcCoverRect, type Rect } from '../../lib/image-tools/crop';
import { compressToTarget, type EncodeResult } from '../../lib/image-tools/compress';
import { formatBytes, ratioPercent, inferExt, buildOutputName } from '../../lib/image-tools/format';
import { ICON } from './icons';
import { attachCropInteraction } from './crop-interaction';

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
    else if (k.startsWith('aria-') || k === 'role') node.setAttribute(k, String(v));
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

export function mountImageGovernance(root: HTMLElement): void {
  const state: State = {
    file: null, bitmap: null,
    srcWidth: 0, srcHeight: 0,
    tab: 'crop',
    cropW: 800, cropH: 600, cropLock: false,
    cropRect: null, cropResult: null,
    targetKB: 200, quality: 75,
    compressResult: null,
    busy: false, errors: [],
    urlsToRevoke: [],
  };
  root.innerHTML = '';
  root.appendChild(buildView(root, state));
}

// ============================================================
// 视图构建：一次性组装整棵树，后续通过 refresh* 局部刷新
// ============================================================

function buildView(root: HTMLElement, state: State): HTMLElement {
  const view = el('div', { class: 'ig-view' });

  // 页头
  view.appendChild(buildPageHead());

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

// ---- 页头 ----

function buildPageHead(): HTMLElement {
  const head = el('div', { class: 'ig-pagehead' });
  head.appendChild(
    el('a', { class: 'ig-back', href: '/tools' }, [
      el('span', { class: 'ig-back-icon', html: ICON.back }),
      '工具列表',
    ]),
  );
  head.appendChild(
    el('div', { class: 'ig-heading' }, [
      el('h1', { class: 'ig-title' }, ['图片治理']),
      el('p', { class: 'ig-lede' }, ['裁剪与压缩图片，全程在浏览器内完成，不上传任何服务器']),
    ]),
  );
  return head;
}

// ---- 上传区 ----

function buildDropZone(root: HTMLElement, state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-empty' });
  wrap.hidden = !!state.file;

  const label = el('label', { class: 'ig-drop', for: 'ig-file-input' });
  const fileInput = el('input', {
    type: 'file', id: 'ig-file-input',
    accept: 'image/jpeg,image/png',
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
  label.appendChild(el('span', { class: 'ig-drop-hint' }, ['或点击选择  ·  JPEG / PNG  ·  最大 20 MB']));
  label.appendChild(
    el('div', { class: 'ig-drop-chips' }, [
      el('span', { class: 'ig-drop-chip' }, ['浏览器内处理']),
      el('span', { class: 'ig-drop-chip' }, ['不上传服务器']),
      el('span', { class: 'ig-drop-chip' }, ['支持 JPEG / PNG']),
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
  stage.appendChild(img);

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
      'aria-label': '裁剪选区',
    });
    // 8 个把手
    for (const cls of ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br']) {
      overlay.appendChild(el('span', { class: `ig-handle ${cls}` }));
    }
    overlay.appendChild(el('span', { class: 'ig-crop-grab' }));
    stage.appendChild(overlay);

    // 尺寸标签
    stage.appendChild(
      el('div', { class: 'ig-stage-tag' }, [`${state.cropW} × ${state.cropH}`]),
    );

    attachCropInteraction(stage, overlay, state, root);
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
    ['格式', mime === 'image/png' ? 'PNG' : mime === 'image/jpeg' ? 'JPEG' : '—'],
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
  const paramsWrap = el('div', { class: 'ig-params' });
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
  const wrap = el('div', { class: 'ig-tabs', role: 'tablist' });

  for (const [tab, label] of [['crop', '裁剪'], ['compress', '压缩']] as [Tab, string][]) {
    const btn = el('button', {
      type: 'button',
      class: `ig-tab${state.tab === tab ? ' active' : ''}`,
      role: 'tab',
      'aria-selected': state.tab === tab ? 'true' : 'false',
    }, [label]);
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
      if (state.cropLock) syncRatio(state, 'w');
      state.cropRect = null;
      refreshStage(root, state);
      refreshRunBtn(root, state);
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
      if (state.cropLock) syncRatio(state, 'h');
      state.cropRect = null;
      refreshStage(root, state);
      refreshRunBtn(root, state);
    }
  });
  hField.appendChild(hInput);
  row.appendChild(hField);
  wrap.appendChild(row);

  // 锁定比例
  const lockBtn = buildLockBtn(root, state);
  wrap.appendChild(lockBtn);

  return wrap;
}

function buildLockBtn(root: HTMLElement, state: State): HTMLElement {
  const btn = el('button', {
    type: 'button',
    class: `ig-lock-btn${state.cropLock ? ' active' : ''}`,
    'aria-pressed': state.cropLock ? 'true' : 'false',
  }, [
    el('span', { html: state.cropLock ? ICON.lockClosed : ICON.lockOpen }),
    state.cropLock ? '已锁定比例' : '锁定比例',
  ]);
  btn.addEventListener('click', () => {
    state.cropLock = !state.cropLock;
    refreshPanel(root, state);
  });
  return btn;
}

// 压缩参数
function buildCompressParams(root: HTMLElement, state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-compress-params' });

  // 目标体积
  const sizeField = el('div', { class: 'ig-field' });
  sizeField.appendChild(el('label', { class: 'ig-field-label', for: 'ig-target-kb' }, ['目标体积 (KB)']));
  const sizeInput = el('input', {
    type: 'number', id: 'ig-target-kb',
    class: 'ig-number', min: 5, max: 10000, value: state.targetKB,
  }) as HTMLInputElement;
  sizeInput.addEventListener('input', () => {
    const v = parseInt(sizeInput.value, 10);
    if (!isNaN(v) && v >= 5 && v <= 10000) state.targetKB = v;
  });
  sizeField.appendChild(sizeInput);
  wrap.appendChild(sizeField);

  // 初始质量滑块
  const qualityWrap = el('div', { class: 'ig-range-wrap' });
  const qHeader = el('div', { class: 'ig-range-header' });
  qHeader.appendChild(el('label', { class: 'ig-field-label', for: 'ig-quality' }, ['初始质量']));
  const qVal = el('span', { class: 'ig-range-val' }, [String(state.quality)]);
  qHeader.appendChild(qVal);
  qualityWrap.appendChild(qHeader);
  const qRange = el('input', {
    type: 'range', id: 'ig-quality',
    class: 'ig-range', min: 0, max: 100, value: state.quality,
  }) as HTMLInputElement;
  qRange.addEventListener('input', () => {
    state.quality = parseInt(qRange.value, 10);
    qVal.textContent = String(state.quality);
  });
  qualityWrap.appendChild(qRange);
  wrap.appendChild(qualityWrap);

  wrap.appendChild(
    el('p', { class: 'ig-hint' }, [
      '从初始质量向下迭代逼近目标体积，达到下限后自动缩小尺寸再试。输出为 JPEG。',
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
  inner.appendChild(head);

  // 对比预览
  const preview = el('div', { class: 'ig-result-preview' });

  // 原图面板
  const srcPane = el('div', { class: 'ig-compare-pane' });
  srcPane.appendChild(el('div', { class: 'ig-compare-label' }, ['原图']));
  const srcImgWrap = el('div', { class: 'ig-compare-img-wrap' });
  if (state.file) {
    const srcUrl = trackedURL(state, state.file);
    srcImgWrap.appendChild(el('img', { class: 'ig-compare-img', src: srcUrl, alt: '原图' }));
  }
  srcPane.appendChild(srcImgWrap);
  preview.appendChild(srcPane);

  // 结果面板
  const resPane = el('div', { class: 'ig-compare-pane' });
  resPane.appendChild(el('div', { class: 'ig-compare-label' }, ['结果']));
  const resImgWrap = el('div', { class: 'ig-compare-img-wrap' });
  if (resultBlob) {
    const resUrl = trackedURL(state, resultBlob);
    resImgWrap.appendChild(el('img', { class: 'ig-compare-img', src: resUrl, alt: '处理结果' }));
  } else {
    resImgWrap.appendChild(el('div', { class: 'ig-compare-placeholder' }, ['处理后显示在这里']));
  }
  resPane.appendChild(resImgWrap);
  preview.appendChild(resPane);

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
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    pushError(root, state, '仅支持 JPEG / PNG 图片');
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
  if (!state.cropLock || !state.srcWidth || !state.srcHeight) return;
  const ratio = state.srcWidth / state.srcHeight;
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
    const outType = state.file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob 返回空'))), outType, 0.95),
    );
    state.cropResult = { blob, w: state.cropW, h: state.cropH };
  } catch (e) {
    pushError(root, state, `裁剪失败：${(e as Error).message}`);
  } finally {
    state.busy = false;
    refreshPanel(root, state);
    refreshResult(root, state);
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
  } catch (e) {
    pushError(root, state, `压缩失败：${(e as Error).message}`);
  } finally {
    state.busy = false;
    refreshPanel(root, state);
    refreshResult(root, state);
  }
}

function runCompressInWorker(state: State, targetBytes: number, initialQuality: number): Promise<EncodeResult> {
  return new Promise((resolve, reject) => {
    if (!state.bitmap) { reject(new Error('no bitmap')); return; }
    const worker = new Worker(new URL('./image-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const msg = ev.data as { ok: boolean; result?: EncodeResult; message?: string };
      if (msg.ok && msg.result) resolve(msg.result);
      else reject(new Error(msg.message ?? 'worker failed'));
      worker.terminate();
    };
    worker.onerror = (e) => { reject(new Error(e.message || 'worker error')); worker.terminate(); };
    worker.postMessage(
      { bitmap: state.bitmap, targetBytes, initialQuality, mime: 'image/jpeg', maxQualityIters: 8, maxDownscaleIters: 3 },
      [state.bitmap],
    );
  });
}

async function encodeWithCanvas(bitmap: ImageBitmap, mime: string, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas context');
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
