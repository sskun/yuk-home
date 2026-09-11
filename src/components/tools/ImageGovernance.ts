// 图片治理工具的客户端入口（页头 + 粘性工具条 + 三栏工作区 + 粘性动作栏）。
// 流程：上传文件 → 解析为 ImageBitmap → 根据当前 Tab 触发裁剪或压缩 → 渲染结果预览 + 体积对比 → 触发下载。
// 结构：PageHead(返回行 + 标题) · Toolbar(粘性，仅工作控件) · Empty | Workspace(Canvas + 粘性 Inspector) · ActionBar(粘性底部)。
// 不引入 UI 框架，原生 DOM；组件形状交给 daisyUI 类名，纯布局与图像交互层用手写 CSS。
// 图标与拖拽交互抽到 icons.ts / crop-interaction.ts。

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
  /** 本次会话创建的 ObjectURL；切换/重置时统一 revoke 避免内存堆积 */
  urlsToRevoke: string[];
}

const MAX_BYTES = 20 * 1024 * 1024; // 20MB 上限
const MAX_PIXELS = 50_000_000; // 5000 万像素上限，避免 OOM

/** 极简 DOM 构造器：attrs 支持 class / style / aria-* / data-* / html / 直接属性名。 */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | null | undefined> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'style') (node as HTMLElement).style.cssText = String(v);
    else if (k.startsWith('aria-') || k === 'role') node.setAttribute(k, String(v));
    else if (k.startsWith('data-')) node.setAttribute(k, String(v));
    else if (k === 'html') (node as HTMLElement).innerHTML = String(v);
    else (node as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children) {
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** 创建并跟踪一个 ObjectURL，归 state.urlsToRevoke 管理。 */
function trackedURL(state: State, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  state.urlsToRevoke.push(url);
  return url;
}

/** 撤销所有跟踪中的 ObjectURL 并清空列表。 */
function revokeAllURLs(state: State): void {
  for (const url of state.urlsToRevoke) URL.revokeObjectURL(url);
  state.urlsToRevoke = [];
}

/** 文件名截断：中间省略号，保留末尾扩展名可见。 */
function truncate(name: string, max: number): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  if (dot > 0 && name.length - dot <= 6) {
    const ext = name.slice(dot);
    const head = name.slice(0, Math.max(1, max - ext.length - 1));
    return `${head}…${ext}`;
  }
  return `${name.slice(0, max - 1)}…`;
}

/** 宽高约分：800×600 → "4:3"；无公约数时回落到小数比例。 */
function formatRatio(w: number, h: number): string {
  if (!w || !h) return '—';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(w, h) || 1;
  const rw = w / g;
  const rh = h / g;
  if (rw <= 100 && rh <= 100) return `${rw}:${rh}`;
  return (w / h).toFixed(2);
}

export function mountImageGovernance(root: HTMLElement): void {
  const state: State = {
    file: null,
    bitmap: null,
    srcWidth: 0,
    srcHeight: 0,
    tab: 'crop',
    cropW: 800,
    cropH: 600,
    cropLock: false,
    cropRect: null,
    cropResult: null,
    targetKB: 200,
    quality: 75,
    compressResult: null,
    busy: false,
    errors: [],
    urlsToRevoke: [],
  };
  root.innerHTML = '';
  root.appendChild(render(root, state));
}

// ============ 主渲染编排 ============

/** 组装整棵 UI 树；返回顶层 .ig-view 元素。 */
function render(root: HTMLElement, state: State): HTMLElement {
  const view = el('div', { class: 'ig-view' });
  view.appendChild(renderPageHead());
  view.appendChild(renderToolbar(root, state));
  view.appendChild(el('div', { class: 'ig-error-slot', role: 'alert', 'aria-live': 'polite' }));
  view.appendChild(renderEmpty(root, state));
  view.appendChild(renderWorkspace(root, state));
  view.appendChild(renderActionBar(root, state));
  refreshErrors(root, state);
  return view;
}

// ============ PageHead：返回行（页面最顶部）+ 标题 + 副标题 ============

/** 页头非粘性：滚动后让位给工具条，把纵向空间还给画布。
 *  返回行刻意独立于工具条 —— 之前它和标题、文件 chip、模式 Tab 挤在同一个胶囊里，
 *  导航 / 标识 / 文档 / 模式四层语义被压平成一排，谁也不突出。 */
function renderPageHead(): HTMLElement {
  const head = el('header', { class: 'ig-pagehead' });
  head.appendChild(
    el('a', { class: 'ig-back btn btn-ghost btn-sm', href: '/tools', 'aria-label': '返回工具列表' }, [
      el('span', { class: 'ig-back-icon', 'aria-hidden': 'true', html: ICON.back }),
      el('span', {}, ['返回工具']),
    ]),
  );
  head.appendChild(
    el('div', { class: 'ig-heading' }, [
      el('h1', { class: 'ig-title' }, ['图片治理']),
      el('p', { class: 'ig-lede' }, ['裁剪与压缩图片 · 全程在浏览器内完成，不会上传服务器']),
    ]),
  );
  return head;
}

// ============ Toolbar：文件 chip │ 模式 Tab │ 换一张 ============

function renderToolbar(root: HTMLElement, state: State): HTMLElement {
  const toolbar = el('div', { class: 'ig-toolbar' });

  // 左侧成组：文件 chip 与模式 Tab 之间用竖线分隔，表达「文档 │ 操作」。
  // Tab 此前被甩到工具条最右，与它控制的画布隔了近 1000px，是脱节的根源。
  const filechipSlot = el('div', { class: 'ig-filechip-slot' });
  toolbar.appendChild(filechipSlot);
  toolbar.appendChild(el('span', { class: 'ig-toolbar-sep', 'aria-hidden': 'true' }));
  toolbar.appendChild(
    el('div', { class: 'ig-tabs tabs tabs-box', role: 'tablist' }, [
      tabBtn('crop', '裁剪', state, root),
      tabBtn('compress', '压缩', state, root),
    ]),
  );

  toolbar.appendChild(el('div', { class: 'ig-toolbar-spacer' }));

  const resetIcon = el('button', {
    type: 'button',
    class: 'ig-reset-icon btn btn-circle btn-ghost btn-sm',
    'aria-label': '换一张图片',
    title: '换一张',
    html: ICON.reset,
  });
  resetIcon.addEventListener('click', () => reset(root, state));
  resetIcon.hidden = !state.file;
  toolbar.appendChild(resetIcon);

  renderFilechip(filechipSlot, root, state);

  // 挂载刷新钩子：文件上传/重置后由 refreshToolbar 触发
  (toolbar as unknown as { __refresh: () => void }).__refresh = () => {
    renderFilechip(filechipSlot, root, state);
    resetIcon.hidden = !state.file;
  };
  return toolbar;
}

function renderFilechip(slot: HTMLElement, root: HTMLElement, state: State): void {
  slot.innerHTML = '';
  if (!state.file) {
    // 未上传：ghost chip，点击触发 file input（与空态 dropzone 等价）
    const ghost = el(
      'button',
      { type: 'button', class: 'ig-filechip ghost btn btn-ghost btn-sm', 'aria-label': '选择图片文件' },
      [
        el('span', { class: 'ig-filechip-icon', 'aria-hidden': 'true', html: ICON.image }),
        el('span', { class: 'ig-filechip-text' }, ['点击上传']),
      ],
    );
    ghost.addEventListener('click', () => {
      root.querySelector<HTMLInputElement>('input[type=file]')?.click();
    });
    slot.appendChild(ghost);
    return;
  }
  // 已上传：缩略图 + 文件名 + 尺寸/体积 + 清除按钮
  const thumbUrl = trackedURL(state, state.file);
  const chip = el('div', { class: 'ig-filechip loaded' }, [
    el('img', { class: 'ig-filechip-thumb', src: thumbUrl, alt: '' }),
    el('div', { class: 'ig-filechip-info' }, [
      el('span', { class: 'ig-filechip-name', title: state.file.name }, [truncate(state.file.name, 28)]),
      el('span', { class: 'ig-filechip-meta' }, [
        `${state.srcWidth}×${state.srcHeight} · ${formatBytes(state.file.size)}`,
      ]),
    ]),
  ]);
  const clearBtn = el('button', {
    type: 'button',
    class: 'ig-filechip-clear btn btn-circle btn-ghost btn-xs',
    'aria-label': '移除文件',
    html: ICON.close,
  });
  clearBtn.addEventListener('click', () => reset(root, state));
  chip.appendChild(clearBtn);
  slot.appendChild(chip);
}

function refreshToolbar(root: HTMLElement, state: State): void {
  const tb = root.querySelector<HTMLElement>('.ig-toolbar');
  if (!tb) return;
  (tb as unknown as { __refresh: () => void }).__refresh();
  // Tab 高亮态可能因为 reset 需要重刷
  refreshTabsState(root, state);
}

// ============ Empty 空态：大 dropzone ============

function renderEmpty(root: HTMLElement, state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-empty' });
  const drop = el(
    'label',
    { class: 'ig-drop', for: 'ig-file' },
    [
      el('input', {
        type: 'file',
        id: 'ig-file',
        accept: 'image/jpeg,image/png',
        class: 'ig-file-input',
      }),
      el('span', { class: 'ig-drop-icon', 'aria-hidden': 'true', html: ICON.folder }),
      el('span', { class: 'ig-drop-title' }, ['拖拽图片到这里']),
      el('span', { class: 'ig-drop-hint' }, ['或点击选择文件 · JPEG / PNG · 最大 20MB']),
      el('div', { class: 'ig-drop-chips' }, [
        el('span', { class: 'ig-drop-chip' }, ['浏览器内处理']),
        el('span', { class: 'ig-drop-chip' }, ['不上传服务器']),
        el('span', { class: 'ig-drop-chip' }, ['支持 JPEG / PNG']),
      ]),
    ],
  );
  const fileInput = drop.querySelector<HTMLInputElement>('input[type=file]')!;
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) void handleFile(f, root, state);
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('drag');
    }),
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('drag');
    }),
  );
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) void handleFile(f, root, state);
  });
  wrap.appendChild(drop);
  wrap.hidden = !!state.file;
  return wrap;
}

// ============ Workspace：Canvas + 粘性 Inspector ============

function renderWorkspace(root: HTMLElement, state: State): HTMLElement {
  const ws = el('section', { class: 'ig-workspace', hidden: !state.file });

  const canvas = el('div', { class: 'ig-canvas' });
  const inspector = el('div', { class: 'ig-inspector' });
  const sourceCard = el('div', { class: 'ig-panel-card ig-source' });
  const controls = el('div', { class: 'ig-controls' });
  const compare = el('div', { class: 'ig-compare' });
  inspector.appendChild(sourceCard);
  inspector.appendChild(controls);
  inspector.appendChild(compare);
  ws.appendChild(canvas);
  ws.appendChild(inspector);

  const hooks = ws as unknown as {
    __renderCanvas: () => void;
    __renderSource: () => void;
    __renderControls: () => void;
    __renderCompare: () => void;
    __refresh: () => void;
  };
  hooks.__renderCanvas = () => {
    canvas.innerHTML = '';
    canvas.appendChild(state.tab === 'crop' ? renderCropPreview(state, root) : renderCompressPreview(state));
  };
  hooks.__renderSource = () => {
    sourceCard.innerHTML = '';
    sourceCard.appendChild(renderSourceCard(state));
  };
  hooks.__renderControls = () => {
    controls.innerHTML = '';
    controls.appendChild(state.tab === 'crop' ? renderCropControls(state, root) : renderCompressControls(state, root));
  };
  hooks.__renderCompare = () => {
    compare.innerHTML = '';
    compare.appendChild(renderCompare(state));
  };
  hooks.__refresh = () => {
    hooks.__renderCanvas();
    hooks.__renderSource();
    hooks.__renderControls();
    hooks.__renderCompare();
  };
  return ws;
}

function renderSourceCard(state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-source-inner' });
  wrap.appendChild(el('h3', { class: 'ig-panel-card-title' }, ['源文件']));
  const grid = el('div', { class: 'ig-source-grid' });
  const mime = state.file?.type ?? '';
  const rows: Array<[string, string]> = [
    ['尺寸', state.srcWidth && state.srcHeight ? `${state.srcWidth} × ${state.srcHeight}` : '—'],
    ['体积', state.file ? formatBytes(state.file.size) : '—'],
    ['格式', mime === 'image/png' ? 'PNG' : mime === 'image/jpeg' ? 'JPEG' : '—'],
    ['比例', formatRatio(state.srcWidth, state.srcHeight)],
  ];
  for (const [label, value] of rows) {
    grid.appendChild(
      el('div', { class: 'ig-source-item' }, [
        el('span', { class: 'ig-source-label' }, [label]),
        el('span', { class: 'ig-source-value' }, [value]),
      ]),
    );
  }
  wrap.appendChild(grid);
  return wrap;
}

// ============ ActionBar：粘性底部 = 摘要 + 主按钮 ============

function renderActionBar(root: HTMLElement, state: State): HTMLElement {
  const bar = el('div', { class: 'ig-actionbar', hidden: !state.file });
  const summary = el('div', { class: 'ig-summary' });
  const actions = el('div', { class: 'ig-actions' });
  bar.appendChild(summary);
  bar.appendChild(actions);

  const hooks = bar as unknown as {
    __renderSummary: () => void;
    __renderActions: () => void;
    __refresh: () => void;
  };
  hooks.__renderSummary = () => {
    summary.innerHTML = '';
    summary.appendChild(renderSummary(state));
  };
  hooks.__renderActions = () => {
    actions.innerHTML = '';
    actions.appendChild(renderActions(state, root));
  };
  hooks.__refresh = () => {
    hooks.__renderSummary();
    hooks.__renderActions();
  };
  return bar;
}

function renderSummary(state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-summary-inner' });
  const srcSize = state.file?.size ?? 0;

  if (state.tab === 'crop') {
    if (state.cropResult) {
      const ratio = ratioPercent(srcSize, state.cropResult.blob.size);
      wrap.appendChild(el('span', { class: 'ig-summary-label' }, ['输出']));
      wrap.appendChild(
        el('span', { class: 'ig-summary-value' }, [`${state.cropResult.w} × ${state.cropResult.h}`]),
      );
      wrap.appendChild(el('span', { class: 'ig-summary-sep' }, ['·']));
      wrap.appendChild(el('span', { class: 'ig-summary-value' }, [formatBytes(state.cropResult.blob.size)]));
      if (ratio !== 0) {
        wrap.appendChild(
          el('span', { class: 'ig-summary-delta', 'data-dir': ratio < 0 ? 'down' : 'up' }, [
            `${ratio < 0 ? '↓' : '↑'} ${Math.abs(ratio)}%`,
          ]),
        );
      }
    } else {
      wrap.appendChild(el('span', { class: 'ig-summary-label' }, ['目标']));
      wrap.appendChild(el('span', { class: 'ig-summary-value' }, [`${state.cropW} × ${state.cropH}`]));
      wrap.appendChild(el('span', { class: 'ig-summary-hint' }, ['拖拽选区或调整宽高后应用']));
    }
  } else if (state.compressResult) {
    const ratio = ratioPercent(srcSize, state.compressResult.blob.size);
    wrap.appendChild(el('span', { class: 'ig-summary-label' }, ['输出']));
    wrap.appendChild(el('span', { class: 'ig-summary-value' }, [formatBytes(state.compressResult.blob.size)]));
    if (ratio !== 0) {
      wrap.appendChild(
        el('span', { class: 'ig-summary-delta', 'data-dir': ratio < 0 ? 'down' : 'up' }, [
          `${ratio < 0 ? '↓' : '↑'} ${Math.abs(ratio)}%`,
        ]),
      );
    }
    wrap.appendChild(el('span', { class: 'ig-summary-sep' }, ['·']));
    wrap.appendChild(el('span', { class: 'ig-summary-hint' }, [`迭代 ${state.compressResult.iterations} 次`]));
  } else {
    wrap.appendChild(el('span', { class: 'ig-summary-label' }, ['目标']));
    wrap.appendChild(el('span', { class: 'ig-summary-value' }, [`${state.targetKB} KB`]));
    wrap.appendChild(el('span', { class: 'ig-summary-sep' }, ['·']));
    wrap.appendChild(el('span', { class: 'ig-summary-hint' }, [`初始质量 ${state.quality}`]));
  }
  return wrap;
}

function renderActions(state: State, root: HTMLElement): HTMLElement {
  const wrap = el('div', { class: 'ig-actions-inner' });
  const label = state.tab === 'crop' ? '应用裁剪' : '开始压缩';
  const goBtn = el(
    'button',
    { type: 'button', class: 'ig-primary btn btn-primary', 'aria-busy': 'false' },
    [el('span', { class: 'ig-btn-label' }, [label])],
  );
  goBtn.addEventListener('click', () => {
    if (state.tab === 'crop') void runCrop(state, root);
    else void runCompress(state, root);
  });
  wrap.appendChild(goBtn);
  return wrap;
}

// ============ Tab 按钮 ============

function tabBtn(tab: Tab, label: string, state: State, root: HTMLElement): HTMLButtonElement {
  const active = state.tab === tab;
  const btn = el(
    'button',
    {
      type: 'button',
      // daisyUI tabs-box 的高亮态类名是 .tab-active；aria-selected 供读屏与 e2e 断言
      class: `ig-tab tab ${active ? 'tab-active' : ''}`,
      role: 'tab',
      'aria-selected': active ? 'true' : 'false',
      'data-tab': tab,
    },
    [label],
  );
  btn.addEventListener('click', () => {
    if (state.tab === tab) return;
    state.tab = tab;
    // 切换 Tab 清掉上次输出与选区，避免误下载
    state.cropResult = null;
    state.compressResult = null;
    state.cropRect = null;
    revokeAllURLs(state);
    refreshAll(root, state);
  });
  return btn;
}

function refreshTabsState(root: HTMLElement, state: State): void {
  root.querySelectorAll<HTMLButtonElement>('.ig-tab').forEach((b) => {
    const t = b.dataset.tab as Tab;
    const active = state.tab === t;
    b.classList.toggle('tab-active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

// ============ Compare：原图 vs 结果 ============

function renderCompare(state: State): HTMLElement {
  const wrap = el('div', { class: 'ig-compare-inner' });
  const srcHref = state.file ? trackedURL(state, state.file) : '';
  wrap.appendChild(
    renderPanel('原图', srcHref, `${state.srcWidth} × ${state.srcHeight}`, formatBytes(state.file?.size ?? 0), null, ''),
  );

  let resultHref = '';
  let resultMeta = '—';
  let resultSize = '—';
  let download: { name: string; blob: Blob } | null = null;

  if (state.tab === 'crop' && state.cropResult) {
    resultHref = trackedURL(state, state.cropResult.blob);
    resultMeta = `${state.cropResult.w} × ${state.cropResult.h}`;
    resultSize = formatBytes(state.cropResult.blob.size);
    download = {
      name: buildOutputName(state.file?.name ?? 'image', 'cropped', inferExt(state.cropResult.blob.type)),
      blob: state.cropResult.blob,
    };
  } else if (state.tab === 'compress' && state.compressResult) {
    resultHref = trackedURL(state, state.compressResult.blob);
    const ratio = ratioPercent(state.file?.size ?? 0, state.compressResult.blob.size);
    const sign = ratio < 0 ? '' : '+';
    resultMeta = `质量 ${Math.round(state.compressResult.quality * 100)} · 迭代 ${state.compressResult.iterations} 次`;
    resultSize = `${formatBytes(state.compressResult.blob.size)}  ${ratio !== 0 ? `(${sign}${ratio}%)` : ''}`;
    download = {
      name: buildOutputName(state.file?.name ?? 'image', 'compressed', inferExt(state.compressResult.blob.type)),
      blob: state.compressResult.blob,
    };
  }
  // 下载链接独立 ObjectURL，与预览图分离便于后续单独 revoke
  const dlHref = download ? trackedURL(state, download.blob) : '';
  wrap.appendChild(renderPanel('结果', resultHref, resultMeta, resultSize, download, dlHref));
  return wrap;
}

function renderPanel(
  label: string,
  href: string,
  meta: string,
  sizeText: string,
  download: { name: string; blob: Blob } | null,
  dlHref: string,
): HTMLElement {
  const card = el('div', { class: 'ig-panel' });
  card.appendChild(el('div', { class: 'ig-panel-label' }, [label]));
  const previewBox = el('div', { class: 'ig-preview' });
  if (href) {
    previewBox.appendChild(el('img', { src: href, alt: `${label}预览`, class: 'ig-preview-img' }));
  } else {
    previewBox.appendChild(el('div', { class: 'ig-preview-empty' }, ['处理后会在这里显示']));
  }
  card.appendChild(previewBox);
  card.appendChild(el('div', { class: 'ig-panel-meta' }, [meta]));
  card.appendChild(el('div', { class: 'ig-panel-size' }, [sizeText]));
  if (download && dlHref) {
    card.appendChild(
      el('a', { href: dlHref, download: download.name, class: 'ig-download btn btn-block btn-sm btn-outline' }, [
        `下载 ${download.name}`,
      ]),
    );
  }
  return card;
}

// ============ 控件：裁剪参数 / 压缩参数 ============

function renderCropControls(state: State, root: HTMLElement): HTMLElement {
  const wrap = el('div', { class: 'ig-control-card' });
  wrap.appendChild(el('h3', {}, ['裁剪参数']));
  const row1 = el('div', { class: 'ig-row' });
  row1.appendChild(
    makeNumberInput('宽 (px)', state.cropW, 1, 10000, (v) => {
      state.cropW = v;
      if (state.cropLock) syncRatio(state, 'w');
      state.cropRect = null;
      refreshPreview(root, state);
    }),
  );
  row1.appendChild(
    makeNumberInput('高 (px)', state.cropH, 1, 10000, (v) => {
      state.cropH = v;
      if (state.cropLock) syncRatio(state, 'h');
      state.cropRect = null;
      refreshPreview(root, state);
    }),
  );
  wrap.appendChild(row1);

  const lockRow = el('div', { class: 'ig-lock-row' });
  const lockBtn = el('button', {
    type: 'button',
    class: `ig-lock btn btn-sm ${state.cropLock ? 'on btn-active' : ''}`,
    'aria-pressed': state.cropLock ? 'true' : 'false',
    title: '锁定宽高比',
  });
  lockBtn.appendChild(
    el('span', {
      class: 'ig-lock-icon',
      'aria-hidden': 'true',
      html: state.cropLock ? ICON.lockClosed : ICON.lockOpen,
    }),
  );
  lockBtn.appendChild(el('span', { class: 'ig-lock-text' }, [state.cropLock ? '已锁定比例' : '锁定比例']));
  lockBtn.addEventListener('click', () => {
    state.cropLock = !state.cropLock;
    refreshWorkspace(root, state);
  });
  lockRow.appendChild(lockBtn);
  if (state.cropLock && state.srcWidth && state.srcHeight) {
    lockRow.appendChild(el('span', { class: 'ig-ratio' }, [`当前比例 ${(state.cropW / state.cropH).toFixed(3)}`]));
  }
  wrap.appendChild(lockRow);
  return wrap;
}

function renderCompressControls(state: State, root: HTMLElement): HTMLElement {
  const wrap = el('div', { class: 'ig-control-card' });
  wrap.appendChild(el('h3', {}, ['压缩参数']));
  const row1 = el('div', { class: 'ig-row' });
  row1.appendChild(
    makeNumberInput('目标体积 (KB)', state.targetKB, 5, 10_000, (v) => {
      state.targetKB = v;
      refreshSummaryOnly(root, state);
    }),
  );
  row1.appendChild(
    makeSlider('初始质量', state.quality, 0, 100, (v) => {
      state.quality = v;
      refreshWorkspace(root, state);
    }),
  );
  wrap.appendChild(row1);
  wrap.appendChild(
    el('p', { class: 'ig-hint' }, [
      'JPEG 输出，初始质量会从设定值开始向下迭代逼近目标体积；达到质量下限仍未达标时，会自动缩放最长边再试。',
    ]),
  );
  return wrap;
}

function syncRatio(state: State, from: 'w' | 'h'): void {
  if (!state.cropLock || !state.srcWidth || !state.srcHeight) return;
  const ratio = state.srcWidth / state.srcHeight;
  if (from === 'w') state.cropH = Math.max(1, Math.round(state.cropW / ratio));
  else state.cropW = Math.max(1, Math.round(state.cropH * ratio));
}

function makeNumberInput(
  label: string,
  value: number,
  min: number,
  max: number,
  onChange: (v: number) => void,
): HTMLElement {
  const wrap = el('label', { class: 'ig-input' });
  wrap.appendChild(el('span', {}, [label]));
  const inp = el('input', {
    type: 'number',
    min,
    max,
    value,
    class: 'ig-number input input-sm',
  }) as HTMLInputElement;
  inp.addEventListener('input', () => {
    const v = Number(inp.value);
    if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
  });
  wrap.appendChild(inp);
  return wrap;
}

function makeSlider(
  label: string,
  value: number,
  min: number,
  max: number,
  onChange: (v: number) => void,
): HTMLElement {
  const wrap = el('label', { class: 'ig-input' });
  wrap.appendChild(el('span', {}, [`${label} ${value}`]));
  const inp = el('input', {
    type: 'range',
    min,
    max,
    value,
    class: 'ig-range range range-sm range-primary',
  }) as HTMLInputElement;
  inp.addEventListener('input', () => {
    const v = Number(inp.value);
    if (Number.isFinite(v)) onChange(v);
  });
  wrap.appendChild(inp);
  return wrap;
}

// ============ 画布预览：裁剪 stage / 压缩 stage ============

function renderCropPreview(state: State, root: HTMLElement): HTMLElement {
  const box = el('div', { class: 'ig-crop-stage' });
  if (!state.bitmap || !state.file) {
    box.appendChild(el('div', { class: 'ig-preview-empty' }, ['请先上传图片']));
    return box;
  }
  box.style.aspectRatio = `${state.srcWidth} / ${state.srcHeight}`;
  box.appendChild(
    el('img', { src: trackedURL(state, state.file), alt: '原图', class: 'ig-stage-img' }),
  );

  const rect = state.cropRect ?? calcCoverRect(state.srcWidth, state.srcHeight, state.cropW, state.cropH, 'cover');
  const pct = {
    left: (rect.x / state.srcWidth) * 100,
    top: (rect.y / state.srcHeight) * 100,
    width: (rect.w / state.srcWidth) * 100,
    height: (rect.h / state.srcHeight) * 100,
  };
  const overlay = el('div', {
    class: 'ig-crop-overlay',
    style: `left:${pct.left}%;top:${pct.top}%;width:${pct.width}%;height:${pct.height}%`,
    role: 'region',
    'aria-label': '可拖拽的裁剪选区',
  });
  const handles: Array<{ cls: string; cursor: string }> = [
    { cls: 'tl', cursor: 'nwse-resize' },
    { cls: 't', cursor: 'ns-resize' },
    { cls: 'tr', cursor: 'nesw-resize' },
    { cls: 'l', cursor: 'ew-resize' },
    { cls: 'r', cursor: 'ew-resize' },
    { cls: 'bl', cursor: 'nesw-resize' },
    { cls: 'b', cursor: 'ns-resize' },
    { cls: 'br', cursor: 'nwse-resize' },
  ];
  for (const h of handles) {
    const node = el('span', { class: `ig-handle ${h.cls}` });
    node.style.cursor = h.cursor;
    overlay.appendChild(node);
  }
  overlay.appendChild(el('span', { class: 'ig-crop-grab' }));
  box.appendChild(overlay);
  box.appendChild(el('div', { class: 'ig-crop-tag' }, [`输出 ${state.cropW} × ${state.cropH}`]));
  attachCropInteraction(box, overlay, state, root);
  return box;
}

function renderCompressPreview(state: State): HTMLElement {
  const box = el('div', { class: 'ig-crop-stage' });
  if (!state.bitmap || !state.file) {
    box.appendChild(el('div', { class: 'ig-preview-empty' }, ['请先上传图片']));
    return box;
  }
  box.style.aspectRatio = `${state.srcWidth} / ${state.srcHeight}`;
  box.appendChild(el('img', { src: trackedURL(state, state.file), alt: '原图', class: 'ig-stage-img' }));
  box.appendChild(
    el('div', { class: 'ig-crop-tag' }, [
      `${state.srcWidth} × ${state.srcHeight} · ${formatBytes(state.file.size)}`,
    ]),
  );
  return box;
}

// ============ 按钮 busy 视觉 ============

function setBusyButton(btn: HTMLButtonElement, busy: boolean, idleLabel: string): void {
  btn.disabled = busy;
  btn.setAttribute('aria-busy', busy ? 'true' : 'false');
  btn.classList.toggle('busy', busy);
  btn.innerHTML = '';
  if (busy) {
    // 用 daisyUI 的 loading spinner 替代手绘 ICON.spinner，动画由 .loading 提供
    btn.appendChild(el('span', { class: 'ig-spinner loading loading-spinner loading-sm', 'aria-hidden': 'true' }));
    btn.appendChild(el('span', { class: 'ig-btn-label' }, ['处理中…']));
  } else {
    btn.appendChild(el('span', { class: 'ig-btn-label' }, [idleLabel]));
  }
}

// ============ 状态刷新钩子 ============

function refreshWorkspace(root: HTMLElement, state: State): void {
  const ws = root.querySelector<HTMLElement>('.ig-workspace');
  if (ws) (ws as unknown as { __refresh: () => void }).__refresh();
  refreshActionBar(root, state);
  refreshTabsState(root, state);
  refreshErrors(root, state);
}

function refreshPreview(root: HTMLElement, state: State): void {
  const ws = root.querySelector<HTMLElement>('.ig-workspace');
  if (ws) (ws as unknown as { __refresh: () => void }).__refresh();
  refreshActionBar(root, state);
  refreshErrors(root, state);
}

function refreshSummaryOnly(root: HTMLElement, state: State): void {
  const bar = root.querySelector<HTMLElement>('.ig-actionbar');
  if (bar) (bar as unknown as { __renderSummary: () => void }).__renderSummary();
}

function refreshActionBar(root: HTMLElement, state: State): void {
  const bar = root.querySelector<HTMLElement>('.ig-actionbar');
  if (bar) (bar as unknown as { __refresh: () => void }).__refresh();
}

/** 上传/Tab 切换/重置后的完整刷新：toolbar + workspace + actionbar + errors。 */
function refreshAll(root: HTMLElement, state: State): void {
  refreshToolbar(root, state);
  refreshWorkspace(root, state);
  refreshErrors(root, state);
  const empty = root.querySelector<HTMLElement>('.ig-empty');
  const ws = root.querySelector<HTMLElement>('.ig-workspace');
  const bar = root.querySelector<HTMLElement>('.ig-actionbar');
  if (empty) empty.hidden = !!state.file;
  if (ws) ws.hidden = !state.file;
  if (bar) bar.hidden = !state.file;
}

// ============ 文件处理与算法执行 ============

async function handleFile(file: File, root: HTMLElement, state: State): Promise<void> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    showError(state, root, '仅支持 JPEG / PNG 图片');
    return;
  }
  if (file.size > MAX_BYTES) {
    showError(state, root, `文件过大（${formatBytes(file.size)}），上限 ${formatBytes(MAX_BYTES)}`);
    return;
  }
  state.cropResult = null;
  state.compressResult = null;
  revokeAllURLs(state);

  try {
    const bmp = await createImageBitmap(file);
    if (bmp.width * bmp.height > MAX_PIXELS) {
      bmp.close();
      showError(state, root, `像素过多（${bmp.width}×${bmp.height}），可能耗尽内存`);
      return;
    }
    if (state.bitmap) state.bitmap.close();
    state.bitmap = bmp;
    state.srcWidth = bmp.width;
    state.srcHeight = bmp.height;
  } catch (e) {
    showError(state, root, `无法解析图片：${(e as Error).message}`);
    return;
  }

  state.file = file;
  if (!state.cropW || !state.cropH) {
    state.cropW = state.srcWidth;
    state.cropH = state.srcHeight;
  }
  state.cropRect = null;
  refreshAll(root, state);
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
  // 完整重渲染最稳（清空 root 后重建整棵树，同时释放所有事件监听）
  root.innerHTML = '';
  root.appendChild(render(root, state));
}

// ============ 错误横幅 ============

function showError(state: State, root: HTMLElement, message: string): void {
  state.errors.push(message);
  refreshErrors(root, state);
}

function refreshErrors(root: HTMLElement, state: State): void {
  const slot = root.querySelector<HTMLElement>('.ig-error-slot');
  if (!slot) return;
  slot.innerHTML = '';
  if (state.errors.length === 0) return;
  for (const msg of state.errors) {
    // alert-soft：daisyUI 的柔和变体，底色是 error 的淡色调，与站点玻璃拟态一致；
    // 默认的 alert-error 是实心红，在这个深色页面上过于吵闹。
    const banner = el('div', { class: 'ig-error alert alert-error alert-soft' });
    banner.appendChild(el('span', { class: 'ig-error-icon', 'aria-hidden': 'true', html: ICON.alert }));
    banner.appendChild(el('span', { class: 'ig-error-text' }, [msg]));
    const close = el('button', {
      type: 'button',
      class: 'ig-error-close btn btn-circle btn-ghost btn-xs',
      'aria-label': '关闭提示',
      html: ICON.close,
    });
    close.addEventListener('click', () => {
      state.errors = state.errors.filter((m) => m !== msg);
      refreshErrors(root, state);
    });
    banner.appendChild(close);
    slot.appendChild(banner);
  }
}

// ============ 算法执行 ============

async function runCrop(state: State, root: HTMLElement): Promise<void> {
  if (!state.bitmap || !state.file || state.busy) return;
  state.busy = true;
  const btn = root.querySelector<HTMLButtonElement>('.ig-actions .ig-primary');
  if (btn) setBusyButton(btn, true, '应用裁剪');
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
    const blob = await new Promise<Blob>((res, rej) => {
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('canvas.toBlob 返回空'))), outType, 0.95);
    });
    state.cropResult = { blob, w: state.cropW, h: state.cropH };
  } catch (e) {
    showError(state, root, `裁剪失败：${(e as Error).message}`);
  } finally {
    state.busy = false;
    refreshWorkspace(root, state);
  }
}

async function runCompress(state: State, root: HTMLElement): Promise<void> {
  if (!state.bitmap || state.busy) return;
  state.busy = true;
  const btn = root.querySelector<HTMLButtonElement>('.ig-actions .ig-primary');
  if (btn) setBusyButton(btn, true, '开始压缩');
  try {
    const targetBytes = state.targetKB * 1024;
    const initialQuality = Math.min(0.99, Math.max(0.3, state.quality / 100));
    const useWorker = typeof Worker !== 'undefined';
    state.compressResult = useWorker
      ? await runCompressInWorker(state, targetBytes, initialQuality)
      : await compressToTarget(state.bitmap, {
          targetBytes,
          initialQuality,
          encode: encodeWithCanvas,
          resize: resizeWithCanvas,
        });
  } catch (e) {
    showError(state, root, `压缩失败：${(e as Error).message}`);
  } finally {
    state.busy = false;
    refreshWorkspace(root, state);
  }
}

function runCompressInWorker(state: State, targetBytes: number, initialQuality: number): Promise<EncodeResult> {
  return new Promise((resolve, reject) => {
    if (!state.bitmap) {
      reject(new Error('no bitmap'));
      return;
    }
    const worker = new Worker(new URL('./image-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const msg = ev.data as { ok: boolean; result?: EncodeResult; message?: string };
      if (msg.ok && msg.result) resolve(msg.result);
      else reject(new Error(msg.message ?? 'worker failed'));
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(new Error(e.message || 'worker error'));
      worker.terminate();
    };
    const cloned = state.bitmap;
    worker.postMessage(
      { bitmap: cloned, targetBytes, initialQuality, mime: 'image/jpeg', maxQualityIters: 8, maxDownscaleIters: 3 },
      [cloned],
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
  return new Promise<Blob>((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), mime, quality);
  });
}

async function resizeWithCanvas(bitmap: ImageBitmap, longestEdge: number): Promise<ImageBitmap> {
  const ratio = longestEdge / Math.max(bitmap.width, bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas context（缩放）');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return createImageBitmap(canvas);
}
