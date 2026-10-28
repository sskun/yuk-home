// 站点通用 SVG 图标集（Lucide 同款 24x24 viewBox、1.75 描边）。
// 配置里的 icon 字段写这里的键名，组件通过 <Icon name="..."> 渲染；
// 未登记的名字会按文本原样输出，兼容旧配置里的 emoji。

const stroke = (paths: string): string => paths;

export const SITE_ICONS = {
  code: stroke('<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>'),
  server: stroke(
    '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
  ),
  cloud: stroke('<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.78A6 6 0 0 0 4.5 12.5 3.5 3.5 0 0 0 6 19z"/>'),
  layers: stroke(
    '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  ),
  image: stroke(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  ),
  sparkles: stroke(
    '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z"/>',
  ),
  terminal: stroke('<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>'),
  globe: stroke(
    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20"/>',
  ),
  pen: stroke('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  mail: stroke('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
  rss: stroke('<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>'),
  arrowRight: stroke('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
  arrowUpRight: stroke('<path d="M7 17 17 7"/><path d="M8 7h9v9"/>'),
  github: stroke(
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  ),
} as const;

export type SiteIconName = keyof typeof SITE_ICONS;

export function isSiteIcon(name: string | undefined): name is SiteIconName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(SITE_ICONS, name);
}
