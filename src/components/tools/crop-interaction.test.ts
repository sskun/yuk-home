import { describe, it, expect } from 'vitest';
import { moveOrResize, clampRect, type CropInteractionState } from './crop-interaction';

// 源图 2400×1600，输出 800×600（4:3）
const base: CropInteractionState = { srcWidth: 2400, srcHeight: 1600, cropW: 800, cropH: 600, cropRect: null, busy: false };
const ratioOf = (r: { w: number; h: number }) => r.w / r.h;
const inside = (r: { x: number; y: number; w: number; h: number }, s = base) =>
  r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= s.srcWidth + 1e-6 && r.y + r.h <= s.srcHeight + 1e-6;

describe('moveOrResize：缩放始终保持输出比例', () => {
  const start = { x: 400, y: 200, w: 800, h: 600 };

  it.each(['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'] as const)('把手 %s 缩小后比例不变且在边界内', (mode) => {
    const r = moveOrResize(mode, start, -120, -90, base);
    expect(ratioOf(r)).toBeCloseTo(4 / 3, 6);
    expect(inside(r)).toBe(true);
  });

  it('右边把手向左拖会缩小（竖版输出也生效，旧实现会被回弹）', () => {
    const portrait = { ...base, cropW: 600, cropH: 900 };
    const r = moveOrResize('r', { x: 400, y: 200, w: 600, h: 900 }, -200, 0, portrait);
    expect(r.w).toBeCloseTo(400, 6);
    expect(r.h).toBeCloseTo(600, 6);
    expect(r.x).toBe(400);
  });

  it('右下角拖出图片边界时被限制在源图内，左上角锚点不动', () => {
    const r = moveOrResize('br', start, 5000, 5000, base);
    expect(r.x).toBe(400);
    expect(r.y).toBe(200);
    expect(inside(r)).toBe(true);
    expect(ratioOf(r)).toBeCloseTo(4 / 3, 6);
  });

  it('缩到极小时不低于最小边长', () => {
    const r = moveOrResize('br', start, -5000, -5000, base);
    expect(Math.min(r.w, r.h)).toBeGreaterThanOrEqual(8 - 1e-6);
  });
});

describe('moveOrResize / clampRect：平移', () => {
  it('平移超出边界时被推回，尺寸不变', () => {
    const r = moveOrResize('move', { x: 2000, y: 1400, w: 800, h: 600 }, 500, 500, base);
    expect(r).toEqual({ x: 1600, y: 1000, w: 800, h: 600 });
  });
  it('尺寸大于源图时等比缩小', () => {
    const r = clampRect({ x: 0, y: 0, w: 4000, h: 3000 }, base);
    expect(ratioOf(r)).toBeCloseTo(4 / 3, 6);
    expect(inside(r)).toBe(true);
  });
});
