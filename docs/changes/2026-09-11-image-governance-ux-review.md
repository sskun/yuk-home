# image-governance 工具 Review 与落地

日期：2026-09-11
范围：`src/pages/tools/image-governance.astro`、`src/components/tools/*`、`src/lib/image-tools/*`、相关测试与脚本。

## 一、Review 结论

工具核心逻辑（裁剪矩形计算、二分压缩迭代、Worker 异步、Web 上传处理）均已落地，单元测试覆盖 crop/compress/format，e2e 测试覆盖首页入口、列表页、详情页、上传、裁剪、压缩。但**当前页面在浏览器中完全空白**，用户实际看不到任何工具入口——这是阻塞 bug。

### 缺陷清单（按严重性排序）

| # | 等级 | 缺陷 | 位置 |
|---|------|------|------|
| 1 | **阻塞** | `data-animate` 元素 opacity:0 永久不可见 | `image-governance.astro` 未调用 `initAnimations()` |
| 2 | **规范违反** | emoji 作为 UI 图标（📁 / 🔒 / 🔓） | `ImageGovernance.ts:81,270` |
| 3 | **UX** | 错误用 `alert()`，阻断流程 | `ImageGovernance.ts` 多处 |
| 4 | **内存** | `URL.createObjectURL` 未 revoke | `renderCompare` 每次刷新都新建 URL |
| 5 | **核心交互缺失** | 裁剪选区固定中心裁剪，用户无法拖拽 / 调整 | `renderCropPreview` |
| 6 | **状态缺失** | 压缩按钮 busy 时无 loading 视觉 | `runCompress` |
| 7 | **可访问性** | `aria-label` 仅 "图片治理工具"；按钮缺可见焦点环状态 | 工具 root / `.ig-tab` |

## 二、目标

- 让工具可见（修阻塞 bug）。
- 替换 emoji 为 SVG inline（沿用站点设计语言）。
- 错误改为页面内提示带，不阻断操作。
- ObjectURL 在切换/重置时 revoke。
- 选区可鼠标拖拽 + 角点缩放（cover/自由两种语义）。
- 压缩时按钮显示 spinner/进度文案。

## 三、非目标

- 不引入 UI 框架（保持纯 DOM + scoped CSS）。
- 不改 `lib/image-tools/*` 纯函数（已通过单测）。
- 不改 Astro 外壳布局（仅修本页面动画初始化与样式补丁）。
- 不引入第三方图标库（手写 SVG）。

## 四、验收标准

1. 浏览器打开 `/tools/image-governance` 立即可见标题 + 上传区。
2. 控制台无 error（含 favicon 缺失可忽略，但其它不允许）。
3. 上传 JPEG 后可见 Tab、对比面板、裁剪参数区。
4. 裁剪选区可拖拽、四个角可缩放；保持比例锁定时宽高联动。
5. 压缩按钮运行中显示 spinner + 「压缩中…」文案，不可重复点击。
6. 所有错误提示在页面内顶部显示横幅，不弹窗。
7. 切换 Tab / 重置时上一张图的 ObjectURL 全部 revoke。
8. 现有 vitest 与 playwright 用例全绿。
9. 新增 e2e：选区拖拽后输出尺寸与选区一致；错误提示横幅存在性。

## 五、测试计划

- 单元：保持现有 `lib/image-tools/*` 测试不变。
- e2e（playwright）：
  - 新增「页面初始即可见 h1」断言。
  - 新增「选区拖拽后 apply 输出与选区对应像素」断言。
  - 新增「上传非图片时出现错误横幅」断言。
  - 现有 4 个测试维持。