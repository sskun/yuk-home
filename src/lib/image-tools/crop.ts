// 纯函数：给定原图尺寸 + 目标尺寸 + 适配模式，计算源图上要裁剪的矩形。
// 不依赖 DOM，可独立单测；UI 层拿到结果后用 drawImage 渲染。

export type CropMode = 'cover' | 'contain' | 'stretch';

/** 矩形（左上角 + 宽高，像素） */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 计算源图上需要裁剪的矩形（输出像素 == targetW × targetH） */
export function calcCoverRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  mode: CropMode = 'cover',
): Rect {
  if (srcW <= 0 || srcH <= 0 || targetW <= 0 || targetH <= 0) {
    throw new Error('calcCoverRect: 尺寸必须为正');
  }

  if (mode === 'stretch') {
    return { x: 0, y: 0, w: srcW, h: srcH };
  }

  // contain：完整保留原图，按比例缩放到目标框内，留白由 UI 决定底色
  if (mode === 'contain') {
    return { x: 0, y: 0, w: srcW, h: srcH };
  }

  // cover：保持目标比例，中心裁剪。源图裁剪框比例 == targetW/targetH
  const targetRatio = targetW / targetH;
  const srcRatio = srcW / srcH;

  let w: number;
  let h: number;
  if (srcRatio > targetRatio) {
    // 源图更宽：按高度裁，宽度收窄到 targetRatio
    h = srcH;
    w = Math.round(srcH * targetRatio);
  } else {
    // 源图更高：按宽度裁
    w = srcW;
    h = Math.round(srcW / targetRatio);
  }

  return {
    x: Math.round((srcW - w) / 2),
    y: Math.round((srcH - h) / 2),
    w,
    h,
  };
}

/** 给定预览容器尺寸与原图比例，计算缩放后原图在容器内的实际显示尺寸（contain） */
export function fitInside(boxW: number, boxH: number, srcW: number, srcH: number): Rect {
  if (boxW <= 0 || boxH <= 0 || srcW <= 0 || srcH <= 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  const boxRatio = boxW / boxH;
  const srcRatio = srcW / srcH;
  let w: number;
  let h: number;
  if (srcRatio > boxRatio) {
    w = boxW;
    h = Math.round(boxW / srcRatio);
  } else {
    h = boxH;
    w = Math.round(boxH * srcRatio);
  }
  return {
    x: Math.round((boxW - w) / 2),
    y: Math.round((boxH - h) / 2),
    w,
    h,
  };
}
