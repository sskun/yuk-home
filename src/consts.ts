// 站点常量：品牌、导航、联系方式。
// 标了 MOCK 的值是占位内容，正式上线前替换（见 docs/2026-10-29-个人网站v5改版-落地方案.md 6.10）。

export const SITE = {
  /** 站名：出自《庄子·逍遥游》「列子御风而行，泠然善也」 */
  brand: '御风行',
  /** 英文名：帆船借风逆行叫 upwind——借风，但不顺着风走 */
  brandEn: 'Upwind',
  /** Logo 末尾的蓝色符号：风向，也是外链的符号 */
  mark: '↗',
  slogan: '不造风，不等风，御风而行。',
  /** MOCK：署名，真实信息确认后替换 */
  author: '余坤',
  authorShort: '余坤',
  /** MOCK */
  city: '杭州',
  tagline: '御风行 · Upwind — 不造风，不等风，御风而行',
  title: '御风行 Upwind — AI 工具情报站',
  description: '不造风，不等风，御风而行。AI 工具、情报、长文和我自己做的项目——都试过才写进来。',
  lang: 'zh-CN',
  /** 真实值 */
  email: 'yukunyk@foxmail.com',
  github: 'https://github.com/sskun',
  githubLabel: 'github.com/sskun',
  /** MOCK：公众号还没有 */
  wechat: '御风行',
  /** MOCK：域名还没买，canonical 仍用 astro.config 里的 site */
  domainLabel: 'upwind',
} as const;

export interface NavItem {
  label: string;
  href: string;
}

export const NAV: NavItem[] = [
  { label: '情报', href: '/feed' },
  { label: '工具库', href: '/tools' },
  { label: '文章', href: '/article' },
  { label: '项目', href: '/projects' },
  { label: '关于', href: '/about' },
];

/** 路径前缀匹配高亮；首页不高亮任何一项 */
export function isActive(pathname: string, href: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  return p === href || p.startsWith(`${href}/`);
}

export const FEED_CATEGORIES = ['模型', '工具', '开源', '论文', '产品', '项目'] as const;
export const FEED_SOURCES = ['官方', 'arXiv', 'GitHub', 'Hacker News', '本站'] as const;
export const POST_CATEGORIES = ['工程', '方法', '评测', '随记'] as const;

/** 工具库 chips：标签名 → 展示名（与 tools 集合 tags 对应） */
export const TOOL_CHIPS = ['本地优先', '命令行', '编辑器', '检索', '图片', '免费'] as const;

/** 检索空态推荐词 */
export const SEARCH_SUGGESTIONS = ['本地优先', 'MCP', '上下文', '图片压缩'] as const;

/** 首页大检索框轮播的示例问题 */
export const HERO_PROMPTS = [
  '有哪些能离线跑、又不上传文件的 AI 工具？',
  '上下文管理最近有什么新变化？',
  '命令行里好用的本地模型工具',
  '浏览器端怎么批量压缩图片？',
] as const;

/** 首页 chips：点击后填入检索框（「我自己做的」直接去项目页） */
export const HERO_CHIPS: { label: string; q?: string; href?: string }[] = [
  { label: '本地优先', q: '本地优先' },
  { label: '免费', q: '免费' },
  { label: '上下文管理', q: '上下文管理' },
  { label: '能离线跑', q: '离线' },
  { label: '命令行', q: '命令行' },
  { label: '我自己做的', href: '/projects' },
];
