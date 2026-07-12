// 内容集合定义：文章（article）
// 设计要点：md 文档放在 src/content/article/ 下，构建期用 zod 严格校验 frontmatter，
// 任一文档字段不合规都会导致 astro build 失败，避免发布格式错乱的页面。
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const article = defineCollection({
  // glob loader 扫描目录下所有 md，文件名（相对路径去扩展名）即为条目 id / slug
  loader: glob({ pattern: '**/*.md', base: './src/content/article' }),
  // frontmatter 契约：title / description 必填（SEO 与 GEO 核心），其余可选
  schema: z.object({
    title: z.string().min(1, 'title 不能为空'),
    description: z.string().min(1, 'description 不能为空'),
    // 发布日期可选，手写；YAML 中写 2026-07-12 会被解析为 Date
    pubDate: z.coerce.date().optional(),
    // 最后更新日期，可选
    updatedDate: z.coerce.date().optional(),
    // 统一草稿字段：true 时不生成页面，默认 false
    draft: z.boolean().default(false),
    // 标签，用于关键词与未来分类
    tags: z.array(z.string()).default([]),
    // 作者，缺省时由页面回落到站点级 author
    author: z.string().optional(),
    // 社交分享图 og:image
    image: z.string().optional(),
    // 规范链接，避免重复内容
    canonical: z.string().optional(),
  }),
});

export const collections = { article };
