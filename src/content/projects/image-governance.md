---
order: 2
name: 图片治理
oneLine: 浏览器里把图片裁剪到指定像素尺寸，或按目标体积压缩。文件全程不离开你的设备。
updated: 2026-10-29
status: 在线
shotCaption: upwind/tools/image-governance — 图片治理
shotLines:
  - '> 裁剪  1920 × 1080 → 800 × 600 · 4:3'
  - '> 压缩  目标 200 KB · Worker 迭代质量与尺寸'
  - '> 上传  0 字节 · 全部在浏览器里完成'
term:
  - '$ open /tools/image-governance'
  - '> worker ready · 0 upload'
  - '> 裁剪 · 压缩 · 下载'
metrics:
  - { k: 比例预设, v: '7', unit: 种 }
  - { k: 单张上限, v: '20', unit: MB }
  - { k: 上传数据, v: '0', unit: 字节 }
stack: [TypeScript, Web Worker, Canvas, Astro]
open: /tools/image-governance
links:
  - { label: '打开工具 →', href: '/tools/image-governance', primary: true }
  - { label: 源码, href: 'https://github.com/sskun/yuk-home' }
mock: false
---

**起因**：日常要把截图裁到固定尺寸、压到平台要求的体积以内，在线工具大多要上传文件，处理隐私截图时心里不踏实。

**关键决策**：所有处理都放在浏览器里完成。压缩用 Web Worker 在后台迭代质量和尺寸，直到满足目标体积，主线程不卡；裁剪选区可以拖拽，比例可锁定。

**下一步**：支持批量处理和更多输出格式。
