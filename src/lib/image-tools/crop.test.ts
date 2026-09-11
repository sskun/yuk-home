import { describe, it, expect } from 'vitest';
import { calcCoverRect, fitInside } from './crop';

describe('calcCoverRect', () => {
  it('cover 模式：源图更宽时，按高度裁，左右各裁掉一半', () => {
    // 400x200 源图，要裁成 1x1（正方形）：按高度对齐高度 200，宽度 = 200 * 1 = 200，左右各裁 100
    const r = calcCoverRect(400, 200, 1, 1, 'cover');
    expect(r).toEqual({ x: 100, y: 0, w: 200, h: 200 });
  });

  it('cover 模式：源图更高时，按宽度裁，上下各裁掉一半', () => {
    // 200x400 源图，要裁成 1x1：宽度 200，高度 = 200 / 1 = 200，上下各裁 100
    const r = calcCoverRect(200, 400, 1, 1, 'cover');
    expect(r).toEqual({ x: 0, y: 100, w: 200, h: 200 });
  });

  it('cover 模式：源图比例与目标完全一致时，整张图被选中', () => {
    const r = calcCoverRect(800, 400, 200, 100, 'cover');
    expect(r).toEqual({ x: 0, y: 0, w: 800, h: 400 });
  });

  it('cover 模式：非整数比例正确四舍五入', () => {
    // 1000x300 源图 → 2x1（比例 2）：按宽度裁 h = 1000/2 = 500 > 300，
    // 因为 srcRatio = 1000/300 ≈ 3.33 > targetRatio = 2，走高度裁分支，w = 300*2 = 600
    const r = calcCoverRect(1000, 300, 2, 1, 'cover');
    expect(r.w + r.x * 2).toBe(1000);
    expect(r.h).toBe(300);
    expect(r.x).toBe(200);
  });

  it('contain / stretch 模式：返回原图矩形', () => {
    const r1 = calcCoverRect(800, 600, 200, 200, 'contain');
    expect(r1).toEqual({ x: 0, y: 0, w: 800, h: 600 });
    const r2 = calcCoverRect(800, 600, 200, 200, 'stretch');
    expect(r2).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  it('非法尺寸应抛错', () => {
    expect(() => calcCoverRect(0, 100, 50, 50)).toThrow();
    expect(() => calcCoverRect(100, 100, 0, 50)).toThrow();
    expect(() => calcCoverRect(-1, 100, 50, 50)).toThrow();
  });
});

describe('fitInside', () => {
  it('源图更宽：宽度对齐，按比例缩高度', () => {
    // box 400x200，源 800x100：srcRatio=8 > boxRatio=2 → w=400, h=400/8=50
    const r = fitInside(400, 200, 800, 100);
    expect(r).toEqual({ x: 0, y: 75, w: 400, h: 50 });
  });

  it('源图更高：高度对齐，按比例缩宽度', () => {
    // box 400x200，源 100x800：srcRatio=0.125 < boxRatio=2 → h=200, w=200*0.125=25
    // x = round((400-25)/2) = round(187.5) = 188
    const r = fitInside(400, 200, 100, 800);
    expect(r).toEqual({ x: 188, y: 0, w: 25, h: 200 });
  });

  it('比例完全一致时居中铺满', () => {
    const r = fitInside(400, 200, 800, 400);
    expect(r).toEqual({ x: 0, y: 0, w: 400, h: 200 });
  });

  it('非法尺寸返回零矩形', () => {
    expect(fitInside(0, 100, 100, 100)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(fitInside(100, 100, 0, 100)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
