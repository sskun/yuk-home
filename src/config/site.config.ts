import type { SiteConfig } from './schema';

// 站点内容配置：页面所有可见文案都在此维护，组件不写死任何业务内容。
// 未来扩展为“项目/Demo 入口”时，只需在 sections 中增删 showcase 项即可。
const config: SiteConfig = {
  site: {
    title: 'Astro 宣发首页',
    description: '基于 Astro 构建的极速静态站点，作为个人项目与 Demo 的统一入口。',
    lang: 'zh-CN',
    author: 'yukun',
  },
  theme: {
    primaryColor: '#0f172a',
    accentColor: '#3b82f6',
    animationEnabled: true,
    animationBaseDelay: 120,
  },
  // 文章列表页（/article）的可见文案
  articleIndex: {
    title: '文章 · Astro 宣发首页',
    description: '记录与分享：技术笔记、项目思考与实践总结。',
    heading: '全部文章',
    intro: '这里汇集了我写下的文章，点击任意卡片阅读全文。',
  },
  // 工具列表页（/tools）的可见文案
  toolsIndex: {
    title: '工具 · Astro 宣发首页',
    description: '纯客户端、零上传：图片裁剪与压缩等浏览器内可完成的轻量工具。',
    heading: '小工具',
    intro: '所有处理均在你的浏览器中完成，文件不会上传到任何服务器。',
    highlights: [
      { title: '零上传', description: '所有文件全程留在浏览器，不经过任何服务器' },
      { title: '无需注册', description: '打开即用，无账号、无广告、无追踪' },
      { title: '开源可审计', description: '代码托管在 GitHub，欢迎审阅与贡献' },
    ],
  },
  // 全站浮动导航栏：品牌 + 链接（内部链接与外链混用）
  nav: {
    brand: 'yuk',
    links: [
      { label: '首页', href: '/' },
      { label: '文章', href: '/article' },
      { label: '工具', href: '/tools' },
      { label: 'GitHub', href: 'https://github.com', external: true },
    ],
  },
  sections: [
    {
      id: 'hero',
      type: 'hero',
      headline: '用 Astro 构建极速站点',
      subheadline: '内容驱动 · 默认零 JS · 部署即上线',
      backgroundEffect: 'aurora',
      ctas: [
        { label: '了解特性', href: '#features', variant: 'primary' },
        { label: '阅读文章', href: '/article', variant: 'primary' },
        { label: '查看展示', href: '#showcase', variant: 'ghost' },
        { label: 'Astro 官网', href: 'https://astro.build', variant: 'ghost', external: true },
      ],
    },
    {
      id: 'tools',
      type: 'tool-grid',
      heading: '试试这些工具',
      intro: '点击进入使用，全部在浏览器内完成，不会上传你的文件。',
      items: [
        {
          slug: 'image-governance',
          title: '图片治理',
          description: '裁剪到指定像素尺寸，或按目标体积压缩大小，输出图片不离开你的设备。',
          icon: '🖼',
          tags: ['图片', '纯前端'],
          status: 'ready',
        },
      ],
    },
    {
      id: 'features',
      type: 'feature',
      heading: '为什么选择 Astro',
      intro: '一个面向内容站点的现代 Web 框架，把性能作为默认值。',
      features: [
        { icon: '⚡', title: '极速加载', description: '默认零 JavaScript，构建期渲染为静态 HTML，首屏飞快。' },
        { icon: '🧩', title: '岛屿架构', description: '只为需要交互的组件按需注水（hydrate），其余保持纯静态。' },
        { icon: '🌐', title: '框架无关', description: 'React、Vue、Svelte 等组件可在同一项目中混用。' },
        { icon: '🚀', title: '轻松部署', description: '静态产物一键部署到 Cloudflare Pages 等平台，全球 CDN 分发。' },
        { icon: '📝', title: '内容优先', description: '内置内容集合与 Markdown/MDX 支持，天然适合博客与文档。' },
        { icon: '🔧', title: '开发体验', description: '基于 Vite 的极速热更新与开箱即用的 TypeScript 支持。' },
      ],
    },
    {
      id: 'showcase',
      type: 'showcase',
      heading: '项目与 Demo 入口',
      items: [
        {
          title: '示例项目占位',
          description: '这里将展示我的项目介绍，点击进入详情或在线体验。',
          href: 'https://example.com',
          tags: ['Astro', 'Demo'],
          external: true,
        },
        {
          title: 'Demo 占位',
          description: '未来的交互式 Demo 入口，配置化新增，无需改动页面代码。',
          href: 'https://example.com',
          tags: ['WIP'],
          external: true,
        },
      ],
    },
    {
      id: 'footer',
      type: 'footer',
      copyright: '© 2026 yuk · Built with Astro',
      links: [
        { label: 'GitHub', href: 'https://github.com', external: true },
        { label: 'Astro Docs', href: 'https://docs.astro.build', external: true },
      ],
    },
  ],
};

export default config;
