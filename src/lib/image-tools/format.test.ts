import { describe, it, expect } from 'vitest';
import { formatBytes, ratioPercent, inferExt, buildOutputName } from './format';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [10240, '10 KB'],
    [100 * 1024, '100 KB'],
    [1024 * 1024, '1 MB'],
    [5.5 * 1024 * 1024, '5.5 MB'],
  ])('formatBytes(%i) === %s', (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });

  it('非法输入返回占位', () => {
    expect(formatBytes(NaN)).toBe('—');
    expect(formatBytes(-1)).toBe('—');
  });
});

describe('ratioPercent', () => {
  it('正变化（变大）返回正数', () => {
    expect(ratioPercent(100, 150)).toBe(50);
  });
  it('负变化（变小）返回负数', () => {
    expect(ratioPercent(1000, 150)).toBe(-85);
  });
  it('相等返回 0', () => {
    expect(ratioPercent(100, 100)).toBe(0);
  });
  it('0 / 非法输入返回 0', () => {
    expect(ratioPercent(0, 100)).toBe(0);
    expect(ratioPercent(NaN, 100)).toBe(0);
  });
});

describe('inferExt', () => {
  it('image/jpeg → jpg', () => expect(inferExt('image/jpeg')).toBe('jpg'));
  it('image/png → png', () => expect(inferExt('image/png')).toBe('png'));
  it('image/webp → webp', () => expect(inferExt('image/webp')).toBe('webp'));
  it('未知 MIME 回退到文件名后缀', () => {
    expect(inferExt('application/octet-stream', 'photo.tiff')).toBe('tiff');
  });
  it('未知 MIME 且无后缀 → bin', () => {
    expect(inferExt('application/octet-stream')).toBe('bin');
  });
});

describe('buildOutputName', () => {
  it('替换扩展名并追加后缀', () => {
    expect(buildOutputName('photo.png', 'cropped', 'jpg')).toBe('photo-cropped.jpg');
  });
  it('无扩展名时仍正常追加', () => {
    expect(buildOutputName('my-photo', 'compressed', 'webp')).toBe('my-photo-compressed.webp');
  });
});
