import { describe, it, expect } from 'vitest';
import { compressToTarget } from './compress';

// 用 fake encode 模拟「高质量 → 大体积，低质量 → 小体积」的单调关系，避免依赖浏览器 ImageBitmap。
function makeFakeBitmap(): ImageBitmap {
  return { width: 1000, height: 800, close() {} } as unknown as ImageBitmap;
}

// fake encoder：体积随 quality 单调递减；忽略 bitmap 实际像素数（compress 测试只关心收敛逻辑）
// quality=1.0 → 220_000B；quality=0.92 → 204_000B；quality=0.5 → 120_000B；quality=0.3 → 80_000B
function fakeEncode(_bitmap: ImageBitmap, _mime: string, quality: number): Promise<Blob> {
  const size = Math.round(quality * 200_000 + 20_000);
  return Promise.resolve(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }));
}

// 缩放后体积按面积衰减：width*height 与原始 1000*800 的比例平方（粗略近似）
function fakeResize(b: ImageBitmap, longestEdge: number): Promise<ImageBitmap> {
  const cur = Math.max(b.width as unknown as number, b.height as unknown as number);
  const ratio = longestEdge / cur;
  return Promise.resolve({
    ...b,
    width: Math.round((b.width as unknown as number) * ratio),
    height: Math.round((b.height as unknown as number) * ratio),
  } as unknown as ImageBitmap);
}

// encoder 对缩放后 bitmap 也按 fakeEncode 算体积，但乘一个「像素比」模拟实际尺寸影响
function fakeEncodeScaled(_bitmap: ImageBitmap, _mime: string, quality: number): Promise<Blob> {
  // 用像素比：fake bitmap 缩放后面积比
  const bmp = _bitmap as unknown as { width: number; height: number };
  const ratio = Math.sqrt((bmp.width * bmp.height) / (1000 * 800));
  const size = Math.round((quality * 200_000 + 20_000) * ratio);
  return Promise.resolve(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }));
}

describe('compressToTarget', () => {
  it('一次成功：高质量即达标时返回首次结果', async () => {
    const bitmap = makeFakeBitmap();
    const result = await compressToTarget(bitmap, {
      targetBytes: 250_000,
      encode: fakeEncode,
    });
    expect(result.iterations).toBe(1);
    expect(result.blob.size).toBeLessThanOrEqual(250_000);
    expect(result.downscaled).toBe(false);
  });

  it('迭代收敛：目标很小需要多次降质量', async () => {
    const bitmap = makeFakeBitmap();
    const result = await compressToTarget(bitmap, {
      targetBytes: 80_000,
      encode: fakeEncode,
      initialQuality: 0.92,
      maxQualityIters: 8,
    });
    expect(result.iterations).toBeGreaterThan(1);
    expect(result.blob.size).toBeLessThanOrEqual(80_000);
  });

  it('未达标但能缩放：触发 downscaled 并最终收敛', async () => {
    const bitmap = makeFakeBitmap();
    let resized = false;
    const result = await compressToTarget(bitmap, {
      targetBytes: 85_000,
      encode: fakeEncodeScaled,
      initialQuality: 0.5,
      maxQualityIters: 2,
      maxDownscaleIters: 5,
      resize: async (b, longestEdge) => {
        resized = true;
        return fakeResize(b, longestEdge);
      },
    });
    expect(resized).toBe(true);
    expect(result.downscaled).toBe(true);
    expect(result.blob.size).toBeLessThanOrEqual(85_000);
  });

  it('不允许缩放且始终超目标时返回迭代过程中体积最小的结果', async () => {
    const bitmap = makeFakeBitmap();
    const result = await compressToTarget(bitmap, {
      targetBytes: 5_000,
      initialQuality: 0.92, // 显式指定以便预期值稳定
      encode: fakeEncode,
      maxQualityIters: 8,
      maxDownscaleIters: 0,
      resize: undefined, // 不允许缩放
    });
    // initialQuality 0.92 → 质量降至下限 0.3 的过程中最小体积
    // fakeEncode(0.3) = round(0.3 * 200_000 + 20_000) = 80_000
    expect(result.blob.size).toBe(80_000);
    expect(result.downscaled).toBe(false);
    expect(result.iterations).toBe(8);
  });

  it('非法 targetBytes 抛错', async () => {
    await expect(compressToTarget(makeFakeBitmap(), { targetBytes: 0, encode: fakeEncode })).rejects.toThrow();
    await expect(
      compressToTarget(makeFakeBitmap(), { targetBytes: -1, encode: fakeEncode }),
    ).rejects.toThrow();
  });
});
