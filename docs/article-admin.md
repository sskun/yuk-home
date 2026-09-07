# 文章管理后台：需求与设计文档

## 1. 背景与目标

当前站点是 Astro `output: 'static'` 项目，文章保存在 `src/content/article/*.md`，Cloudflare Pages 从 GitHub `main` 分支构建并托管 `dist/`。

本功能为站点增加一个仅供站点作者使用的文章管理后台。后台保存文章时直接提交或更新 GitHub `main` 分支文件；Cloudflare Pages 由 Git 提交自动触发构建；文章是否对外生成页面由 Markdown frontmatter 的 `draft` 字段控制。

目标是降低写作和发布成本，同时保留以下能力：

- Markdown 可读、可在 GitHub 中直接维护；
- Git 历史可审计、可回滚；
- Astro 内容集合继续在构建期校验；
- 公开站点继续保持静态输出、SEO 和 CDN 性能；
- 不维护文章数据库，也不把正文改成 JSON 主存储。

## 2. 设计结论

本期采用“轻量自建后台 + Cloudflare Pages Function/Worker + GitHub 文件存储”的方案：

- 不引入数据库、D1、R2 或独立 CMS 数据库；
- 不使用分支、Pull Request 或人工合并作为发布门槛；
- 不要求 Decap CMS；
- 文章 Markdown 是唯一事实来源；
- 后台保存直接提交 `main`；
- `draft: true` 表示草稿，`draft: false` 表示发布意图；
- Cloudflare Pages 构建成功后，发布意图才会成为公开页面。

Decap CMS 可以作为未来可替换的后台 UI，但不是本期依赖。当前项目是单作者文章站，自建薄后台更容易固定安全边界、复用现有文章字段，并避免额外维护 CMS OAuth 适配层。

公开 Astro 站点保持静态输出。后台页面输出静态页面壳，只有管理 API 使用 Cloudflare Pages Functions/Worker 访问 GitHub。

## 3. 术语与发布语义

- **文章源文件**：`src/content/article/` 下的 Markdown 文件，是文章的唯一事实来源。
- **草稿**：frontmatter 中 `draft: true` 的文章。草稿提交到 `main` 后仍不会生成公开列表和详情页。
- **已发布文章**：frontmatter 中 `draft: false` 的文章。构建成功后生成公开页面。
- **后台保存**：通过后台校验后向 GitHub `main` 分支创建或更新文章文件的 commit，不等同于 Cloudflare 构建已完成。
- **上线**：文章 commit 已进入 `main`，且 Cloudflare Pages 构建成功并开始提供新产物。
- **内容路径**：限定在 `src/content/article/` 下的文章文件路径，不允许后台写入任意仓库文件。

本期发布流程固定为：

```text
后台编辑
  -> Pages Function 鉴权与校验
  -> GitHub main 分支 commit
  -> Cloudflare Pages 自动触发构建
  -> 构建成功后文章按 draft 状态上线或下线
```

因此：

- 保存草稿：commit 到 `main`，`draft: true`，不会公开；
- 发布文章：commit 到 `main`，`draft: false`，构建成功后公开；
- 下线文章：commit 到 `main`，`draft: true`，构建成功后不再公开；
- GitHub commit 成功不等于 Cloudflare 部署成功，后台必须区分这两个状态。

## 4. 范围

### 4.1 本期范围

1. 文章列表：读取 GitHub 中的文章文件并展示标题、状态、发布时间、更新时间和标签。
2. 新建文章：填写 frontmatter 和 Markdown 正文，默认保存为草稿。
3. 编辑文章：修改已有文章并提交到 `main`。
4. 上线/下线：通过 `draft` 开关控制，保存后等待 Cloudflare Pages 自动构建。
5. 文章校验：后台保存前校验 slug、frontmatter 和正文输入，保持与 Astro 构建契约一致。
6. 权限保护：后台页面和管理 API 仅允许经过 Cloudflare Access 的站点作者访问。
7. GitHub 写入：使用 Cloudflare Pages Function/Worker 代理 GitHub API，浏览器不得接触 GitHub Token。
8. 结果反馈：展示校验失败、保存成功、版本冲突和上游 GitHub 错误等可操作信息。

### 4.2 非本期范围

- 不迁移现有 Markdown 数据，也不把文章正文改为 JSON 主存储；
- 不做多人协作、角色权限、审核流和定时发布；
- 不做图片上传、媒体库、评论、阅读统计和全文搜索；
- 不提供物理删除文章的默认操作，下线使用 `draft: true`；
- 不改变公开文章列表、详情页、SEO 和 Mermaid 渲染的现有行为。

## 5. 总体架构

```mermaid
flowchart LR
    A[作者浏览器\n/admin] -->|Cloudflare Access| B[静态后台壳]
    B --> C[/api/admin/*\nPages Function]
    C --> D[Access 身份校验]
    C --> E[文章解析与 schema 校验]
    C --> F[GitHub Contents API\nmain 分支]
    F --> G[src/content/article/**/*.md]
    G --> H[Cloudflare Pages Git 构建]
    H --> I[dist 静态产物]
    I --> J[公开 /article 页面]
```

### 5.1 模块边界

| 模块 | 职责 | 不负责的事情 |
| --- | --- | --- |
| `src/pages/admin/index.astro` | 输出后台静态页面壳和表单入口 | 不保存 Token，不直接调用 GitHub |
| 后台客户端脚本 | 列表、表单、状态提示、调用同源 API | 不实现 GitHub 权限和仓库写入 |
| `functions/api/admin/*` | 鉴权、输入校验、GitHub 读写、错误归一化 | 不渲染公开文章，不保存业务数据库 |
| GitHub 客户端模块 | 访问指定仓库的 Contents API，携带 branch 与 sha | 不接受任意仓库或任意文件路径 |
| 文章 schema/序列化模块 | 解析和生成 Markdown frontmatter，保持 Astro 契约 | 不决定页面路由或部署状态 |
| `src/content.config.ts` | Astro 构建期最终校验并读取文章集合 | 不处理后台请求 |
| Cloudflare Pages | 监听 `main` commit，构建并发布 `dist` | 不承担文章编辑状态存储 |

## 6. 需求与验收标准

### 需求 1：后台入口与鉴权

**用户故事**：作为站点作者，我希望只有自己可以进入文章后台和调用管理 API。

验收标准：

1. 系统 SHALL 提供后台入口 `/admin`。
2. `/admin` 与 `/api/admin/*` SHALL 受 Cloudflare Access 保护。
3. 未通过鉴权的请求 SHALL 不得读取文章内容、创建 commit 或更新文件。
4. GitHub Token SHALL 只存在于 Cloudflare Secret/环境变量中，不得出现在静态资源、响应正文或浏览器请求参数中。

### 需求 2：文章列表

**用户故事**：作为站点作者，我希望在后台看到仓库中的文章和发布状态。

验收标准：

1. 系统 SHALL 读取 `src/content/article/**/*.md` 文件，并排除其他仓库路径。
2. 列表 SHALL 展示 slug、标题、`draft` 状态、`pubDate`、`updatedDate` 和标签。
3. 列表 SHALL 支持按全部、草稿、已发布状态筛选。
4. 列表读取失败时 SHALL 展示错误原因和重试入口，不得显示为“没有文章”。

### 需求 3：新建文章

**用户故事**：作为站点作者，我希望在后台创建一篇文章并保存为草稿或直接发布。

验收标准：

1. 新建表单 SHALL 提供 slug、标题、摘要、发布时间、更新时间、草稿开关、标签、作者、分享图、规范链接和 Markdown 正文字段。
2. 新文章的草稿开关 SHALL 默认开启，避免新建内容意外上线。
3. slug SHALL 只允许安全的相对路径；不得包含 `..`、反斜杠、查询字符或以 `/` 开头。
4. 系统 SHALL 将文章序列化为 `src/content/article/<slug>.md` 并提交到 `main`。
5. 已存在同一路径时 SHALL 拒绝创建并返回冲突，不得覆盖原文件。

### 需求 4：编辑、上线与下线

**用户故事**：作为站点作者，我希望修改文章，并通过 `draft` 开关控制其是否对外可见。

验收标准：

1. 编辑保存 SHALL 更新对应 Markdown 文件并直接提交到 `main`。
2. `draft: true` 的文章 SHALL 不出现在现有 `/article` 列表，也 SHALL 不生成对应详情页。
3. 将 `draft` 从 `true` 改为 `false` 并保存后，Cloudflare Pages 构建成功时 SHALL 生成公开文章页面。
4. 将 `draft` 从 `false` 改为 `true` 并保存后，Cloudflare Pages 构建成功时 SHALL 移除公开文章页面。
5. 后台 SHALL 明确提示：保存成功只代表 GitHub commit 成功，生产可见性取决于后续 Cloudflare Pages 构建。
6. 系统 SHALL 使用 GitHub 文件版本 `sha` 做乐观并发控制；版本不一致时返回冲突，不得覆盖其他更新。

### 需求 5：内容契约与构建一致性

**用户故事**：作为站点作者，我希望后台保存成功的内容不会因为字段格式错误导致构建失败。

验收标准：

1. 后台校验 SHALL 覆盖当前文章集合的字段：`title`、`description`、`pubDate`、`updatedDate`、`draft`、`tags`、`author`、`image`、`canonical`。
2. `title` 与 `description` SHALL 为非空字符串。
3. 日期 SHALL 使用可被 Astro 内容集合解析的日期格式；空值可以省略。
4. `draft` SHALL 为布尔值，`tags` SHALL 为字符串数组。
5. 后台校验通过后仍保留 Cloudflare 构建校验；任何构建失败不得被后台报告为“已上线”。
6. 内容正文 SHALL 原样保留 Markdown；系统不得把正文转换为 JSON 字符串作为主存储。

### 需求 6：错误、反馈与安全边界

**用户故事**：作为站点作者，我希望失败时知道是否写入成功，以及下一步该做什么。

验收标准：

1. 参数错误 SHALL 返回 `400`，并指出字段路径。
2. 未鉴权/无权限 SHALL 返回 `401` 或 `403`，不得返回 GitHub Token 或上游敏感细节。
3. 文件不存在 SHALL 返回 `404`；新建时路径已存在 SHALL 返回 `409`。
4. SHA 冲突 SHALL 返回 `409`，并提示刷新后重新编辑。
5. GitHub 限流或上游不可用 SHALL 返回 `429` 或 `502`，并明确本次写入是否未发生。
6. 后台 SHALL 在提交前完成所有本地校验；校验失败时不得调用 GitHub 写入接口。

### 需求 7：静态站点兼容性

**用户故事**：作为访问者，我希望增加后台后公开站点仍保持现有静态、SEO 和性能特征。

验收标准：

1. 公开站点 SHALL 继续使用 Astro `output: 'static'`。
2. 公开页面 SHALL 继续由 `src/content/article/*.md` 在构建期生成，不依赖运行时数据库或 API。
3. 后台不可用、GitHub 暂时不可用或 JavaScript 被禁用时，不得影响已经部署的公开文章。
4. 现有 `pnpm build`、文章 schema 测试和公开页面冒烟测试 SHALL 保持通过。

## 7. 内容模型与文件规则

### 7.1 文章文件

文章继续使用现有格式：

```text
src/content/article/<slug>.md
```

示例：

```md
---
title: 文章标题
description: 文章摘要
pubDate: 2026-09-06
updatedDate: 2026-09-06
draft: true
tags: [Astro, Cloudflare]
author: yuk
image: /images/articles/example.png
canonical: https://example.com/article/example
---

正文 Markdown
```

后台保存时显式写出 `draft`，不依赖缺省值，避免作者无法判断文章是否会公开。

### 7.2 slug 与路径安全

当前详情路由支持 `entry.id` 作为路径。后台应支持字母、数字、连字符、下划线和多级目录，但必须拒绝：

- `..` 路径段；
- 反斜杠；
- 以 `/` 开头或包含查询/片段字符；
- 空路径或只包含空白；
- `.md` 之外的扩展名。

规范化后的仓库路径必须满足：

```text
src/content/article/${normalizedSlug}.md
```

不能通过 slug 改写到 `src/config`、`public`、`functions` 或仓库外部路径。

### 7.3 共享 schema

当前 `src/content.config.ts` 使用 `astro:content` 内的 zod schema。后台运行在 Pages Function 中，不能直接依赖 Astro 的虚拟模块，因此实现时应抽出一个纯模块，例如：

```text
src/content/article-schema.ts
```

该模块只包含普通 TypeScript/Zod 类型、字段校验和 Markdown frontmatter 序列化规则；`src/content.config.ts` 和后台 Function 都复用它。具体字段契约保持当前内容集合定义，不新增后台专用字段。

如果需要引入 `zod` 或 frontmatter 解析库，应将其声明为项目直接依赖，并确保浏览器端不打包服务端 GitHub 客户端和密钥读取逻辑。

## 8. 后台页面设计

### 8.1 页面结构

```text
/admin
├── 顶部：站点名、当前身份、刷新
├── 文章列表：标题、slug、状态、日期、标签、编辑入口
└── 编辑区：文章字段、Markdown 正文、保存按钮、结果提示
```

第一版采用单页列表 + 编辑表单，不引入复杂路由和富文本编辑器。正文使用本地 Markdown textarea；预览不是本期上线条件。

### 8.2 表单行为

- 新建文章时默认 `draft: true`；
- 点击“保存草稿”或“保存并上线”实际都是一次保存请求，区别只在提交前设置 `draft` 值；
- 编辑已发布文章时，表单展示当前 `draft` 状态，禁止因刷新丢失未保存内容；
- 保存成功后刷新当前文章的 GitHub `sha`，提示“已提交到 main，等待 Cloudflare Pages 构建”；
- 409 冲突时保留用户正在编辑的内容，提示重新读取后手动合并，不自动覆盖；
- 文章下线使用“保存为草稿”，不提供默认物理删除按钮。

## 9. API 契约

所有管理 API 均为同源请求，前缀为 `/api/admin`，由 Pages Function 处理。具体 Functions 文件布局可根据 Cloudflare 路由约定实现，但不得把 Token 交给客户端。

### 9.1 列表

```text
GET /api/admin/articles?status=all|draft|published
```

响应示例：

```json
{
  "items": [
    {
      "slug": "astro-serverless-personal-site",
      "path": "src/content/article/astro-serverless-personal-site.md",
      "title": "用 Astro + Cloudflare Pages 零服务器搭建高性能个人网站",
      "draft": false,
      "pubDate": "2026-07-12",
      "updatedDate": null,
      "tags": ["Astro", "Cloudflare Pages"],
      "sha": "..."
    }
  ]
}
```

列表只返回管理页面需要的元数据；正文通过详情接口单独读取。列表读取失败时必须展示错误原因和重试入口，不能显示为空列表。

### 9.2 读取详情

```text
GET /api/admin/articles/:slug
```

响应包含：

- `slug`、`path`；
- 解析后的 frontmatter；
- Markdown `body`；
- GitHub 文件 `sha`。

### 9.3 新建

```text
POST /api/admin/articles
Content-Type: application/json
```

请求体为表单字段和 `body`。服务端校验通过后调用 GitHub Contents API 的创建文件接口，固定 `branch=main`。路径已存在时返回 `409`。

### 9.4 更新

```text
PUT /api/admin/articles/:slug
Content-Type: application/json
```

请求体必须包含读取详情时获得的 `sha`。服务端先校验 slug 和内容，再使用该 `sha` 调用 GitHub 更新文件接口。GitHub 返回 SHA 不匹配时映射为 `409`。

成功响应至少包含：

```json
{
  "ok": true,
  "commit": {
    "sha": "...",
    "url": "https://github.com/.../commit/..."
  },
  "deployment": "pending"
}
```

`deployment: pending` 表示 GitHub commit 已完成，但 Cloudflare Pages 构建尚未确认；本期不把 Cloudflare 部署状态伪装成同步成功。

### 9.5 暂不提供删除接口

物理删除会改变历史路径并可能导致外部链接失效。本期以设置 `draft: true` 代替下线。若未来确实需要删除，应单独增加确认、备份和回滚设计，不在本期范围内。

## 10. GitHub 写入设计

### 10.1 凭据

MVP 使用一个只授权目标仓库的 GitHub Fine-grained Token，存储为 Cloudflare Secret，例如：

```text
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH=main
```

Token 只授予目标仓库的 Contents 读写权限。API 层仍通过路径白名单限制只能写入 `src/content/article/`。未来多人或更严格审计场景可替换为 GitHub App Installation Token，不改变前台 API 契约。

### 10.2 写入顺序

```text
鉴权
  -> 解析 JSON
  -> 校验 slug 和字段
  -> 生成 Markdown
  -> 检查新建/更新条件
  -> 带 branch=main、sha 调 GitHub
  -> 返回 commit 信息
```

任何校验失败都必须在 GitHub 写入前返回。更新操作必须带旧 SHA，防止后台标签页覆盖其他更新。

### 10.3 Git commit

commit message 使用稳定格式，便于历史检索，例如：

```text
content(article): create <slug>
content(article): update <slug>
```

后台不创建分支、不创建 Pull Request、不执行 merge。`main` 是本期唯一发布分支。

## 11. 鉴权与安全

### 11.1 Cloudflare Access

Cloudflare 控制台配置 Access Application，至少保护：

- `/admin*`；
- `/api/admin/*`。

Pages Function 仍应读取 Access 注入的身份信息做服务端校验，作为边界防御，不能只依赖前端是否显示登录页面。

### 11.2 输入与响应安全

- 所有管理 API 只接受预期的 HTTP 方法和 JSON 内容类型；
- 不记录 GitHub Token、完整 Authorization header 或文章正文到日志；
- 错误响应只返回可操作信息，不直接透传上游响应中的凭据或内部头信息；
- 文章正文和 frontmatter 输出到 HTML 前继续由 Astro/Markdown 管道转义，不把后台输入作为原始 HTML 注入公开页面；
- 保持 `public/_headers` 的同源 CSP；后台 API 使用同源请求，不新增第三方脚本依赖。

## 12. 错误处理与状态模型

| 场景 | HTTP | 前台行为 | 是否写入 GitHub |
| --- | ---: | --- | --- |
| 未登录 | 401 | 跳转/提示 Access 登录 | 否 |
| 无权限 | 403 | 显示无权限 | 否 |
| 字段或 slug 非法 | 400 | 定位字段并保留表单内容 | 否 |
| 新建路径已存在 | 409 | 提示切换到编辑 | 否 |
| 编辑文件不存在 | 404 | 刷新列表 | 否 |
| SHA 冲突 | 409 | 提示重新读取并手动合并 | 否 |
| GitHub 限流 | 429 | 提示稍后重试 | 不确定，必须按响应确认 |
| GitHub/网络错误 | 502 | 提示本次未确认写入，允许重试 | 不确定，显示 commit 查询入口 |
| commit 成功 | 200/201 | 显示 commit 链接和构建等待提示 | 是 |
| Astro/Cloudflare 构建失败 | 由平台产生 | 公开站点保留上一次成功版本，后台提示需查看部署日志 | 是 |

特别是 GitHub 网络错误不能简单显示“未写入”。如果上游响应不确定，后台应引导用户先刷新文章和 GitHub commit，再决定是否重试，避免重复提交。

## 13. 兼容性与回滚

- 公开路由仍由 Astro 构建期生成，后台 API 不参与访客请求；
- `draft` 过滤继续复用现有 `/article` 列表页和 `[...slug].astro` 详情页逻辑；
- 构建失败时 Cloudflare Pages 通常继续提供上一次成功部署；
- GitHub commit 保留在历史中，可通过 GitHub revert 手动回滚；
- MVP 不实现后台一键回滚，但每次文章保存都必须有独立且可识别的 Git commit。

## 14. 测试与验收计划

### 14.1 自动化验证

- 文章序列化/解析和 frontmatter 校验：Vitest，覆盖正常、空值、非法日期、非法标签和草稿切换；
- GitHub 客户端：使用真实请求格式的 mock 边界测试，覆盖新建、更新、已存在、SHA 冲突和上游错误；
- API 鉴权：覆盖缺失 Access 身份、合法身份和不允许路径；
- 构建：`pnpm check`、`pnpm test`、`pnpm build`；
- 公开站点：现有 Playwright 测试，并增加草稿过滤和文章链接回归；
- 后台交互：Playwright 覆盖新建草稿、编辑、状态提示和冲突时保留表单。

### 14.2 手工验证

1. Cloudflare Access 允许作者访问 `/admin`，其他身份被拒绝。
2. 新建草稿后确认 GitHub `main` 有 commit，但公开 `/article` 不出现该文章。
3. 将同一文章改为 `draft: false`，确认构建完成后列表和详情页出现。
4. 再改回 `draft: true`，确认构建完成后文章从公开页面消失。
5. 两个页面同时编辑同一文章，后保存者收到 SHA 冲突且不覆盖先保存的内容。
6. 故意提交非法 frontmatter，确认后台拒绝写入且 GitHub 没有新增 commit。
7. 部署后确认 commit 成功、Cloudflare 构建等待中和构建失败三种状态提示不混淆。

### 14.3 设计 seam 与验证方式

| 设计 seam | 验证方式 |
| --- | --- |
| frontmatter 解析/序列化 | Vitest，使用真实 schema，测试日期、数组、布尔值、正文保留 |
| GitHub 客户端 | mock GitHub API 边界，验证 branch/path/sha/message/content 编码 |
| Function 路由 | 请求级测试，覆盖 400/401/403/404/409/502 |
| 草稿行为 | 构建临时文章集合或使用现有文章，验证 `draft` 不进入列表和静态详情 |
| 静态兼容 | `pnpm check`、`pnpm test`、`pnpm build` |
| Cloudflare 配置 | 部署后手工验证 Access、commit 触发构建和公开页面状态 |

## 15. 实施顺序

1. 抽取可被 Astro 与 Function 共同使用的文章 schema、frontmatter 解析和序列化模块。
2. 为解析/序列化、slug 安全和 `draft` 状态编写测试，先确认失败再实现。
3. 实现 GitHub 客户端和管理 API，先覆盖读取，再覆盖新建和带 SHA 更新。
4. 实现静态 `/admin` 列表和编辑表单，接入同源 API。
5. 配置 Cloudflare Access、Pages Secrets 和 GitHub Fine-grained Token。
6. 运行定向测试、类型检查和构建；再做一次部署后的草稿/发布/下线手工验收。

## 16. 未决配置项

实现前只需要确认以下环境值，不影响本设计的内容模型和发布语义：

- GitHub `owner/repo`；
- 生产分支是否确实为 `main`；
- Cloudflare Pages 项目绑定的正式域名；
- Cloudflare Access 允许的作者身份；
- 是否允许文章 slug 使用多级目录。

