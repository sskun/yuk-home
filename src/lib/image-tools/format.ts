// 图像处理相关的小工具：字节格式化、文件类型推断、MIME 辅助。
// 纯函数、可在 worker / 主线程两侧复用，无副作用。

/** 将字节数格式化为人类可读字符串（KB / MB），整数 KB/MB 不带小数 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    // ≥100 KB 时省小数，否则保留 1 位
    const rounded = Math.round(kb);
    return Number.isInteger(kb) || rounded >= 100 ? `${rounded} KB` : `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  const roundedMb = Math.round(mb);
  return Number.isInteger(mb) || roundedMb >= 100 ? `${roundedMb} MB` : `${mb.toFixed(1)} MB`;
}

/** 体积变化百分比：返回 -85 表示减少 85%。正数代表变大（理论上不会发生）。 */
export function ratioPercent(before: number, after: number): number {
  if (!Number.isFinite(before) || before <= 0) return 0;
  return Math.round(((after - before) / before) * 100);
}

/** 给定 MIME 与原始文件名，推断输出扩展名（如 image/jpeg → jpg） */
export function inferExt(mime: string, originalName?: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  // 兜底：用原始文件名后缀
  if (originalName) {
    const m = /\.([a-zA-Z0-9]+)$/.exec(originalName);
    if (m) return m[1].toLowerCase();
  }
  return 'bin';
}

/** 在原文件名基础上生成输出文件名：foo.png → foo-cropped.jpg */
export function buildOutputName(originalName: string, suffix: string, ext: string): string {
  const dot = originalName.lastIndexOf('.');
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${base}-${suffix}.${ext}`;
}
