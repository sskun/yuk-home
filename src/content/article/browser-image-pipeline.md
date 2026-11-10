---
title: 浏览器端图片治理：格式、体积与肉眼差距
description: 同一批截图，按目标体积压缩时，选质量档位比选格式更重要。顺便记下 Web Worker 里迭代压缩的写法。
pubDate: 2026-09-06
category: 工程
tags: [图片, 本地优先]
mock: true
---

## 为什么放在浏览器里

截图里经常有不能外发的内容，在线压缩站又大多要上传。

## 迭代压缩

在 Worker 里先降质量，质量到下限还不够再缩尺寸，直到满足目标体积。

```ts
for (let q = 0.92; q > 0.4; q -= 0.08) {
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: q });
  if (blob.size <= target) return blob;
}
```
