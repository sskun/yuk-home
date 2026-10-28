// 裁剪选区的指针交互层：拖拽平移 + 8 个把手缩放 + 边界约束 + 覆盖层绘制。
// 从 ImageGovernance.ts 抽出，主文件专注状态与渲染编排，本模块只处理 pointer 事件与几何变换。
//
// 前置：调用方传入 stage（外层容器）、overlay（选区 DOM）、共享 state、根节点。
// 后置：overlay 的 style.left/top/width/height 会随拖拽实时更新；state.cropRect 同步更新。

import type { Rect } from '../../lib/image-tools/crop';
import { calcCoverRect } from '../../lib/image-tools/crop';

/** 拖拽模式：8 个缩放把手 + 中央平移。 */
export type HandleMode = 'tl' | 't' | 'tr' | 'l' | 'r' | 'bl' | 'b' | 'br' | 'move';

/** 交互所需的最小 state 视图，避免与 ImageGovernance 的完整 State 循环依赖。 */
export interface CropInteractionState {
  srcWidth: number;
  srcHeight: number;
  cropW: number;
  cropH: number;
  /** 仅为与主 State 结构兼容保留；选区缩放始终保持输出比例 */
  cropLock?: boolean;
  cropRect: Rect | null;
  busy: boolean;
}

/**
 * 给 stage + overlay 绑定 Pointer Events。
 * 前置：overlay 已插入 stage 内，state.srcWidth/Height 已就绪。
 * 后置：拖拽/缩放时更新 state.cropRect 与 overlay 样式。
 */
export function attachCropInteraction(
  stage: HTMLElement,
  overlay: HTMLElement,
  state: CropInteractionState,
  root: HTMLElement,
): void {
  let active: { mode: HandleMode; startX: number; startY: number; startRect: Rect } | null = null;

  function stageRect(): DOMRect {
    return stage.getBoundingClientRect();
  }

  function currentRect(): Rect {
    return state.cropRect ?? calcCoverRect(state.srcWidth, state.srcHeight, state.cropW, state.cropH, 'cover');
  }

  function modeFromTarget(target: EventTarget | null): HandleMode | null {
    if (!(target instanceof HTMLElement)) return null;
    // 把手内部可能有装饰子元素，向上找到最近的把手 / 选区
    const handle = target.closest<HTMLElement>('.ig-handle');
    if (handle) {
      const cls = Array.from(handle.classList).find((c) => /^(tl|t|tr|l|r|bl|b|br)$/.test(c));
      if (cls) return cls as HandleMode;
    }
    if (target.closest('.ig-crop-overlay')) return 'move';
    return null;
  }

  function endDrag() {
    active = null;
    overlay.classList.remove('dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  function onPointerDown(ev: PointerEvent) {
    if (state.busy) return;
    const mode = modeFromTarget(ev.target);
    if (!mode) return;
    ev.preventDefault();
    active = { mode, startX: ev.clientX, startY: ev.clientY, startRect: currentRect() };
    overlay.classList.add('dragging');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(ev: PointerEvent) {
    if (!active) return;
    const sr = stageRect();
    if (sr.width <= 0 || sr.height <= 0) return;
    const dx = ((ev.clientX - active.startX) / sr.width) * state.srcWidth;
    const dy = ((ev.clientY - active.startY) / sr.height) * state.srcHeight;
    const next = moveOrResize(active.mode, active.startRect, dx, dy, state);
    state.cropRect = next;
    paintOverlay(overlay, next, state);
  }

  function onPointerUp() {
    if (active) endDrag();
  }

  // 键盘可达：方向键平移选区，Shift 加速
  function onKeyDown(ev: KeyboardEvent) {
    if (state.busy) return;
    const step = Math.max(1, Math.round(Math.max(state.srcWidth, state.srcHeight) * (ev.shiftKey ? 0.05 : 0.01)));
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[ev.key];
    if (!d) return;
    ev.preventDefault();
    const next = moveOrResize('move', currentRect(), d[0], d[1], state);
    state.cropRect = next;
    paintOverlay(overlay, next, state);
  }
  overlay.addEventListener('keydown', onKeyDown);
  overlay.addEventListener('pointerdown', onPointerDown);
  overlay.addEventListener('selectstart', (e) => e.preventDefault());
  // 兜底：父层刷新时清理监听
  root.addEventListener('igcleanup', endDrag, { once: true });
}

/**
 * 按拖拽模式返回移动或缩放后的矩形，结果已限制在源图边界内。
 *
 * 缩放时选区始终保持输出宽高比（cropW:cropH）：输出尺寸是固定的，
 * 若允许自由比例，最终 drawImage 会把选区拉伸/压扁到输出尺寸。
 * 锚点（被拖把手的对边/对角）保持不动；边中点把手以另一轴的中线为锚。
 */
export function moveOrResize(
  mode: HandleMode,
  r: Rect,
  dx: number,
  dy: number,
  state: CropInteractionState,
): Rect {
  if (mode === 'move') {
    return clampRect({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }, state);
  }
  const ratio = state.cropW > 0 && state.cropH > 0 ? state.cropW / state.cropH : r.w / r.h;
  // 每个把手在 x / y 方向上的扩展方向：1 向右/下，-1 向左/上，0 以中线为锚居中扩展
  const sx = mode.includes('r') ? 1 : mode.includes('l') ? -1 : 0;
  const sy = mode.includes('b') ? 1 : mode.includes('t') ? -1 : 0;
  // 锚点
  const ax = sx === 1 ? r.x : sx === -1 ? r.x + r.w : r.x + r.w / 2;
  const ay = sy === 1 ? r.y : sy === -1 ? r.y + r.h : r.y + r.h / 2;

  // 期望宽度：角把手取两个方向中扩张更多的一边，边把手只看被拖的轴
  const wByX = r.w + sx * dx;
  const wByY = (r.h + sy * dy) * ratio;
  let w = sx !== 0 && sy !== 0 ? Math.max(wByX, wByY) : sx !== 0 ? wByX : wByY;

  // 从锚点出发可用的最大空间
  const maxW = sx === 1 ? state.srcWidth - ax : sx === -1 ? ax : 2 * Math.min(ax, state.srcWidth - ax);
  const maxH = sy === 1 ? state.srcHeight - ay : sy === -1 ? ay : 2 * Math.min(ay, state.srcHeight - ay);
  const minSide = 8;
  const minW = Math.max(minSide, minSide * ratio);
  w = Math.min(w, maxW, maxH * ratio);
  w = Math.max(w, Math.min(minW, maxW, maxH * ratio));
  const h = w / ratio;

  const x = sx === 1 ? ax : sx === -1 ? ax - w : ax - w / 2;
  const y = sy === 1 ? ay : sy === -1 ? ay - h : ay - h / 2;
  return { x, y, w, h };
}

/** 平移用：保持尺寸不变，把矩形推回源图边界内；尺寸超出时等比缩小。 */
export function clampRect(r: Rect, state: CropInteractionState): Rect {
  let { x, y, w, h } = r;
  const scale = Math.min(1, state.srcWidth / w, state.srcHeight / h);
  w *= scale;
  h *= scale;
  x = Math.max(0, Math.min(state.srcWidth - w, x));
  y = Math.max(0, Math.min(state.srcHeight - h, y));
  return { x, y, w, h };
}

/** 用像素矩形刷新 overlay 的百分比定位。 */
export function paintOverlay(overlay: HTMLElement, rect: Rect, state: CropInteractionState): void {
  const pct = {
    left: (rect.x / state.srcWidth) * 100,
    top: (rect.y / state.srcHeight) * 100,
    width: (rect.w / state.srcWidth) * 100,
    height: (rect.h / state.srcHeight) * 100,
  };
  overlay.style.left = `${pct.left}%`;
  overlay.style.top = `${pct.top}%`;
  overlay.style.width = `${pct.width}%`;
  overlay.style.height = `${pct.height}%`;
}
