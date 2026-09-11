// 压缩迭代策略（纯函数 + 可注入的编码器，便于主线程和 Worker 复用）。
// 设计目标：在保证可接受画质的前提下逼近目标体积，迭代失败时回退到「缩放最长边」再试。

export interface EncodeResult {
  blob: Blob;
  quality: number;
  /** 经过的迭代次数（用于 UI 展示） */
  iterations: number;
  /** 是否触发了缩放回退 */
  downscaled: boolean;
}

export interface CompressOptions {
  /** 目标字节数 */
  targetBytes: number;
  /** 起始质量（0-1），默认 0.92 */
  initialQuality?: number;
  /** 质量最低仍超过目标时的缩放步长（0-1），默认 0.9 */
  scaleStep?: number;
  /** 单次质量迭代最多尝试次数（缩放前），默认 8 */
  maxQualityIters?: number;
  /** 缩放回退最多尝试次数，默认 3 */
  maxDownscaleIters?: number;
  /** 输出 MIME，默认 image/jpeg */
  mime?: string;
  /** 编码器：传入位图，返回 Blob。Worker 用 OffscreenCanvas.convertToBlob；主线程用 canvas.toBlob */
  encode: (bitmap: ImageBitmap, mime: string, quality: number) => Promise<Blob>;
  /** 在每次缩放前调用，返回新的 ImageBitmap。原图被持有，调用方负责关闭。 */
  resize?: (bitmap: ImageBitmap, longestEdge: number) => Promise<ImageBitmap>;
}

const DEFAULTS = {
  initialQuality: 0.92,
  scaleStep: 0.9,
  maxQualityIters: 8,
  maxDownscaleIters: 3,
  mime: 'image/jpeg',
};

/** 收敛到目标体积。返回最后一次成功编码的 Blob（即便未达标也返回最小质量 + 最大缩放的结果） */
export async function compressToTarget(
  source: ImageBitmap,
  options: CompressOptions,
): Promise<EncodeResult> {
  const {
    targetBytes,
    encode,
    resize,
    mime = DEFAULTS.mime,
    initialQuality = DEFAULTS.initialQuality,
    maxQualityIters = DEFAULTS.maxQualityIters,
    maxDownscaleIters = DEFAULTS.maxDownscaleIters,
    scaleStep = DEFAULTS.scaleStep,
  } = options;

  if (targetBytes <= 0) throw new Error('compressToTarget: targetBytes 必须为正');
  if (!encode) throw new Error('compressToTarget: 必须提供 encode 编码器');

  let current = source;
  let longestEdge = Math.max(current.width, current.height);
  let best: EncodeResult | null = null;
  let totalIters = 0;

  for (let scaleRound = 0; scaleRound <= maxDownscaleIters; scaleRound++) {
    let q = initialQuality;
    for (let i = 0; i < maxQualityIters; i++) {
      totalIters++;
      const blob = await encode(current, mime, q);
      const result: EncodeResult = {
        blob,
        quality: q,
        iterations: totalIters,
        downscaled: scaleRound > 0,
      };
      // 记录当前最小体积（用于迭代完未达标时兜底）
      if (!best || blob.size < best.blob.size) best = result;

      if (blob.size <= targetBytes) return result;

      // 步进：降幅按剩余超出比例调整
      const overshoot = blob.size / targetBytes;
      const drop = overshoot > 2 ? 0.15 : overshoot > 1.3 ? 0.1 : 0.06;
      q = Math.max(0.3, q - drop);
    }

    // 质量已降到最低仍未达标：缩放最长边再试
    if (!resize || scaleRound === maxDownscaleIters) break;
    longestEdge = Math.max(1, Math.round(longestEdge * scaleStep));
    current = await resize(current, longestEdge);
  }

  // 走到这里说明没达标，返回迭代过程中体积最小的结果
  // best 持有最后一次更新时的 iterations，但用户期望的"总迭代次数"用 totalIters 更直观
  if (!best) throw new Error('compressToTarget: 未能产出任何编码结果');
  return { ...best, iterations: totalIters };
}
