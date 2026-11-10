// 内容集合：article（文章）/ feed（情报）/ tools（工具）/ projects（项目）。
// 一条内容一个 md 文件，文件名即 id；构建期用 zod 严格校验 frontmatter，字段不合规直接构建失败。
// mock: true 的条目是占位内容，SHOW_MOCK=false 时整体排除（见 src/lib/content.ts）。
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { FEED_CATEGORIES, FEED_SOURCES, POST_CATEGORIES } from './consts';

// 文章：沿用原有字段（docs/article-admin.md 的后台设计依赖它们），只新增可选字段
const article = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/article' }),
  schema: z.object({
    title: z.string().min(1, 'title 不能为空'),
    // 同时用作详情页导语和列表卡片摘要
    description: z.string().min(1, 'description 不能为空'),
    pubDate: z.coerce.date().optional(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    author: z.string().optional(),
    image: z.string().optional(),
    canonical: z.string().optional(),
    // —— v5 新增 ——
    category: z.enum(POST_CATEGORIES).default('随记'),
    // 详情页开头的「先说结论」
    verdict: z.string().optional(),
    // 进入文章列表侧栏的「推荐阅读」
    pick: z.boolean().default(false),
    // 最新一篇大卡的缩略图（/src/assets/... 路径），缺省用渐变占位
    cover: z.string().optional(),
    mock: z.boolean().default(false),
  }),
});

// 情报：一条一个文件，文件名形如 2026-10-29-1610-context.md
const feed = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/feed' }),
  schema: z.object({
    // 带时区写，例如 2026-10-29T16:10:00+08:00；用于按天分组与倒序
    date: z.coerce.date(),
    category: z.enum(FEED_CATEGORIES),
    source: z.enum(FEED_SOURCES),
    // 外部来源链接；有则标题可点（新标签页打开）
    sourceUrl: z.url().optional(),
    // 站内链接（来源为「本站」时用）
    link: z.string().startsWith('/').optional(),
    title: z.string().max(60),
    summary: z.string().max(80),
    // 「我的判断」，有则计入「我的判断」计数
    verdict: z.string().max(120).optional(),
    tags: z.array(z.string()).default([]),
    // 指定首页头条；没有指定时取最新一条带判断的情报
    headline: z.boolean().default(false),
    mock: z.boolean().default(false),
  }),
});

const tools = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tools' }),
  schema: z.object({
    name: z.string(),
    // 表格「一句话」列
    tagline: z.string().max(60),
    tags: z.array(z.string()).default([]),
    // 外部官网；我做的工具可以用 href 指向站内
    url: z.url().optional(),
    href: z.string().startsWith('/').optional(),
    mine: z.boolean().default(false),
    offline: z.boolean().default(false),
    free: z.boolean().default(false),
    cli: z.boolean().default(false),
    verifiedAt: z.coerce.date(),
    addedAt: z.coerce.date(),
    version: z.string().optional(),
    // 例如「未实测」
    note: z.string().optional(),
    // 图标位的两个字母，缺省取名称首字母
    abbr: z.string().max(3).optional(),
    mock: z.boolean().default(false),
  }).refine((d) => d.url || d.href, { message: 'url 和 href 至少填一个' }),
});

const metric = z.object({ k: z.string(), v: z.string(), unit: z.string().optional() });

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z
    .object({
      // main：项目页大块；small：「还有一批小的」
      tier: z.enum(['main', 'small']).default('main'),
      order: z.number().int(),
      name: z.string(),
      oneLine: z.string(),
      // small 卡片顶部的类型，如 CLI / WEB
      kind: z.string().optional(),
      version: z.string().optional(),
      updated: z.coerce.date(),
      status: z.enum(['在线', '维护中', '归档']).default('在线'),
      // 截图（/src/assets/... 路径），缺省用渐变占位 + shotLines
      shot: z.string().optional(),
      shotCaption: z.string().optional(),
      // 叠加在截图框上的终端文本；行首用 "> " 表示提示符高亮
      shotLines: z.array(z.string()).default([]),
      // 首页「我做的」卡片里的终端块
      term: z.array(z.string()).default([]),
      metrics: z.array(metric).default([]),
      stack: z.array(z.string()).default([]),
      links: z
        .array(z.object({ label: z.string(), href: z.string(), primary: z.boolean().default(false) }))
        .default([]),
      // 「打开」指向的地址（首页卡片、工具库）
      open: z.string().optional(),
      mock: z.boolean().default(false),
    })
    .refine((d) => d.tier === 'small' || d.metrics.length === 3, { message: 'main 项目的 metrics 必须正好 3 个' }),
});

export const collections = { article, feed, tools, projects };
