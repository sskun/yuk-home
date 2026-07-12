# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.ts >> 外链均带 rel="noopener noreferrer"
- Location: e2e/home.spec.ts:16:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('a[target="_blank"]').nth(6)
Expected: "noopener noreferrer"
Received: ""
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for locator('a[target="_blank"]').nth(6)
    14 × locator resolved to <a target="_blank" href="https://astro.build/integrations/">View all</a>
       - unexpected value "null"

```

```yaml
- banner:
  - navigation "主导航":
    - link "yuk 首页":
      - /url: /
      - text: yuk
    - list:
      - listitem:
        - link "首页":
          - /url: /
      - listitem:
        - link "文章":
          - /url: /article
      - listitem:
        - link "GitHub":
          - /url: https://github.com
- heading "用 Astro 构建极速站点" [level=1]
- paragraph: 内容驱动 · 默认零 JS · 部署即上线
- link "了解特性":
  - /url: "#features"
- link "阅读文章":
  - /url: /article
- link "查看展示":
  - /url: "#showcase"
- link "Astro 官网":
  - /url: https://astro.build
- link "向下滚动查看更多":
  - /url: "#features"
- heading "为什么选择 Astro" [level=2]
- paragraph: 一个面向内容站点的现代 Web 框架，把性能作为默认值。
- article:
  - text: ⚡
  - heading "极速加载" [level=3]
  - paragraph: 默认零 JavaScript，构建期渲染为静态 HTML，首屏飞快。
- article:
  - text: 🧩
  - heading "岛屿架构" [level=3]
  - paragraph: 只为需要交互的组件按需注水（hydrate），其余保持纯静态。
- article:
  - text: 🌐
  - heading "框架无关" [level=3]
  - paragraph: React、Vue、Svelte 等组件可在同一项目中混用。
- article:
  - text: 🚀
  - heading "轻松部署" [level=3]
  - paragraph: 静态产物一键部署到 Cloudflare Pages 等平台，全球 CDN 分发。
- article:
  - text: 📝
  - heading "内容优先" [level=3]
  - paragraph: 内置内容集合与 Markdown/MDX 支持，天然适合博客与文档。
- article:
  - text: 🔧
  - heading "开发体验" [level=3]
  - paragraph: 基于 Vite 的极速热更新与开箱即用的 TypeScript 支持。
- heading "项目与 Demo 入口" [level=2]
- link "示例项目占位 这里将展示我的项目介绍，点击进入详情或在线体验。 Astro Demo":
  - /url: https://example.com
  - heading "示例项目占位" [level=3]
  - paragraph: 这里将展示我的项目介绍，点击进入详情或在线体验。
  - list:
    - listitem: Astro
    - listitem: Demo
- link "Demo 占位 未来的交互式 Demo 入口，配置化新增，无需改动页面代码。 WIP":
  - /url: https://example.com
  - heading "Demo 占位" [level=3]
  - paragraph: 未来的交互式 Demo 入口，配置化新增，无需改动页面代码。
  - list:
    - listitem: WIP
- contentinfo:
  - paragraph: © 2026 yuk · Built with Astro
  - list:
    - listitem:
      - link "GitHub":
        - /url: https://github.com
    - listitem:
      - link "Astro Docs":
        - /url: https://docs.astro.build
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | // 首页冒烟测试：验证区块存在、外链安全、渐进增强。
  4  | 
  5  | test('页面加载且各区块存在', async ({ page }) => {
  6  |   await page.goto('/');
  7  |   // 四个区块的锚点 id 应都存在
  8  |   await expect(page.locator('#hero')).toBeVisible();
  9  |   await expect(page.locator('#features')).toBeVisible();
  10 |   await expect(page.locator('#showcase')).toBeVisible();
  11 |   await expect(page.locator('#footer')).toBeVisible();
  12 |   // 首屏主标题来自配置
  13 |   await expect(page.locator('#hero h1')).toHaveText('用 Astro 构建极速站点');
  14 | });
  15 | 
  16 | test('外链均带 rel="noopener noreferrer"', async ({ page }) => {
  17 |   await page.goto('/');
  18 |   const externalLinks = page.locator('a[target="_blank"]');
  19 |   const count = await externalLinks.count();
  20 |   expect(count).toBeGreaterThan(0);
  21 |   for (let i = 0; i < count; i++) {
> 22 |     await expect(externalLinks.nth(i)).toHaveAttribute('rel', 'noopener noreferrer');
     |                                        ^ Error: expect(locator).toHaveAttribute(expected) failed
  23 |   }
  24 | });
  25 | 
  26 | test('动画元素最终会显示（进入视口后 in-view）', async ({ page }) => {
  27 |   await page.goto('/');
  28 |   const hero = page.locator('#hero h1');
  29 |   await expect(hero).toHaveClass(/in-view/);
  30 | });
  31 | 
  32 | test.describe('渐进增强：禁用 JS', () => {
  33 |   test.use({ javaScriptEnabled: false });
  34 | 
  35 |   test('禁用 JS 时区块内容仍完整可见', async ({ page }) => {
  36 |     await page.goto('/');
  37 |     await expect(page.locator('#hero h1')).toBeVisible();
  38 |     await expect(page.locator('#features')).toBeVisible();
  39 |     // 无 JS 时 html 不应带有 .js 标记，data-animate 元素不被隐藏
  40 |     await expect(page.locator('html')).not.toHaveClass(/\bjs\b/);
  41 |     await expect(page.locator('#hero h1')).toHaveText('用 Astro 构建极速站点');
  42 |   });
  43 | });
  44 | 
```