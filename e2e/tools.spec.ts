import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

// 图片治理工具：上传 → 裁剪 / 压缩 → 下载。测试图片在内存里生成，不依赖本地 fixture 文件。
let jpeg: Buffer;
test.beforeAll(async () => {
  // 800×600 的噪声图，保证压缩有可压的体积
  const raw = Buffer.alloc(800 * 600 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 251;
  jpeg = await sharp(raw, { raw: { width: 800, height: 600, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
});

async function upload(page: Page) {
  await page.goto('/tools/image-governance');
  await page.locator('input[type=file]').setInputFiles({ name: 'test-800x600.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  await expect(page.locator('.ig-workspace')).toBeVisible();
}

test('工具库里能找到图片治理入口', async ({ page }) => {
  await page.goto('/tools');
  await expect(page.locator('a[href="/tools/image-governance"]').first()).toBeVisible();
});

test('上传前只有上传区，页头与面包屑正确', async ({ page }) => {
  await page.goto('/tools/image-governance');
  await expect(page.locator('h1')).toHaveText('图片治理');
  await expect(page.locator('.crumb a[href="/tools"]')).toBeVisible();
  await expect(page.locator('.ig-drop')).toBeVisible();
  await expect(page.locator('.ig-workspace')).toBeHidden();
});

test('上传后显示文件信息、源文件尺寸和 Tab', async ({ page }) => {
  await upload(page);
  await expect(page.locator('.ig-file-meta')).toContainText('800 × 600');
  await expect(page.locator('[role=tab][data-tab="crop"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.ig-crop-overlay')).toBeVisible();
});

test('裁剪到 400×300 后出现下载链接与对比滑块', async ({ page }) => {
  await upload(page);
  await page.locator('#ig-crop-w').fill('400');
  await page.locator('#ig-crop-h').fill('300');
  await page.locator('.ig-run-btn').click();
  const dl = page.locator('a.ig-result-dl');
  await expect(dl).toBeVisible();
  await expect(dl).toHaveAttribute('download', /cropped/);
  await expect(page.locator('.ig-result-dim')).toContainText('400 × 300');
  await expect(page.locator('.ig-compare-range')).toBeAttached();
});

test('压缩到 50KB 目标后体积达标', async ({ page }) => {
  await upload(page);
  await page.locator('[role=tab][data-tab="compress"]').click();
  await page.locator('#ig-target-kb').fill('50');
  await page.locator('.ig-run-btn').click();
  const dl = page.locator('a.ig-result-dl');
  await expect(dl).toBeVisible({ timeout: 20_000 });
  await expect(dl).toHaveAttribute('download', /compressed/);
  const size = await dl.evaluate(async (a: HTMLAnchorElement) => (await (await fetch(a.href)).blob()).size);
  expect(size).toBeLessThanOrEqual(50 * 1024);
});

test('Tab 支持方向键切换', async ({ page }) => {
  await upload(page);
  await page.locator('[role=tab][data-tab="crop"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[role=tab][data-tab="compress"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#ig-target-kb')).toBeVisible();
});

test('拖动裁剪选区会改变位置', async ({ page }) => {
  await upload(page);
  await page.locator('#ig-crop-w').fill('200');
  await page.locator('#ig-crop-h').fill('200');
  const ov = page.locator('.ig-crop-overlay');
  const before = await ov.boundingBox();
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x + before!.width / 2 + 60, before!.y + before!.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  const after = await ov.boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(10);
});

test('非图片文件显示页内错误横幅，不弹 alert', async ({ page }) => {
  let dialog = false;
  page.on('dialog', () => (dialog = true));
  await page.goto('/tools/image-governance');
  await page.locator('input[type=file]').setInputFiles({ name: 'a.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await expect(page.locator('.ig-error')).toContainText('JPEG / PNG / WebP');
  expect(dialog).toBe(false);
});

test('桌面端参数面板 sticky 且与画面同行', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await upload(page);
  const panel = page.locator('.ig-panel');
  expect(await panel.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
  const p = await panel.boundingBox();
  const s = await page.locator('.ig-preview-col').boundingBox();
  expect(Math.abs(p!.y - s!.y)).toBeLessThan(4);
});

test('换一张会回到上传区', async ({ page }) => {
  await upload(page);
  await page.locator('.ig-replace-btn').click();
  await expect(page.locator('.ig-drop')).toBeVisible();
  await expect(page.locator('.ig-workspace')).toBeHidden();
});
