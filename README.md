# 御风行 · Upwind

> 不造风，不等风，御风而行。——站名出自《庄子·逍遥游》「列子御风而行，泠然善也」。

仓库名 `yuk-home`。基于 [Astro](https://astro.build/) 的静态个人站点：AI 工具情报、工具库、长文、项目和关于，首页第一屏是站内检索。纯静态输出，部署在 Cloudflare Pages，没有后端。

## 技术栈

- **Astro 7**（`output: 'static'`）+ **TypeScript**
- **Tailwind CSS v4**：承载设计令牌（`src/styles/tokens.css`）；版式与定制组件手写在 `src/styles/site.css`、`prose.css`
- **Starwind UI**：通用交互组件（表格、Toast 等），CLI 拷入 `src/components/starwind/`，主题变量映射到设计令牌
- **动效**：Astro 视图过渡（`ClientRouter` + 悬停预取）、GSAP（按需懒加载）、CSS 滚动驱动动画；系统开启「减少动态效果」时全部关闭
- **站内检索**：构建期输出 `/search-index.json`，浏览器端 BM25（中文一元 + 二元切分），零依赖
- **测试**：Vitest（单元）、Playwright（端到端）

## 本地开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm build      # 构建到 dist/
pnpm preview    # 预览构建产物
pnpm check      # 类型检查
pnpm test       # 单元测试
pnpm test:e2e   # 端到端测试（首次需 pnpm exec playwright install chromium）
```

## 内容怎么写

内容都是 Markdown 文件，构建期用 zod 校验 frontmatter（定义在 `src/content.config.ts`），字段不合规会直接构建失败。

| 集合 | 目录 | 一个文件是 | 页面 |
| --- | --- | --- | --- |
| `article` | `src/content/article/` | 一篇文章 | `/article`、`/article/<文件名>` |
| `feed` | `src/content/feed/` | 一条情报，文件名如 `2026-10-29-1610-xxx.md` | `/feed`、首页 |
| `tools` | `src/content/tools/` | 一个工具 | `/tools` |
| `projects` | `src/content/projects/` | 一个项目（`tier: small` 为「还有一批小的」） | `/projects`、首页、关于 |

- 文章的编号、字数、阅读时长、「带代码 / 带数据」都在构建时自动算，不需要手填。
- 各页的统计数字（共 N 条、本周新增等）都由内容算出；「今日 / 本周」在浏览器端按当前时间重算。
- 站点常量（品牌、导航、联系方式）在 `src/consts.ts`。

### Mock 内容

标了 `mock: true` 的条目是占位内容。页面只要渲染了 mock 内容就会输出 `noindex`，不会被搜索引擎收录。
正式上线时在 Cloudflare Pages 生产环境设置环境变量 `SHOW_MOCK=false`，构建会排除全部 mock 条目；空区块会自动隐藏。
关于页正文和 `src/consts.ts` 里标了 `MOCK` 的值需要手动替换。

## 品牌素材

- 原图：`src/assets/brand/source/upwind.png`（主题图，列子御风）、`logo.png`（网站图标）
- 处理后：`src/assets/brand/upwind-hero.png`（透明底，首页、关于页、作者卡使用）、`upwind-mark.png`（透明底图标）
- `public/`：`favicon-16/32/48/192/512.png`、`apple-touch-icon.png`、`og.png`（1200×630 默认分享图）
- 换图后重新生成这些文件：背景转透明、裁切、缩放，规则见本次改版记录

## 目录结构

```
src/
├─ consts.ts           站点常量
├─ content.config.ts   四个内容集合的 schema
├─ content/            Markdown 内容
├─ lib/                内容读取、派生统计、日期、检索（search/）、图片算法（image-tools/）
├─ scripts/            客户端脚本：生命周期、检索界面、列表筛选、动效、相对时间、弹层
├─ components/
│  ├─ site/            顶栏、页脚、面包屑、页头、检索浮层、移动端菜单…
│  ├─ content/         情报行、文章卡、项目块、终端块…
│  ├─ starwind/        Starwind UI 组件（已按设计令牌调整）
│  ├─ tools/           图片治理工具的控制层、选区交互、Worker
│  └─ ui/              SmartImage（构建期图片优化）
├─ layouts/Base.astro  全站布局：SEO、顶栏、页脚、全局检索
├─ pages/              页面与静态接口（search-index.json / rss.xml / sitemap.xml / robots.txt）
└─ styles/             tokens / site / prose / image-tool / starwind
public/_headers        Cloudflare Pages 响应头（安全头 + CSP）
e2e/                   Playwright 端到端测试
docs/                  需求、设计、方案文档
```

## 部署到 Cloudflare Pages

| 配置项 | 值 |
| --- | --- |
| 构建命令 | `pnpm build` |
| 输出目录 | `dist` |
| Node 版本 | 由 `.nvmrc` 指定（20），或设环境变量 `NODE_VERSION=20` |
| 环境变量 | 正式上线时 `SHOW_MOCK=false` |

`public/_headers` 会随产物输出，由 Cloudflare Pages 自动应用。

改版方案与组件选型记录见 `docs/2026-10-29-个人网站v5改版-落地方案.md`、`docs/2026-10-29-个人网站v5改版-组件方案验证.md`。
