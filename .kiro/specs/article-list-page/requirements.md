# Requirements Document

_需求文档：文章列表页（article-list-page）_

## Introduction

_引言_

本功能在现有站点上新增一个**文章列表页**，聚合 `src/content/article/` 内容集合中的全部文章，以卡片形式展示，点击卡片跳转到对应文章详情页（复用已有的 `/article/<slug>` 路由）。同时在首页增加一个进入列表页的入口。

本功能建立在已完成的「文章内容集合 + 详情页」之上（`src/content.config.ts`、`src/pages/article/[...slug].astro`、`src/layouts/ArticleLayout.astro`），复用其数据模型（frontmatter schema）与设计令牌（design tokens），保持与站点整体一致的视觉与配置驱动风格。

## Glossary

_术语表_

- **文章集合（Article Collection）**：定义于 `src/content.config.ts` 的 Astro 内容集合，数据源为 `src/content/article/` 下的 md 文件。
- **列表页（List Page）**：路由 `/article`，展示全部非草稿文章的索引页面。
- **详情页（Detail Page）**：路由 `/article/<slug>`，展示单篇文章内容，已存在。
- **草稿（Draft）**：frontmatter 中 `draft: true` 的文章，不对外发布。
- **配置驱动（Config-Driven）**：页面可见文案尽量由配置提供，组件不硬编码业务文案（沿用站点既有原则）。
- **设计令牌（Design Tokens）**：`Layout.astro` 中定义的全局 CSS 变量（如 `--surface`、`--border`、`--color-primary`）。

## Requirements

### Requirement 1: 文章列表页路由

**User Story:** 作为访问者，我希望通过 `/article` 访问一个文章列表页，以便浏览站点上的所有文章。

#### Acceptance Criteria

1. THE 系统 SHALL 在路由 `/article` 提供文章列表页，且不与既有的详情页路由 `/article/<slug>` 冲突。
2. WHEN 构建站点 THEN 系统 SHALL 从 `article` 内容集合读取全部文章条目生成列表页（构建期静态渲染）。
3. WHEN 列表页在无客户端 JavaScript 的情况下加载 THEN 系统 SHALL 保证文章列表内容完整可见。

### Requirement 2: 文章卡片展示

**User Story:** 作为访问者，我希望每篇文章以卡片形式展示标题、摘要等信息，以便快速判断是否感兴趣。

#### Acceptance Criteria

1. THE 系统 SHALL 为每篇文章渲染一张卡片，包含 `title`（标题）与 `description`（摘要）。
2. WHERE 文章 frontmatter 提供了 `pubDate` THE 系统 SHALL 在卡片上展示格式化后的发布日期。
3. WHERE 文章 frontmatter 提供了 `tags` THE 系统 SHALL 在卡片上展示标签。
4. WHEN 用户点击某张文章卡片 THEN 系统 SHALL 跳转到该文章对应的详情页 `/article/<slug>`。

### Requirement 3: 草稿过滤与排序

**User Story:** 作为站点作者，我希望草稿不出现在列表中，且文章按时间倒序排列，以便读者优先看到最新内容。

#### Acceptance Criteria

1. WHERE 文章 `draft` 为 `true` THE 系统 SHALL 不在列表页展示该文章（与详情页的草稿策略一致）。
2. WHEN 渲染列表 THEN 系统 SHALL 按 `pubDate` 降序排列文章（新在前）。
3. IF 文章未提供 `pubDate` THEN 系统 SHALL 将其排在有日期的文章之后，并以标题作为稳定的次级排序键。

### Requirement 4: 空状态

**User Story:** 作为访问者，当没有任何已发布文章时，我希望看到友好的提示，而不是空白页面。

#### Acceptance Criteria

1. IF 过滤草稿后没有任何文章 THEN 系统 SHALL 展示一个友好的空状态提示，而非空白或报错。

### Requirement 5: 首页入口

**User Story:** 作为访问者，我希望在首页能找到进入文章列表页的入口，以便发现文章内容。

#### Acceptance Criteria

1. THE 系统 SHALL 在首页提供一个指向 `/article` 的可见入口。
2. THE 该入口 SHALL 通过站点配置（`site.config.ts`）驱动，不在组件中硬编码。

### Requirement 6: SEO 与元信息

**User Story:** 作为站点作者，我希望列表页具备基本 SEO 元信息，以便被正确索引与分享。

#### Acceptance Criteria

1. WHEN 渲染列表页 THEN 系统 SHALL 输出 `<title>`、`<meta name="description">` 与语言属性 `lang`。
2. THE 列表页的标题与描述文案 SHALL 由站点配置提供，组件不硬编码业务文案。

### Requirement 7: 视觉与一致性

**User Story:** 作为访问者，我希望列表页视觉精致且与站点整体风格统一，以便获得良好的浏览体验。

#### Acceptance Criteria

1. THE 系统 SHALL 复用 `Layout.astro` 的设计令牌与全局样式，保持与首页/详情页一致的配色与排版。
2. THE 卡片网格 SHALL 响应式布局，在移动端单列、在宽屏多列自适应。
3. WHERE 站点全局动画开关开启 THE 列表页卡片 SHALL 复用既有 `data-animate` 进入视口动画契约；`prefers-reduced-motion` 时直接展示终态。
4. WHEN 鼠标悬停在卡片上 THEN 系统 SHALL 提供与展示区块一致的悬停反馈（轻微上浮与描边高亮）。

### Requirement 8: 配置校验

**User Story:** 作为站点作者，我希望列表页相关配置写错时能在构建阶段被提示，以便尽早修正。

#### Acceptance Criteria

1. WHERE 站点配置提供了列表页元信息（`articleIndex`）THE 系统 SHALL 在 `validateConfig` 中校验其必填字段（标题、描述、页面标题）非空。
2. IF `articleIndex` 存在且字段非法 THEN 系统 SHALL 抛出 `ConfigError` 并中止构建，错误信息含字段路径。
3. IF 站点配置未提供 `articleIndex` THEN 系统 SHALL 使用合理的缺省文案，且不报错。
