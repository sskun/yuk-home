// 站点配置的类型定义与运行时校验
// 设计要点：所有页面内容由配置驱动，本文件既是类型契约，也是构建期校验入口。

// ============ 顶层配置 ============

/** 顶层站点配置：站点元信息 + 主题 + 有序区块列表 */
export interface SiteConfig {
  site: SiteMeta;
  theme: ThemeConfig;
  sections: Section[];
  /** 文章列表页可见文案（可选）；缺省时列表页回落到内置文案 */
  articleIndex?: ArticleIndexMeta;
  /** 工具列表页可见文案（可选）；缺省时回落到内置文案 */
  toolsIndex?: ToolIndexMeta;
  /** 全站浮动导航栏（可选）；提供时在所有页面顶部渲染 */
  nav?: NavConfig;
}

/** 全站导航栏配置：品牌名 + 链接列表 */
export interface NavConfig {
  /** 品牌名/站点简称，点击回到首页 */
  brand: string;
  /** 导航链接列表 */
  links: NavLink[];
}

/** 导航链接项 */
export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

/** 文章列表页（/article）的可见文案，保持“零硬编码文案”原则 */
export interface ArticleIndexMeta {
  /** 列表页 <title> / og:title */
  title: string;
  /** 列表页 meta description */
  description: string;
  /** 页面大标题（H1） */
  heading: string;
  /** 副标题/引言（可选） */
  intro?: string;
}

/** 工具列表页（/tools）的可见文案 */
export interface ToolIndexMeta {
  /** 列表页 <title> / og:title */
  title: string;
  /** 列表页 meta description */
  description: string;
  /** 页面大标题（H1） */
  heading: string;
  /** 副标题/引言（可选） */
  intro?: string;
  /**
   * Bento 网格右侧亮点/隐私说明卡片（可选，建议 ≤ 3 项）。
   * 缺省时组件回落到内置默认文案，保持“零上传 / 无需注册”等站点承诺。
   */
  highlights?: ToolHighlight[];
  /** 工具列表（直接在此维护，不依赖首页 tool-grid 区块）*/
  items?: ToolItem[];
}

/** 工具列表页侧栏亮点条目 */
export interface ToolHighlight {
  title: string;
  description: string;
}

/** 站点级元信息（用于 SEO 与 head） */
export interface SiteMeta {
  title: string;
  description: string;
  lang: string;
  author?: string;
  favicon?: string;
  ogImage?: string;
}

/** 主题与全局动画参数 */
export interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  animationEnabled: boolean;
  /** 区块动画基础延迟（毫秒），按区块序号递增 */
  animationBaseDelay: number;
}

// ============ 区块（可辨识联合） ============

export type SectionType = 'hero' | 'feature' | 'showcase' | 'tool-grid' | 'footer';

/** 所有区块共有的基础字段 */
export interface SectionBase {
  /** 唯一标识，用作 DOM 锚点 id */
  id: string;
  type: SectionType;
  /** 该区块是否启用动画，缺省时继承全局开关 */
  animate?: boolean;
}

/** 首屏主视觉区块 */
export interface HeroSection extends SectionBase {
  type: 'hero';
  headline: string;
  subheadline: string;
  ctas: CallToAction[];
  backgroundEffect?: BgEffect;
}

/** 特性介绍区块 */
export interface FeatureSection extends SectionBase {
  type: 'feature';
  heading: string;
  intro?: string;
  features: FeatureItem[];
}

/** 展示区块：面向未来的项目/Demo 入口 */
export interface ShowcaseSection extends SectionBase {
  type: 'showcase';
  heading: string;
  items: ShowcaseItem[];
}

/** 工具入口区块：首页顶部一组工具卡片，跳转 /tools/{slug} */
export interface ToolGridSection extends SectionBase {
  type: 'tool-grid';
  heading: string;
  intro?: string;
  items: ToolItem[];
}

/** 页脚区块 */
export interface FooterSection extends SectionBase {
  type: 'footer';
  copyright: string;
  links: LinkItem[];
}

export type Section = HeroSection | FeatureSection | ShowcaseSection | ToolGridSection | FooterSection;

// ============ 复用子类型 ============

export interface CallToAction {
  label: string;
  href: string;
  variant: 'primary' | 'ghost';
  external?: boolean;
}

export interface FeatureItem {
  icon?: string;
  title: string;
  description: string;
}

export interface ShowcaseItem {
  title: string;
  description: string;
  href: string;
  thumbnail?: string;
  tags?: string[];
  /** 是否外链（新窗口打开并带 rel="noopener noreferrer"） */
  external?: boolean;
}

export interface LinkItem {
  label: string;
  href: string;
  external?: boolean;
}

/** 工具入口卡片项 */
export interface ToolItem {
  /** 路由 slug，例如 image-governance → /tools/image-governance */
  slug: string;
  title: string;
  description: string;
  /** 单字符图标（emoji 或字符），与站点现有 showcase 卡片风格保持一致 */
  icon: string;
  tags?: string[];
  /** 工具状态：ready 默认；wip 时卡片置灰且不可点击 */
  status?: 'ready' | 'wip';
  /** 覆盖默认 /tools/{slug} 链接（极少使用，例如指向外链 demo） */
  external?: boolean;
  href?: string;
}

export type BgEffect = 'gradient-flow' | 'particles' | 'aurora' | 'none';

// ============ 校验 ============

/** 配置校验失败时抛出的错误，message 汇总全部问题及字段路径 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * 校验原始配置对象。
 * 前置：raw 为任意导入值。
 * 后置：返回结构合法的 SiteConfig；非法时抛 ConfigError（含全部错误与字段路径）；不修改输入。
 */
export function validateConfig(raw: unknown): SiteConfig {
  const errors: string[] = [];
  const KNOWN_TYPES: SectionType[] = ['hero', 'feature', 'showcase', 'tool-grid', 'footer'];

  if (raw === null || typeof raw !== 'object') {
    throw new ConfigError('配置必须是一个对象（site.config.ts 未正确导出）');
  }
  const cfg = raw as Record<string, unknown>;

  // 1. 站点元信息
  const site = cfg.site as Record<string, unknown> | undefined;
  if (!site || typeof site !== 'object') {
    errors.push('site: 缺少站点元信息对象');
  } else {
    if (!isNonEmptyString(site.title)) errors.push('site.title: 不能为空');
    if (!isNonEmptyString(site.description)) errors.push('site.description: 不能为空');
    if (!isBcp47(site.lang)) errors.push('site.lang: 语言标签格式非法（如 zh-CN、en）');
  }

  // 2. 主题
  const theme = cfg.theme as Record<string, unknown> | undefined;
  if (!theme || typeof theme !== 'object') {
    errors.push('theme: 缺少主题配置对象');
  } else {
    if (!isCssColor(theme.primaryColor)) errors.push('theme.primaryColor: 非法的 CSS 颜色');
    if (!isCssColor(theme.accentColor)) errors.push('theme.accentColor: 非法的 CSS 颜色');
    if (typeof theme.animationEnabled !== 'boolean') {
      errors.push('theme.animationEnabled: 必须为布尔值');
    }
    if (typeof theme.animationBaseDelay !== 'number' || theme.animationBaseDelay < 0) {
      errors.push('theme.animationBaseDelay: 必须为非负数字');
    }
  }

  // 3. 区块列表
  const sections = cfg.sections;
  if (!Array.isArray(sections) || sections.length < 1) {
    errors.push('sections: 至少需要一个区块');
  } else {
    const seenIds = new Set<string>();
    sections.forEach((section, i) => {
      const s = section as Record<string, unknown>;
      const path = `sections[${i}]`;

      if (!isNonEmptyString(s.id)) {
        errors.push(`${path}.id: 不能为空`);
      } else if (seenIds.has(s.id)) {
        errors.push(`${path}.id: 重复的 id "${s.id}"`);
      } else {
        seenIds.add(s.id);
      }

      if (!KNOWN_TYPES.includes(s.type as SectionType)) {
        errors.push(`${path}.type: 未知的区块类型 "${String(s.type)}"`);
      } else {
        errors.push(...validateSectionByType(s, path));
      }
    });
  }

  // 4. 文章列表页元信息（可选，提供时校验必填字段）
  if (cfg.articleIndex !== undefined) {
    const ai = cfg.articleIndex as Record<string, unknown>;
    if (ai === null || typeof ai !== 'object') {
      errors.push('articleIndex: 必须为对象');
    } else {
      if (!isNonEmptyString(ai.title)) errors.push('articleIndex.title: 不能为空');
      if (!isNonEmptyString(ai.description)) errors.push('articleIndex.description: 不能为空');
      if (!isNonEmptyString(ai.heading)) errors.push('articleIndex.heading: 不能为空');
    }
  }

  // 4b. 工具列表页元信息（可选，提供时校验必填字段）
  if (cfg.toolsIndex !== undefined) {
    const ti = cfg.toolsIndex as Record<string, unknown>;
    if (ti === null || typeof ti !== 'object') {
      errors.push('toolsIndex: 必须为对象');
    } else {
      if (!isNonEmptyString(ti.title)) errors.push('toolsIndex.title: 不能为空');
      if (!isNonEmptyString(ti.description)) errors.push('toolsIndex.description: 不能为空');
      if (!isNonEmptyString(ti.heading)) errors.push('toolsIndex.heading: 不能为空');
      // highlights 可选：提供时须为数组，每项 title/description 非空
      if (ti.highlights !== undefined) {
        if (!Array.isArray(ti.highlights)) {
          errors.push('toolsIndex.highlights: 必须为数组');
        } else {
          (ti.highlights as unknown[]).forEach((h, j) => {
            const item = h as Record<string, unknown>;
            if (item === null || typeof item !== 'object') {
              errors.push(`toolsIndex.highlights[${j}]: 必须为对象`);
              return;
            }
            if (!isNonEmptyString(item.title)) {
              errors.push(`toolsIndex.highlights[${j}].title: 不能为空`);
            }
            if (!isNonEmptyString(item.description)) {
              errors.push(`toolsIndex.highlights[${j}].description: 不能为空`);
            }
          });
        }
      }
    }
  }

  // 5. 导航栏（可选，提供时校验品牌与链接）
  if (cfg.nav !== undefined) {
    const nav = cfg.nav as Record<string, unknown>;
    if (nav === null || typeof nav !== 'object') {
      errors.push('nav: 必须为对象');
    } else {
      if (!isNonEmptyString(nav.brand)) errors.push('nav.brand: 不能为空');
      if (!Array.isArray(nav.links)) {
        errors.push('nav.links: 必须为数组');
      } else {
        (nav.links as unknown[]).forEach((l, j) => {
          const link = l as Record<string, unknown>;
          if (!isNonEmptyString(link.label)) errors.push(`nav.links[${j}].label: 不能为空`);
          if (!isNonEmptyString(link.href)) errors.push(`nav.links[${j}].href: 不能为空`);
        });
      }
    }
  }

  if (errors.length > 0) {
    throw new ConfigError('站点配置校验失败：\n- ' + errors.join('\n- '));
  }

  return raw as SiteConfig;
}

/** 按区块类型做细粒度校验，返回该区块的错误列表 */
function validateSectionByType(s: Record<string, unknown>, path: string): string[] {
  const errs: string[] = [];
  switch (s.type) {
    case 'hero': {
      if (!isNonEmptyString(s.headline)) errs.push(`${path}.headline: 不能为空`);
      if (!isNonEmptyString(s.subheadline)) errs.push(`${path}.subheadline: 不能为空`);
      if (!Array.isArray(s.ctas)) {
        errs.push(`${path}.ctas: 必须为数组`);
      } else {
        (s.ctas as unknown[]).forEach((c, j) => {
          const cta = c as Record<string, unknown>;
          if (!isNonEmptyString(cta.label)) errs.push(`${path}.ctas[${j}].label: 不能为空`);
          if (!isNonEmptyString(cta.href)) errs.push(`${path}.ctas[${j}].href: 不能为空`);
        });
      }
      break;
    }
    case 'feature': {
      if (!isNonEmptyString(s.heading)) errs.push(`${path}.heading: 不能为空`);
      if (!Array.isArray(s.features) || (s.features as unknown[]).length < 1) {
        errs.push(`${path}.features: 至少需要一项`);
      } else {
        (s.features as unknown[]).forEach((f, j) => {
          const item = f as Record<string, unknown>;
          if (!isNonEmptyString(item.title)) errs.push(`${path}.features[${j}].title: 不能为空`);
          if (!isNonEmptyString(item.description)) {
            errs.push(`${path}.features[${j}].description: 不能为空`);
          }
        });
      }
      break;
    }
    case 'showcase': {
      if (!isNonEmptyString(s.heading)) errs.push(`${path}.heading: 不能为空`);
      if (!Array.isArray(s.items) || (s.items as unknown[]).length < 1) {
        errs.push(`${path}.items: 至少需要一项`);
      } else {
        (s.items as unknown[]).forEach((it, j) => {
          const item = it as Record<string, unknown>;
          if (!isNonEmptyString(item.title)) errs.push(`${path}.items[${j}].title: 不能为空`);
          if (!isNonEmptyString(item.href)) errs.push(`${path}.items[${j}].href: 不能为空`);
        });
      }
      break;
    }
    case 'tool-grid': {
      if (!isNonEmptyString(s.heading)) errs.push(`${path}.heading: 不能为空`);
      if (!Array.isArray(s.items) || (s.items as unknown[]).length < 1) {
        errs.push(`${path}.items: 至少需要一项`);
      } else {
        (s.items as unknown[]).forEach((it, j) => {
          const item = it as Record<string, unknown>;
          if (!isNonEmptyString(item.slug)) errs.push(`${path}.items[${j}].slug: 不能为空`);
          if (!isNonEmptyString(item.title)) errs.push(`${path}.items[${j}].title: 不能为空`);
          if (!isNonEmptyString(item.description)) {
            errs.push(`${path}.items[${j}].description: 不能为空`);
          }
          if (!isNonEmptyString(item.icon)) errs.push(`${path}.items[${j}].icon: 不能为空`);
        });
      }
      break;
    }
    case 'footer': {
      if (!isNonEmptyString(s.copyright)) errs.push(`${path}.copyright: 不能为空`);
      if (!Array.isArray(s.links)) errs.push(`${path}.links: 必须为数组`);
      break;
    }
  }
  return errs;
}

// ============ 校验工具函数 ============

/** 是否为非空字符串（去除首尾空白后长度 > 0） */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** BCP-47 基本格式校验：如 zh、zh-CN、en-US */
function isBcp47(v: unknown): v is string {
  return typeof v === 'string' && /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(v);
}

/**
 * 是否为合法 CSS 颜色。
 * 支持：#RGB / #RGBA / #RRGGBB / #RRGGBBAA、rgb()/rgba()/hsl()/hsla()、以及常见颜色关键字。
 */
export function isCssColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length === 0) return false;
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return true;
  if (/^(rgb|rgba|hsl|hsla)\([^)]+\)$/i.test(v)) return true;
  // CSS 颜色关键字（如 red、rebeccapurple、transparent）：字母组成即可
  if (/^[a-zA-Z]+$/.test(v)) return true;
  return false;
}
