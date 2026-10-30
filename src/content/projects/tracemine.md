---
order: 1
name: 拾迹 TraceMine
oneLine: 本机 AI 编程工作记录查询与学习工具。Codex、Claude Code、Cursor、Kiro 等工具的本地会话，汇成一条时间线。
version: v0.1.2
updated: 2026-10-28
status: 在线
shot: /src/assets/projects/tracemine-overview.png
shotCaption: npx tracemine start — 拾迹 TraceMine
term:
  - '$ npx tracemine start'
  - '> 汇总 10 款 AI 工具的本地会话'
  - '> 数据只存本机'
metrics:
  - { k: 支持的 AI 工具, v: '10', unit: 款 }
  - { k: 启动方式, v: npx, unit: 一行 }
  - { k: 上传数据, v: '0', unit: 字节 }
stack: [Node.js, React, SQLite, CLI]
open: https://www.npmjs.com/package/tracemine
links:
  - { label: '打开项目 →', href: 'https://www.npmjs.com/package/tracemine', primary: true }
  - { label: 源码, href: 'https://github.com/sskun/ai-log-miner' }
mock: false
---

**起因**：同时用好几款 AI 编程工具之后，工作记录散在各自的本地目录里，想回头找「上周那次是怎么让它改对的」几乎不可能。

**关键决策**：不做云同步，只读本机已有的会话文件，汇成时间线，并保留执行日志和来源追溯；数据存在本地 SQLite，一行 `npx` 就能启动，不需要账号。

**下一步**：补充学习笔记的整理能力，让一次会话里学到的东西能沉淀下来。
