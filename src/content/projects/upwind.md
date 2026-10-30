---
order: 3
name: 御风行 Upwind
oneLine: 这个站本身。不造风，不等风，御风而行。Astro 静态生成，部署在 Cloudflare Pages，站内检索是构建期生成的索引，没有后端。
version: v5
updated: 2026-10-29
status: 在线
shotCaption: upwind — 站内检索
shotLines:
  - '> 搜索「本地优先」  命中情报、工具、文章'
  - '> 索引  构建期生成 · 浏览器端 BM25'
  - '> 后端  无 · Cloudflare Pages 静态托管'
term:
  - '$ pnpm build'
  - '> 生成 search-index.json'
  - '> 部署到 Cloudflare Pages'
metrics:
  - { k: 后端服务, v: '0', unit: 个 }
  - { k: 检索方式, v: BM25 }
  - { k: 内容类型, v: '4', unit: 类 }
stack: [Astro, TypeScript, Tailwind CSS, Cloudflare Pages]
open: /
links:
  - { label: '回到首页 →', href: '/', primary: true }
  - { label: 源码, href: 'https://github.com/sskun/yuk-home' }
  - { label: 读搭建笔记, href: '/article/astro-serverless-personal-site' }
mock: false
---

**起因**：想要一个能长期维护、又不用操心服务器的地方，放文章、工具和项目。

**关键决策**：内容就是 Markdown 文件，构建期校验字段；检索在构建时生成索引，浏览器里用 BM25 查询，中文用一元加二元切分，不依赖任何检索服务。

**下一步**：接入文章后台，让发布不再需要手动提交文件。
