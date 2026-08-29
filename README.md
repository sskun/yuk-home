# yuk-home

基于 [Astro](https://astro.build/) 的静态优先个人宣发首页，作为项目与 Demo 的统一入口。页面所有可见内容都由配置文件驱动，组件不写死任何业务文案。

本项目主要适配seo,主要是做文章发送和记录，个人门户网站，也算是项目点的引流。

## 技术栈

- **Astro**（`output: 'static'`）：构建期渲染为纯静态 HTML，默认零 JS。
- **TypeScript**：配置类型契约与运行时校验。
- **Vitest + fast-check**：单元测试与属性测试（校验逻辑）。
- **Playwright**：端到端冒烟测试。
- 部署：**Cloudflare Pages**。

## 本地开发

```bash
pnpm install
pnpm dev        # 启动开发服务器
pnpm build      # 构建到 dist/
pnpm preview    # 本地预览构建产物
pnpm test       # 单元 / 属性测试
pnpm test:e2e   # 端到端冒烟测试（首次需 pnpm exec playwright install chromium）
```

## 内容配置（核心）

页面内容集中在 `src/config/site.config.ts` 维护，类型与校验在 `src/config/schema.ts`。
修改文案、增删区块、调整顺序都只改配置文件，无需改动组件。

区块类型（可辨识联合）：

- `hero`：首屏主视觉（主标题 / 副标题 / CTA / 背景动画）
- `feature`：特性卡片网格
- `showcase`：项目 / Demo 入口卡片（面向未来扩展）
- `footer`：版权与链接

配置在构建期会经 `validateConfig` 校验，字段非法时构建中止并打印字段路径。

## 目录结构

```
src/
├─ config/        # 站点配置与校验（schema.ts / site.config.ts）
├─ layouts/       # 全局布局与基础样式（Layout.astro）
├─ components/    # 区块组件族 + SectionRenderer 分发器
├─ scripts/       # 客户端动画脚本（animate.ts）
└─ pages/         # index.astro 首页装配器
public/_headers   # Cloudflare Pages 响应头（安全头 + CSP）
e2e/              # Playwright 冒烟测试
```

## 动画与无障碍

动画基于 `IntersectionObserver` + CSS `transform`/`opacity`（GPU 合成）。采用渐进增强：

- 禁用 JS 时内容完整可见（`html` 无 `.js` 标记则不隐藏元素）。
- 尊重 `prefers-reduced-motion`，减少动态时直接展示终态。

## 部署到 Cloudflare Pages

在 Cloudflare Pages 控制台创建项目并连接本仓库，构建设置如下：

| 配置项 | 值 |
| --- | --- |
| 构建命令（Build command） | `pnpm build` |
| 输出目录（Build output directory） | `dist` |
| Node 版本 | 由 `.nvmrc` 指定（20），或设环境变量 `NODE_VERSION=20` |

`public/_headers` 会随产物输出到 `dist/_headers`，由 Cloudflare Pages 自动应用响应头。

> 性能目标：Lighthouse 移动端性能 ≥ 95。建议部署后用 Lighthouse 实测确认。
