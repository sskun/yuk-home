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
      name: 'yukun',
      role: '全栈开发者 · 独立产品人',
      // TODO: 头像放到 src/assets/avatar/ 后填写，如 '/src/assets/avatar/me.jpg'；不填显示首字母
      // avatar: '/src/assets/avatar/me.jpg',
      status: '持续构建中 · 欢迎交流',
      headline: '把想法，\n做成好用的产品',
      subheadline:
        '从发现问题、设计体验，到写代码、发布上线，我一个人把产品完整做出来。拾迹 TraceMine 已发布到 npm，更多作品持续上线中。',
      backgroundEffect: 'aurora',
      ctas: [
        { label: '看看我的作品', href: '#showcase', variant: 'primary' },
        { label: '联系我', href: 'mailto:yukunyk@foxmail.com', variant: 'ghost' },
      ],
      socials: [
        { label: 'GitHub', href: 'https://github.com/sskun', icon: 'github', external: true },
        { label: '邮箱 yukunyk@foxmail.com', href: 'mailto:yukunyk@foxmail.com', icon: 'mail' },
        { label: '文章', href: '/article', icon: 'pen' },
      ],
      // 首屏数据：只放能被验证的真实数字。TODO 可替换为「X 年开发经验」「npm 周下载量」等
      stats: [
        { value: 3, label: '独立上线的作品' },
        { value: 10, label: 'TraceMine 支持的 AI 工具' },
        { value: 'articles', label: '篇技术文章' },
      ],
      stage: {
        address: 'npx tracemine start',
        image: '/src/assets/projects/tracemine-overview.png',
        // 以后有产品视频，填这里即可替换截图（建议放 R2）：
        // video: { src: 'https://media.example.com/tracemine.mp4', poster: '/src/assets/...' },
        product: {
          name: '拾迹 TraceMine',
          tagline: '本机 AI 工作记录查询与学习工具',
          href: 'https://www.npmjs.com/package/tracemine',
          logo: '/src/assets/projects/tracemine-logo.png',
          external: true,
        },
        floats: [
          {
            logo: '/src/assets/projects/tracemine-logo.png',
            title: '已发布到 npm',
            caption: '一行命令开箱即用',
            href: 'https://www.npmjs.com/package/tracemine',
            external: true,
          },
          { icon: 'image', title: '图片治理工具', caption: '浏览器内裁剪 · 压缩', href: '/tools/image-governance' },
          // TODO: 有介绍视频后改成视频入口
          { icon: 'play', title: '作品视频', caption: '即将上线' },
        ],
      },
      marquee: [
        '产品设计',
        '交互体验',
        'TypeScript',
        'React',
        'Astro',
        'Node.js',
        'Go',
        'SQLite',
        'AI Agent',
        'CLI 工具',
        '工程化',
        'Cloudflare',
        '自动化测试',
      ],
    },
    {
      id: 'pillars',
      type: 'pillars',
      eyebrow: '01 · Why me',
      heading: '产品、执行、技术，一个人闭环',
      intro: '我关心的不只是代码写完，而是东西真的被用起来。',
      items: [
        {
          icon: 'target',
          title: '产品力',
          metric: '3 个',
          metricLabel: '从 0 到 1 独立上线的作品',
          description: '从真实痛点出发定义产品，自己做交互和视觉，追求打开就会用。',
          points: [
            'TraceMine：把 Codex、Claude Code、Kiro 等 10 款 AI 工具的本地记录汇成一个工作台',
            '图片治理：零上传的浏览器端裁剪与按体积压缩',
          ],
        },
        {
          icon: 'zap',
          title: '执行力',
          metric: '1 人',
          metricLabel: '跑完全流程',
          description: '需求、设计、开发、测试、发布、写文档，不停在 Demo。',
          points: ['一键发布流水线：打包、隐私检查、安装验收', '关键功能都有自动化验收'],
        },
        {
          icon: 'cpu',
          title: '技术力',
          metric: '全栈',
          metricLabel: '前端 · 后端 · 工程化',
          description: '界面、数据服务、构建发布都能独立负责。',
          points: ['React / Astro / TypeScript', 'Node.js + SQLite 本地数据服务', 'Web Worker、Canvas 浏览器端计算'],
        },
        {
          // TODO: 换成你最有说服力的成果，如公司项目的业务数据、获奖、开源 Star 数
          icon: 'trophy',
          title: '代表成果',
          metric: '待补充',
          metricLabel: '例如：负责的核心业务指标提升 XX%',
          description: '在这里写一个最能说明你能力的成果：做了什么、结果如何、用数据说话。',
          placeholder: true,
        },
      ],
    },
    {
      id: 'showcase',
      type: 'showcase',
      eyebrow: '02 · Projects',
      heading: '精选项目',
      intro: '从想法到上线的完整作品，每一个都在解决一个具体的问题。',
      items: [
        {
          title: '拾迹 TraceMine',
          description:
            '本机 AI 编程工作记录查询与学习工具：汇总 Codex、Claude Code、Cursor、Kiro 等工具的本地会话，提供时间线、执行日志、来源追溯和学习笔记。一行 npx 启动，数据只存本机。',
          href: 'https://www.npmjs.com/package/tracemine',
          logo: '/src/assets/projects/tracemine-logo.png',
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
      id: 'timeline',
      type: 'timeline',
      eyebrow: '03 · Journey',
      heading: '经历',
      intro: '一路做过的事。',
      items: [
        {
          period: '2026 — 至今',
          title: '独立开发 · 个人产品',
          org: 'TraceMine / 图片治理 / yuk-home',
          description: '业余时间独立设计、开发并发布开发者工具与个人站点，持续写作记录技术实践。',
          tags: ['产品设计', '全栈开发', '发布运营'],
        },
        {
          // TODO: 填写真实工作经历
          period: '待补充',
          title: '工作经历：公司 · 职位',
          description: '负责的业务、关键项目、可量化的成果。',
          placeholder: true,
        },
        {
          // TODO: 填写教育经历或删除此项
          period: '待补充',
          title: '教育经历：学校 · 专业',
          description: '可以写与技术相关的经历或荣誉。',
          placeholder: true,
        },
      ],
    },
    {
      id: 'articles',
      type: 'articles',
      eyebrow: '04 · Writing',
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
