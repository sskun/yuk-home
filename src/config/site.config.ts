import type { SiteConfig } from './schema';

// 站点内容配置：页面所有可见文案都在此维护，组件不写死任何业务内容。
// 未来扩展为“项目/Demo 入口”时，只需在 sections 中增删 showcase 项即可。
const config: SiteConfig = {
  site: {
    title: 'yuk · 个人站点',
    description: '记录技术思考、构建实用工具的个人站点。',
    lang: 'zh-CN',
    author: 'yukun',
  },
  theme: {
    primaryColor: '#18181b',
    accentColor: '#6366f1',
    animationEnabled: true,
    animationBaseDelay: 100,
  },
  articleIndex: {
    title: '文章 · yuk',
    description: '记录与分享：技术笔记、项目思考与实践总结。',
    heading: '全部文章',
    intro: '这里汇集了我写下的文章，点击任意卡片阅读全文。',
  },
  toolsIndex: {
    title: '工具 · yuk',
    description: '纯客户端、零上传：浏览器内可完成的轻量工具。',
    heading: '工具',
    intro: '基于浏览器端的工具列表，无需安装，打开即用。',
  },
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
      headline: '写代码，做工具，\n记录思考',
      subheadline: '全栈开发者，专注于构建简洁实用的产品。喜欢用工程思维解决实际问题。',
      backgroundEffect: 'none',
      ctas: [
        { label: '阅读文章', href: '/article', variant: 'primary' },
        { label: '查看工具', href: '/tools', variant: 'ghost' },
      ],
    },
    {
      id: 'features',
      type: 'feature',
      heading: '技术栈',
      intro: '目前主要使用的技术方向。',
      features: [
        { icon: '⚡', title: '前端', description: 'TypeScript · React · Astro · CSS' },
        { icon: '🛠', title: '后端', description: 'Node.js · Go · PostgreSQL · Redis' },
        { icon: '🚀', title: '基础设施', description: 'Docker · Cloudflare · Linux · CI/CD' },
      ],
    },
    {
      id: 'showcase',
      type: 'showcase',
      heading: '近期项目',
      items: [
        {
          title: '图片治理工具',
          description: '纯浏览器端的图片裁剪与压缩，文件全程不离开设备。',
          href: '/tools/image-governance',
          tags: ['工具', 'Canvas', '纯前端'],
        },
        {
          title: '个人站点',
          description: '基于 Astro 构建，配置驱动，零硬编码文案，静态部署到 Cloudflare Pages。',
          href: 'https://github.com',
          tags: ['Astro', 'TypeScript'],
          external: true,
        },
      ],
    },
    {
      id: 'footer',
      type: 'footer',
      copyright: '© 2026 yuk',
      links: [
        { label: 'GitHub', href: 'https://github.com', external: true },
      ],
    },
  ],
};

export default config;
