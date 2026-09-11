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
  cropLock: boolean;
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
    if (target.classList.contains('ig-crop-grab')) return 'move';
    const cls = Array.from(target.classList).find((c) => /^(tl|t|tr|l|r|bl|b|br)$/.test(c));
    return (cls as HandleMode | undefined) ?? null;
  }

  function endDrag() {
    active = null;
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
    const next = clampRect(moveOrResize(active.mode, active.startRect, dx, dy, state), state);
    state.cropRect = next;
    paintOverlay(overlay, next, state);
  }

  function onPointerUp() {
    if (active) endDrag();
  }

  overlay.addEventListener('pointerdown', onPointerDown);
  overlay.addEventListener('selectstart', (e) => e.preventDefault());
  // 兜底：父层刷新时清理监听
  root.addEventListener('igcleanup', endDrag, { once: true });
}

/** 按拖拽模式返回移动或缩放后的矩形（未做边界裁剪）。 */
export function moveOrResize(
  mode: HandleMode,
  r: Rect,
  dx: number,
  dy: number,
  state: CropInteractionState,
): Rect {
  if (mode === 'move') {
    return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };
  }
  let { x, y, w, h } = r;
  if (mode === 'tl') { w -= dx; h -= dy; x += dx; y += dy; }
  else if (mode === 'tr') { w += dx; h -= dy; y += dy; }
  else if (mode === 'bl') { w -= dx; h += dy; x += dx; }
  else if (mode === 'br') { w += dx; h += dy; }
  else if (mode === 't') { h -= dy; y += dy; }
  else if (mode === 'b') { h += dy; }
  else if (mode === 'l') { w -= dx; x += dx; }
  else if (mode === 'r') { w += dx; }

  if (state.cropLock) {
    const targetRatio = state.cropW / state.cropH;
    const wFromH = h * targetRatio;
    const hFromW = w / targetRatio;
    if (Math.abs(wFromH - w) < Math.abs(hFromW - h)) {
      const newW = Math.max(1, wFromH);
      const dw = newW - w;
      if (mode === 'tl' || mode === 'bl' || mode === 'l') x -= dw;
      w = newW;
    } else {
      const newH = Math.max(1, hFromW);
      const dh = newH - h;
      if (mode === 'tl' || mode === 'tr' || mode === 't') y -= dh;
      h = newH;
    }
  }
  return { x, y, w, h };
}

/** 把矩形限制在源图边界内，保证最小边长 8px。 */
export function clampRect(r: Rect, state: CropInteractionState): Rect {
  const minSide = 8;
  let { x, y, w, h } = r;
  w = Math.max(minSide, Math.min(state.srcWidth, w));
  h = Math.max(minSide, Math.min(state.srcHeight, h));
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
