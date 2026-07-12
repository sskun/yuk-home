# Requirements Document

_需求文档：Astro 首页宣发页（astro-landing-page）_

## Introduction

_引言_

本功能构建一个基于 [Astro](https://astro.build/) 的静态优先个人宣发首页。首期内容是「Astro 技术介绍」，配合酷炫的入场与滚动动画，呈现类似个人宣发页的视觉效果，并部署在 Cloudflare Pages 上被顺利访问。

核心约束是**内容与展现分离**：页面所有可见内容（文案、区块顺序、动画参数、外链等）全部通过配置文件（`src/config/site.config.ts`）驱动，页面与组件不硬编码任何业务文案，以便未来低成本扩展为「项目介绍入口」或「个人 Demo 入口」。

本需求文档由设计文档（design.md）派生，编号与设计中的组件、数据模型、正确性属性相互对应。

## Glossary

_术语表_

- **区块（Section）**：页面从上到下的一个内容单元，由配置中的一项描述，含 `hero`/`feature`/`showcase`/`footer` 等类型。
- **配置驱动（Config-Driven）**：页面所有可见内容由配置文件 `src/config/site.config.ts` 提供，组件不硬编码业务文案。
- **可辨识联合（Discriminated Union）**：以 `type` 字段区分不同区块类型的联合类型，用于类型安全的分发渲染。
- **渐进增强（Progressive Enhancement）**：内容在无 JS 时仍完整可用，动画作为增强能力按需叠加。
- **CTA（Call To Action）**：行动号召按钮，如「了解更多」。
- **静态输出（Static Output）**：Astro `output: 'static'` 模式，构建产物为纯静态资源。

## Requirements

### Requirement 1: Astro 静态站点基础

**User Story:** 作为站点作者，我希望使用 Astro 以静态优先方式构建站点，以便获得极快的首屏并简化部署。

#### Acceptance Criteria

1. WHEN 执行项目构建 THEN 系统 SHALL 使用 Astro 以 `output: 'static'` 模式产出纯静态资源到 `dist/` 目录。
2. WHEN 首页在无客户端 JavaScript 的情况下加载 THEN 系统 SHALL 保证所有区块的文本内容完整可见（内容在构建期渲染为 HTML）。
3. WHERE 页面存在交互/动画 THE 系统 SHALL 仅将动画逻辑作为轻量客户端脚本按需加载，不阻塞首屏渲染。

### Requirement 2: Cloudflare Pages 部署

**User Story:** 作为站点作者，我希望站点能在 Cloudflare Pages 上成功构建并被顺利访问，以便对外分享。

#### Acceptance Criteria

1. WHEN 在 Cloudflare Pages 使用构建命令 `pnpm build` 且输出目录为 `dist` THEN 系统 SHALL 成功完成构建并生成可托管的静态产物。
2. WHEN 站点部署完成后被浏览器访问 THEN 系统 SHALL 正常返回首页且各区块可正常展示。
3. IF 构建所需的 Node 版本未正确配置 THEN 系统 SHALL 通过 `.nvmrc` 或环境变量 `NODE_VERSION` 提供明确的版本约束。

### Requirement 3: 配置驱动的内容（核心）

**User Story:** 作为站点作者，我希望在配置文件中维护所有页面内容，以便修改内容时无需改动组件代码。

#### Acceptance Criteria

1. THE 系统 SHALL 将站点元信息、主题参数与区块列表集中定义在 `src/config/site.config.ts` 中。
2. WHEN 渲染首页 THEN 系统 SHALL 严格按照 `config.sections` 的顺序与数量渲染区块（渲染结果与配置一一对应）。
3. THE 系统 SHALL 保证组件代码内不包含任何写死的业务文案；仅内容不同的两份合法配置，其渲染差异只来源于配置差异。
4. WHEN 需要新增、删除或重排区块 THEN 站点作者 SHALL 仅通过修改配置文件即可完成，无需修改组件代码。

### Requirement 4: Astro 介绍首页内容区块

**User Story:** 作为访问者，我希望在首页看到对 Astro 的清晰介绍，以便快速了解其价值。

#### Acceptance Criteria

1. THE 系统 SHALL 支持以下区块类型：`hero`（首屏主视觉）、`feature`（特性介绍）、`showcase`（展示项/入口）、`footer`（页脚）。
2. WHEN 配置中包含 `hero` 区块 THEN 系统 SHALL 渲染主标题、副标题与行动按钮（CTA）。
3. WHEN 配置中包含 `feature` 区块 THEN 系统 SHALL 渲染区块标题与一组特性卡片（图标/标题/描述）。
4. WHEN 配置中包含 `footer` 区块 THEN 系统 SHALL 渲染版权信息与社交/相关链接。

### Requirement 5: 酷炫动画与渐进增强

**User Story:** 作为访问者，我希望页面有酷炫的入场与滚动动画，同时在受限环境下依然可用，以便获得良好的观感与无障碍体验。

#### Acceptance Criteria

1. WHEN 带有 `data-animate` 标记的元素进入视口 THEN 系统 SHALL 通过添加 `.in-view` 类触发基于 CSS `transform`/`opacity` 的动画。
2. IF 用户系统开启了 `prefers-reduced-motion: reduce` THEN 系统 SHALL 跳过过渡动画并直接展示元素终态。
3. IF 客户端不支持 `IntersectionObserver` 或动画脚本抛错 THEN 系统 SHALL 兜底为所有 `[data-animate]` 元素直接展示终态，保证内容可见。
4. WHERE 主题配置的全局动画开关为关闭或区块 `animate` 为 `false` THE 系统 SHALL 不为该区块产生任何动画标记。

### Requirement 6: 面向未来的可扩展入口

**User Story:** 作为站点作者，我希望未来能把首页扩展为项目或 Demo 的入口，以便复用同一套页面。

#### Acceptance Criteria

1. THE 系统 SHALL 提供 `showcase` 区块类型，用于以卡片形式展示一组可点击的项目/Demo 入口项（标题、描述、链接、可选缩略图与标签）。
2. WHEN 新增一种区块类型时 THEN 系统 SHALL 通过可辨识联合（discriminated union）与分发器（SectionRenderer）扩展，而不破坏既有区块渲染。

### Requirement 7: 配置校验与错误处理

**User Story:** 作为站点作者，我希望配置写错时能在构建阶段被明确提示，以便尽早修正而非上线后才发现。

#### Acceptance Criteria

1. WHEN 执行构建 THEN 系统 SHALL 调用 `validateConfig` 对配置做运行时校验。
2. IF 配置存在非法项（必填字段为空、颜色非法、`sections` 为空、`id` 重复、未知 `type`）THEN 系统 SHALL 抛出 `ConfigError`、中止构建，并打印包含具体字段路径的全部错误信息。
3. WHEN 配置合法 THEN `validateConfig` SHALL 返回结构合法的 `SiteConfig` 且不修改输入对象（无副作用）。
4. IF 渲染阶段遇到未知区块类型 THEN 系统 SHALL 跳过该区块并输出告警，而不崩溃或产生错误 DOM。

### Requirement 8: SEO 与元信息

**User Story:** 作为站点作者，我希望页面具备基本的 SEO 元信息，以便被正确索引与分享。

#### Acceptance Criteria

1. WHEN 渲染页面 THEN 系统 SHALL 根据配置输出 `<title>`、`<meta name="description">` 与语言属性 `lang`。
2. WHERE 配置提供了 `ogImage` 或 `favicon` THE 系统 SHALL 在 `<head>` 中输出对应的社交分享图与站点图标标签。

### Requirement 9: 外链安全

**User Story:** 作为站点作者，我希望所有外部链接安全打开，以便避免 `window.opener` 劫持风险。

#### Acceptance Criteria

1. WHEN 某个链接项标记为 `external: true` THEN 系统 SHALL 渲染 `target="_blank"` 且包含 `rel="noopener noreferrer"`。

### Requirement 10: 性能

**User Story:** 作为访问者，我希望页面加载快速流畅，以便获得良好的浏览体验。

#### Acceptance Criteria

1. WHEN 页面在移动端被 Lighthouse 评估 THEN 系统 SHALL 以性能得分 ≥ 95 为目标（默认零 JS、CSS 动画走 GPU 合成、动画脚本 `defer` 加载）。
2. WHERE 页面包含图片 THE 系统 SHALL 优先使用 Astro 的图片优化能力（`astro:assets` 的 `<Image />`）以优化尺寸与格式。
