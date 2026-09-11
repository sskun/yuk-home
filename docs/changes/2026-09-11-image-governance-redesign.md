# image-governance 顶部改版 + daisyUI 接入

日期：2026-09-11
分支：`iamge-tool`
范围：`src/pages/tools/image-governance.astro`、`src/components/tools/ImageGovernance.ts`、`src/styles/global.css`（新增）、`astro.config.mjs`、`src/layouts/Layout.astro`

## 一、问题

顶部 `ig-view` 一屏塞了 4 层语义（面包屑 / H1 / 文件 chip / 模式 Tab），层级被压平：

1. H1「图片治理」仅 16px，夹在面包屑与文件 chip 之间，读起来像导航项而非页面标题
2. `← 工具 / 图片治理` 用 4 个元素表达一件事（箭头 + 文字 + 斜杠 + 标题）
3. Tab（裁剪 / 压缩）被推到最右，与它控制的画布隔约 1000px，严重脱节
4. 工具条用 999px 胶囊，下方卡片用 14px 圆角，是两套形状语言
5. 工具页容器 `max-width: 1400px`，全站导航 `--max-width: 1080px`，左右各错位 40px —— 这是「不精致」最直接的来源
6. 顶部两条浮动栏（导航 + 工具条）间距仅 12px，拥挤

## 二、目标

- 顶部重组为**三段式**：返回行 / 页头 / 精简工具条，语义各归其位。
- 容器统一到 `--max-width`（1080px），与全站导航左右对齐。
- 引入 daisyUI（Astro 生态最流行的组件库），接管「组件形状」的样式。
- 首页 / 工具列表 / 文章页**零视觉回归**。

## 三、非目标

- 不改 `src/lib/image-tools/*` 纯函数（已有单测）。
- 不改裁剪交互逻辑（`crop-interaction.ts`）与压缩 Worker。
- 不重写首页 / 文章页的样式体系。
- 不引入 React / Vue 等框架集成。

## 四、验收标准

1. 返回按钮位于页面最顶部，在 H1 之上，独立成行。
2. H1 可见字号 ≥ 1.6rem，与工具条解耦；工具条内不再有面包屑与标题。
3. Tab 紧邻文件 chip（同一视觉组），不再被推到最右。
4. 工具页容器宽度 = `--max-width`；工具条、页头、工作区左边缘在同一垂线上。
5. 工具条 / 动作栏 / 检查器卡片使用同一套圆角语言（daisyUI `--radius-box`）。
6. 交互组件形状类样式由 daisyUI 类名承担（btn / tabs / input / range / alert / loading）。
7. 首页、`/tools`、文章页截图与改动前逐像素无差异（允许 ≤ 0.1% 抗锯齿噪声）。
8. `pnpm build`、`pnpm test`、`pnpm test:e2e` 全绿。

## 五、设计

### 5.1 页面结构

```
┌─ 固定导航（全站，1080）──────────────────────────┐
└──────────────────────────────────────────────────┘

  ← 返回工具                              ← 返回行（页面第一个元素）

  图片治理                                ← H1 1.75rem
  裁剪与压缩图片 · 全程在浏览器完成，不上传服务器

  ┌─ 粘性工具条（daisyUI）────────────────────────┐
  │ [▣ photo.jpg 800×600·67KB ✕] │ [裁剪|压缩]  ⟳ │
  └───────────────────────────────────────────────┘

  ┌─ 画布 ───────────────┐  ┌─ 检查器 ──────┐
  │   (crop stage)       │  │ 源文件 / 参数  │
  └──────────────────────┘  └───────────────┘

  ┌─ 粘性动作栏 ─────────────────────────────────┐
  │ 目标 800 × 600              │ [应用裁剪]      │
  └──────────────────────────────────────────────┘
```

### 5.2 daisyUI 接入方式（关键：控制爆炸半径）

现有 5 个页面全部依赖 `Layout.astro` 里手写的 `:root` 令牌，**Tailwind 的 preflight 会重置它们**。因此：

- **不引入 preflight**：只引 `tailwindcss/theme.css` 与 `tailwindcss/utilities.css` 两层，
  跳过 `preflight.css`，全站基础样式不受影响。
- **主题按区块作用域**：daisyUI 主题命名 `yukhome`，**不设 `default: true`**，
  只在工具页根元素 `data-theme="yukhome"` 激活。其余页面拿不到 daisyUI 主题变量。
- **品牌色引用站点变量**：主题内 `--color-primary: var(--site-primary)` 指向
  `Layout.astro` 内联的 `theme.primaryColor`，改 config 时自动跟随。不能直接写
  `var(--color-primary)` —— 那是 daisyUI 自己的变量名，会构成自引用而失效。
- **`include` 收敛组件**（最关键的一条，见 7.1）。

### 5.3 组件映射

| 位置 | 原手写 | daisyUI |
|---|---|---|
| 返回行 | `.ig-crumb` 胶囊 | `btn btn-ghost btn-sm` |
| 文件 chip | `.ig-filechip` | `btn btn-ghost btn-sm`（含缩略图） |
| 模式 Tab | `.ig-tabs` / `.ig-tab` | `tabs tabs-box` / `tab` |
| 换一张 | `.ig-reset-icon` | `btn btn-circle btn-ghost btn-sm` |
| 主按钮 | `.ig-primary` | `btn btn-primary` |
| 错误横幅 | `.ig-error` | `alert alert-error` |
| 检查器卡片 | `.ig-control-card` | **保留手写**（见下） |
| 数字输入 | 手写 input | `input input-sm` |
| 滑块 | 手写 range | `range range-primary range-sm` |
| 锁比例 | `.ig-lock` | `btn btn-sm` / `btn-active` |
| 下载 | `.ig-download` | `btn btn-block btn-sm btn-outline` |

**保留手写 CSS**：
- crop stage / 选区遮罩 / 8 个拖拽手柄 / 空态 dropzone —— daisyUI 无对应组件，
  且这些是像素级定制的图像交互层，抽象成组件只会更难维护。
- 检查器卡片（`.ig-panel-card` / `.ig-control-card` / `.ig-compare`）—— daisyUI 的
  `card` 会铺 `bg-base-100` 的**不透明**底色，而站点卡片用的是 `--surface`
  半透明表面叠在 body 环境光上。换成 `card` 会盖掉环境光、画面变闷，
  且 `card` 恰好是 7.1 里会撞车的类名之一。

因此实际 `include` 的组件只有 6 个：`button, tab, input, range, alert, loading`。

## 六、测试计划与结果

| 项目 | 命令 | 结果 |
|---|---|---|
| 单元测试 | `pnpm test` | ✓ 86/86 通过 |
| e2e | `pnpm test:e2e` | ✓ 16/16 通过（构建产物，非 dev server） |
| 构建 | `pnpm build` | ✓ 6 页构建成功 |
| 类型检查 | `pnpm check` | 14 个既有错误，**均在未改动文件**（`content.config.ts` / `ArticleLayout.astro` / `article/[...slug].astro`） |
| 视觉回归 | 改动前后全页截图逐像素比对 | ✓ 首页 / `/tools` / 文章页 **差异 0 像素** |

### 视觉回归方法

Tailwind 接入的最大风险是污染既有页面，因此做了严格验证，而不是靠肉眼：

1. 同一份构建连截两次建立**噪声基线**：20/5348160 = 0.0004%（渲染基本确定性）。
2. 截图前注入 `animation:none; transition:none` —— 首屏 H1 带 9s 无限流光动画，
   不冻结会产生 0.33% 的**假阳性**差异（第一轮验证正是被这个误导）。
3. 构建两次（接入前 / 接入后）逐像素比对，阈值 ±2/通道。

### e2e 契约变更

`e2e/tools.spec.ts` 中原有的 `toolbar 页面初始即可见，包含 h1 与 Tab` 断言
h1 位于 `.ig-toolbar` **内部** —— 这正是本次改版要推翻的结构（标题移出工具条）。
该用例已改为断言新契约：`.ig-pagehead` 含 `h1.ig-title`，且 `a.ig-back` 在 DOM 中
先于 h1（返回行位于页面最顶部）。同时新增容器宽度对齐的断言。
其余选择器契约（`.ig-toolbar` / `.ig-tabs` / `.ig-actions .ig-primary` /
`.ig-workspace` / `.ig-inspector`）全部保留未改。

## 七、风险与对策

| 风险 | 对策 |
|---|---|
| Tailwind preflight 重置全站样式 | 不引 preflight；截图比对三页 |
| daisyUI 主题变量外溢到其它页面 | 主题不设 default，靠 `data-theme` 作用域 |
| **daisyUI 类名与站点类名撞车** | **`include` 只生成用到的组件，见 7.1** |
| 品牌色编译期写死，与 config 脱钩 | 主题变量用 `var(--site-primary)` 引用站点令牌 |
| e2e 选择器契约被改版打破 | 保持 `.ig-*` 语义类名，daisyUI 类名叠加而非替换 |

### 7.1 实测发现的真实冲突（已修复，勿回退）

**daisyUI 默认把全部组件的 CSS 全局输出，而它的类名非常通用。** 站点自建样式是先于
daisyUI 存在的，一旦同名就会被动继承 daisyUI 的属性。

实测到的冲突（`include` 生效前）：

| 站点类 | 位置 | 站点是否声明 `display` | 被 daisyUI 覆盖成 |
|---|---|---|---|
| `.card` | `FeatureSection.astro:61` | ✗ | `display:flex; flex-direction:column` |
| `.footer` | `FooterSection.astro:36` | ✗ | `display:grid` |
| `.badge` | `ToolGridSection.astro:178` | ✗ | `display:inline-flex` |

三者叠加使首页整体高度少了 6px。注意 `ArticleCard.astro` 的 `.card` 和
`HeroSection.astro` 的 `.hero` 自己声明了 `display`，因此未受影响 —— 也就是说
**是否出问题取决于站点那条规则恰好有没有写 `display`，非常隐蔽**。

对策：`global.css` 里 `include: button, tab, input, range, alert, loading;`
只生成工具页用到的 6 个组件。站点已占用 `.card / .footer / .hero / .badge / .link`，
**这些组件永远不要 include**。新增组件前先 grep 确认站点没有同名选择器。

### 7.2 为什么不用 `prefix`

daisyUI 支持 `prefix`，能提供更强的隔离保证，但本项目的类名前缀已是 `ig-`
（`.ig-tabs` / `.ig-tab` / `.ig-input` / `.ig-range`），加 `prefix: "ig-"` 会与
站点自己的命名空间正面冲突。改用其他前缀（如 `dui-`）则会让工具页的 HTML 里
混着 `dui-btn` 与 `ig-toolbar` 两套前缀，可读性下降。权衡后选 `include`：
在能用标准 daisyUI 类名的前提下把冲突面收敛到零。
