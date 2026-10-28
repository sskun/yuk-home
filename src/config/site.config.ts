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
    primaryColor: '#0b0b0f',
    accentColor: '#6366f1',
    animationEnabled: true,
    animationBaseDelay: 100,
  },
  articleIndex: {
    title: '文章 · yuk',
    description: '记录与分享：技术笔记、项目思考与实践总结。',
    eyebrow: 'Writing',
    heading: '全部文章',
    intro: '技术笔记、项目复盘与工程思考，按发布时间排列。',
  },
  toolsIndex: {
    title: '工具 · yuk',
    description: '纯客户端、零上传：浏览器内可完成的轻量工具。',
    eyebrow: 'Tools',
    heading: '在线工具',
    intro: '纯浏览器端运行的小工具：无需安装、无需注册，文件不会离开你的设备。',
    items: [
      {
        slug: 'image-governance',
        title: '图片治理',
        description: '裁剪到指定像素尺寸，或按目标体积压缩大小，输出图片不离开你的设备。',
        icon: 'image',
        tags: ['裁剪', '压缩', '纯前端'],
        status: 'ready',
        accent: ['#6366f1', '#a855f7'],
      },
    ],
    comingSoon: {
      title: '更多工具开发中',
      description: '格式转换、二维码、JSON 工具… 有想要的工具欢迎告诉我。',
    },
  },
  nav: {
    brand: 'yuk',
    links: [
      { label: '首页', href: '/' },
      { label: '文章', href: '/article' },
      { label: '工具', href: '/tools' },
      { label: 'GitHub', href: 'https://github.com/sskun', external: true },
    ],
  },
  sections: [
    {
      id: 'hero',
      type: 'hero',
      status: '持续构建中 · 欢迎交流',
      greeting: '你好，我是 yukun',
      headline: '写代码，做工具，\n记录思考',
      subheadline: '全栈开发者，专注于构建简洁实用的产品。喜欢用工程思维拆解问题，把想法做成真正可用的工具，再把过程写下来。',
      backgroundEffect: 'aurora',
      ctas: [
        { label: '查看项目', href: '#showcase', variant: 'primary' },
        { label: '阅读文章', href: '/article', variant: 'ghost' },
      ],
      socials: [
        { label: 'GitHub', href: 'https://github.com/sskun', icon: 'github', external: true },
        { label: '邮箱 yukunyk@foxmail.com', href: 'mailto:yukunyk@foxmail.com', icon: 'mail' },
        { label: '文章', href: '/article', icon: 'pen' },
      ],
      profile: {
        filename: 'about.ts',
        variable: 'yukun',
        entries: [
          { key: 'role', value: '全栈开发者' },
          { key: 'focus', value: ['开发工具', '工程化', 'AI Agent'] },
          { key: 'stack', value: ['TypeScript', 'React', 'Go'] },
          { key: 'now', value: '构建个人工具站' },
        ],
      },
    },
    {
      id: 'showcase',
      type: 'showcase',
      eyebrow: '01 · Projects',
      heading: '精选项目',
      intro: '从想法到上线的完整作品，每一个都在解决一个具体的问题。',
      items: [
        {
          title: '拾迹 TraceMine',
          description:
            '本机 AI 编程工作记录查询与学习工具：汇总 Codex、Claude Code、Cursor、Kiro 等工具的本地会话，提供时间线、执行日志、来源追溯和学习笔记。一行 npx 启动，数据只存本机。',
          href: 'https://www.npmjs.com/package/tracemine',
          logo: '/projects/tracemine-logo.png',
          accent: ['#1f6f50', '#86c9a3'],
          badge: 'npm',
          tags: ['Node.js', 'React', 'SQLite', 'CLI'],
          external: true,
        },
        {
          title: '图片治理工具',
          description: '纯浏览器端的图片裁剪与按体积压缩，Web Worker 处理，文件全程不离开设备。',
          href: '/tools/image-governance',
          icon: 'image',
          badge: 'Live',
          tags: ['TypeScript', 'Canvas', 'Web Worker'],
        },
        {
          title: '个人站点 yuk-home',
          description: '基于 Astro 的静态优先站点，配置驱动、零硬编码文案，部署在 Cloudflare Pages。',
          href: 'https://github.com/sskun/yuk-home',
          icon: 'globe',
          badge: 'Open Source',
          tags: ['Astro', 'TypeScript', 'Cloudflare'],
          external: true,
        },
      ],
    },
    {
      id: 'features',
      type: 'feature',
      eyebrow: '02 · Stack',
      heading: '技术栈',
      intro: '日常主力使用的技术，覆盖从界面到部署的完整链路。',
      features: [
        {
          icon: 'code',
          title: '前端',
          description: '组件化与类型安全，关注性能和交互细节。',
          tags: ['TypeScript', 'React', 'Astro', 'CSS'],
        },
        {
          icon: 'server',
          title: '后端',
          description: '接口设计、数据建模与服务稳定性。',
          tags: ['Node.js', 'Go', 'PostgreSQL', 'Redis'],
        },
        {
          icon: 'cloud',
          title: '基础设施',
          description: '容器化、自动化发布与边缘部署。',
          tags: ['Docker', 'Cloudflare', 'Linux', 'CI/CD'],
        },
      ],
    },
    {
      id: 'articles',
      type: 'articles',
      eyebrow: '03 · Writing',
      heading: '最新文章',
      intro: '记录技术实践与思考，也是这个站点的起点。',
      limit: 3,
      more: { label: '全部文章', href: '/article' },
    },
    {
      id: 'contact',
      type: 'contact',
      eyebrow: "Let's talk",
      heading: '有想法？一起聊聊',
      intro: '无论是项目合作、技术交流还是工作机会，都欢迎联系：yukunyk@foxmail.com',
      ctas: [
        { label: '发邮件给我', href: 'mailto:yukunyk@foxmail.com', variant: 'primary' },
        { label: '在 GitHub 关注我', href: 'https://github.com/sskun', variant: 'ghost', external: true },
      ],
    },
    {
      id: 'footer',
      type: 'footer',
      tagline: '写代码，做工具，记录思考。',
      copyright: '© 2026 yukun',
      links: [
        { label: '文章', href: '/article' },
        { label: '工具', href: '/tools' },
        { label: 'GitHub', href: 'https://github.com/sskun', external: true },
        { label: '邮箱', href: 'mailto:yukunyk@foxmail.com' },
      ],
    },
  ],
};

export default config;
