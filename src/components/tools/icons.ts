// 站点统一的 inline SVG 图标集：与 Heroicons / Lucide 同款 24x24 viewBox。
// 抽出到独立模块避免主组件文件被大量 SVG 字符串撑大；stroke-width 统一 1.6，视觉协调。

const svg = (paths: string, opts = { fill: 'none', stroke: 'currentColor', width: 1.6 }): string =>
  `<svg viewBox="0 0 24 24" fill="${opts.fill}" stroke="${opts.stroke}" stroke-width="${opts.width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICON = {
  /** 文件夹开：上传区大图标。 */
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  /** 图片：文件 chip 未上传态。 */
  image: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-5 4 4 3-2 4 4"/>'),
  /** 锁打开：比例未锁定。 */
  lockOpen: svg('<rect x="4.5" y="11" width="15" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>'),
  /** 锁关闭：比例已锁定。 */
  lockClosed: svg('<rect x="4.5" y="11" width="15" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0"/>'),
  /** 加载圆环：旋转由 CSS `.ig-spinner` 控制。 */
  spinner: svg('<path d="M21 12a9 9 0 1 1-3.5-7.1"/>', { fill: 'none', stroke: 'currentColor', width: 2 }),
  /** 错误三角 + 叹号：错误横幅。 */
  alert: svg('<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4"/><circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none"/>'),
  /** 关闭 X：错误横幅、文件 chip 清除。 */
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>', { fill: 'none', stroke: 'currentColor', width: 1.8 }),
  /** 左箭头：面包屑返回。 */
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  /** 逆时针旋转箭头：换一张。 */
  reset: svg('<path d="M3.5 12a8.5 8.5 0 1 0 3-6.5"/><path d="M3.5 4.5V10H9"/>'),
  /** 下载：结果面板下载链接（备用）。 */
  download: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/>'),
} as const;

export type IconName = keyof typeof ICON;
