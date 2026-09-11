// 临时烟雾测试：用 Node 24 的原生 createImageBitmap + sharp 不可用，因此用 canvas。
// 目标：真实加载一张 JPEG，跑 compress.ts 的迭代压缩逻辑，验证产出与体积目标。
//
// 用 dynamic import Node 内建库：node:fs / node:path / 第三方 'canvas' 不可用（未安装）。
// 这里我们不引入依赖，仅做"逻辑可调用性"验证：把 compressToTarget 用假 encode 跑一遍，
// 验证产物形态（EncodeResult 字段、blob size 关系）。

import { compressToTarget } from '../src/lib/image-tools/compress.ts';
import { calcCoverRect } from '../src/lib/image-tools/crop.ts';

const fakeEncode = async (_b, _mime, q) => ({
  size: Math.round(q * 200_000 + 20_000),
  type: 'image/jpeg',
});

const fakeBitmap = { width: 800, height: 600, close() {} };

const crop = calcCoverRect(800, 600, 400, 300, 'cover');
console.log('crop rect for 800x600 → 400x300:', crop);

const compressed = await compressToTarget(fakeBitmap, {
  targetBytes: 100_000,
  initialQuality: 0.92,
  encode: fakeEncode,
});
console.log('compress to 100KB:', { size: compressed.blob.size, q: compressed.quality, iterations: compressed.iterations, downscaled: compressed.downscaled });
