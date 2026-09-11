// Web Worker：在后台线程执行图像压缩迭代，避免主线程卡顿。
// 协议：postMessage 传入 { bitmap, targetBytes, initialQuality }；回 { blob, quality, iterations, downscaled }
// bitmap 通过 transferable 传入（[bitmap]），主线程不再持有该 bitmap。
// 输出 blob 也通过 transferable 传出（[blob]）。

/// <reference lib="webworker" />

import { compressToTarget, type EncodeResult } from '../../lib/image-tools/compress';

interface CompressRequest {
  bitmap: ImageBitmap;
  targetBytes: number;
  initialQuality?: number;
  mime?: string;
  maxQualityIters?: number;
  maxDownscaleIters?: number;
}

interface CompressResponse {
  ok: true;
  result: EncodeResult;
}
interface CompressError {
  ok: false;
  message: string;
}

async function encodeWithOffscreen(bitmap: ImageBitmap, mime: string, quality: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('worker: 无法获取 OffscreenCanvas 2d context');
  ctx.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: mime, quality });
}

async function resizeWithOffscreen(bitmap: ImageBitmap, longestEdge: number): Promise<ImageBitmap> {
  const ratio = longestEdge / Math.max(bitmap.width, bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('worker: 无法获取 OffscreenCanvas 2d context（缩放）');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.transferToImageBitmap();
}

self.addEventListener('message', async (ev: MessageEvent<CompressRequest>) => {
  const { bitmap, targetBytes, initialQuality, mime, maxQualityIters, maxDownscaleIters } = ev.data;
  try {
    const result = await compressToTarget(bitmap, {
      targetBytes,
      initialQuality,
      mime,
      maxQualityIters,
      maxDownscaleIters,
      encode: encodeWithOffscreen,
      resize: resizeWithOffscreen,
    });
    const ok: CompressResponse = { ok: true, result };
    (self as DedicatedWorkerGlobalScope).postMessage(ok, []);
  } catch (e) {
    const err: CompressError = { ok: false, message: (e as Error).message ?? 'worker error' };
    (self as DedicatedWorkerGlobalScope).postMessage(err);
  }
});

export {};
