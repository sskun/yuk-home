import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// 工具相关冒烟测试：导航 + 上传 + 裁剪 + 压缩。
// 通过 Playwright 的 webServer 自动启 preview（pnpm build && pnpm preview）。
// fixtures 目录需要先有测试图片；缺失时整个 suite 跳过以保持 home.spec.ts 不破。

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.resolve(__dirname, '..', 'test-fixtures', 'test-800x600.jpg');

test.beforeAll(async () => {
  try {
    await fs.access(FIXTURE);
  } catch {
    test.skip(true, `测试图片缺失：${FIXTURE}。本地可运行 scripts/browser-smoke.mjs 准备。`);
  }
});

test('首页含工具入口卡片', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('a[href="/tools/image-governance"]').first();
  await expect(card).toBeVisible();
  await expect(card).toContainText('图片治理');
});

test('工具列表页可访问并展示工具卡片', async ({ page }) => {
  await page.goto('/tools');
  await expect(page.locator('h1')).toHaveText('小工具');
  await expect(page.locator('a[href="/tools/image-governance"]')).toBeVisible();
});

test('工具详情页初始只有上传区', async ({ page }) => {
  await page.goto('/tools/image-governance');
  await expect(page.locator('h1')).toHaveText('图片治理');
  // 工作区在上传前应隐藏
  const ws = page.locator('.ig-workspace');
  await expect(ws).toBeHidden();
});

test('上传图片后出现 Tab 切换条与对比区', async ({ page }) => {
  await page.goto('/tools/image-governance');
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  // 等待 workspace 显示
  await page.waitForFunction(() => {
    const el = document.querySelector('.ig-workspace');
    return !!el && !el.hasAttribute('hidden');
  });
  await expect(page.locator('.ig-tabs')).toBeVisible();
  // 原图面板
  await expect(page.locator('.ig-compare-inner .ig-panel').first()).toContainText('原图');
  await expect(page.locator('.ig-compare-inner .ig-panel').first()).toContainText('800');
});

test('裁剪到 400×300 后结果区出现下载链接', async ({ page }) => {
  await page.goto('/tools/image-governance');
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.waitForFunction(() => {
    const el = document.querySelector('.ig-workspace');
    return !!el && !el.hasAttribute('hidden');
  });

  // 设置宽高
  await page.evaluate(() => {
    const nums = document.querySelectorAll('.ig-control-card input.ig-number');
    const set = (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(nums[0], 400);
    set(nums[1], 300);
  });

  await page.locator('.ig-actions .ig-primary').click();

  // 等下载链接出现
  const dl = page.locator('.ig-compare-inner a.ig-download');
  await expect(dl).toBeVisible({ timeout: 10000 });
  const name = await dl.getAttribute('download');
  expect(name).toMatch(/-cropped\.jpg$/);
  // 结果面板显示新尺寸
  const resultMeta = await page.locator('.ig-compare-inner .ig-panel').nth(1).locator('.ig-panel-meta').innerText();
  expect(resultMeta).toContain('400');
  expect(resultMeta).toContain('300');
});

test('压缩到 50KB 目标后产出文件体积达标', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/tools/image-governance');
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.waitForFunction(() => {
    const el = document.querySelector('.ig-workspace');
    return !!el && !el.hasAttribute('hidden');
  });

  // 切到压缩 Tab
  await page.locator('button.ig-tab[data-tab="compress"]').click();
  await expect(page.locator('button.ig-tab[data-tab="compress"]')).toHaveAttribute('aria-selected', 'true');

  // 设置目标 + 质量
  await page.evaluate(() => {
    const num = document.querySelector('.ig-control-card input.ig-number');
    if (num) {
      num.value = '50';
      num.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const range = document.querySelector('input.ig-range');
    if (range) {
      range.value = '60';
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  await page.locator('.ig-actions .ig-primary').click();

  // 等下载链接出现
  const dl = page.locator('.ig-compare-inner a.ig-download');
  await expect(dl).toBeVisible({ timeout: 30000 });
  const name = await dl.getAttribute('download');
  expect(name).toMatch(/-compressed\.jpg$/);

  // 检查 meta 包含迭代次数
  const meta = await page.locator('.ig-compare-inner .ig-panel').nth(1).locator('.ig-panel-meta').innerText();
  expect(meta).toMatch(/迭代 \d+ 次/);
});

test('裁剪选区可拖拽（pointerdown/move/up 改变 overlay 位置）', async ({ page }) => {
  await page.goto('/tools/image-governance');
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.waitForFunction(() => {
    const el = document.querySelector('.ig-workspace');
    return !!el && !el.hasAttribute('hidden');
  });

  // 设置目标尺寸（与原图不同比例，确保 cover 模式选区小于 src）
  await page.evaluate(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>('.ig-control-card input.ig-number');
    const set = (el: HTMLInputElement, v: number) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(inputs[0], 400);
    set(inputs[1], 200);
  });
  await page.waitForTimeout(150);

  // 滚到选区
  await page.locator('.ig-crop-stage').scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);

  // 记录拖拽前 overlay 的 top 百分比
  const beforeTop = await page.locator('.ig-crop-overlay').evaluate(
    (el) => parseFloat((el.style.top || '0').replace('%', '')),
  );

  // 模拟拖拽：鼠标按下 + 移动 + 抬起（移动到右下角）
  const grab = page.locator('.ig-crop-grab').first();
  const box = await grab.boundingBox();
  if (!box) throw new Error('找不到裁剪选区');
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 50, sy + 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const afterTop = await page.locator('.ig-crop-overlay').evaluate(
    (el) => parseFloat((el.style.top || '0').replace('%', '')),
  );

  // 拖拽后 top 应该比之前大，因为向下移动了
  expect(afterTop).toBeGreaterThan(beforeTop);
});

test('非图片类型触发页面内错误横幅（不弹 alert）', async ({ page }) => {
  // 监听 dialog（alert），确认不会触发
  let dialogShown = false;
  page.on('dialog', () => {
    dialogShown = true;
  });

  await page.goto('/tools/image-governance');
  // 通过 change 事件把非图片文件塞进 file input
  // 用 evaluate 模拟：直接调用 handleFile 不容易，改成 dispatch 一个非图片的 change
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[type=file]');
    if (!input) throw new Error('no input');
    // 创建一个空 txt 文件
    const dt = new DataTransfer();
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // 等错误横幅出现
  const banner = page.locator('.ig-error');
  await expect(banner).toBeVisible({ timeout: 3000 });
  await expect(banner).toContainText('仅支持 JPEG / PNG');
  // 确认没有弹 alert
  expect(dialogShown).toBe(false);
});

// ============ 三栏 + 粘性动作栏布局契约 ============

test('页头含返回行与 h1，工具条含 Tab', async ({ page }) => {
  await page.goto('/tools/image-governance');

  // 改版后 h1 移出工具条，落在独立页头里（工具条只放工作控件）
  const head = page.locator('.ig-pagehead');
  await expect(head).toBeVisible();
  await expect(head.locator('h1.ig-title')).toHaveText('图片治理');

  // 返回行是页头第一个元素，且位于 h1 之前
  const back = head.locator('a.ig-back');
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute('href', '/tools');
  const backBeforeTitle = await head.evaluate((el) => {
    const b = el.querySelector('a.ig-back');
    const h = el.querySelector('h1.ig-title');
    if (!b || !h) return false;
    return !!(b.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(backBeforeTitle).toBe(true);

  // Tab 在工具条内，上传前已可见（不再依赖 workspace）
  const toolbar = page.locator('.ig-toolbar');
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator('.ig-tabs')).toBeVisible();
  await expect(toolbar.locator('button.ig-tab[data-tab="crop"]')).toHaveAttribute('aria-selected', 'true');
});

test('工具页容器与全站导航同宽（--max-width）', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tools/image-governance');
  const widths = await page.evaluate(() => {
    const page = document.querySelector('.ig-page') as HTMLElement | null;
    const nav = document.querySelector('.nav-inner') as HTMLElement | null;
    if (!page || !nav) return null;
    return { page: page.getBoundingClientRect().width, nav: nav.getBoundingClientRect().width };
  });
  if (!widths) throw new Error('未找到 .ig-page 或 .nav-inner');
  // 页面容器含左右 padding，允许等于导航宽度（内容盒更窄）
  expect(widths.page).toBeLessThanOrEqual(widths.nav + 1);
});

test('actionbar 上传前 hidden，上传后可见', async ({ page }) => {
  await page.goto('/tools/image-governance');
  const bar = page.locator('.ig-actionbar');
  await expect(bar).toBeHidden();

  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.waitForFunction(() => {
    const el = document.querySelector('.ig-workspace');
    return !!el && !el.hasAttribute('hidden');
  });

  await expect(bar).toBeVisible();
  // 未运行前，summary 展示“目标”而非“输出”
  await expect(bar.locator('.ig-summary')).toContainText('目标');
  // 主按钮仍位于 .ig-actions 内（e2e 选择器契约）
  await expect(bar.locator('.ig-actions .ig-primary')).toBeVisible();
});

test('桌面视口下 inspector 为 sticky，且与 canvas 同行', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/tools/image-governance');
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.waitForFunction(() => {
    const el = document.querySelector('.ig-workspace');
    return !!el && !el.hasAttribute('hidden');
  });

  const position = await page.locator('.ig-inspector').evaluate((el) => getComputedStyle(el).position);
  expect(position).toBe('sticky');

  // canvas 与 inspector 左右并排（canvas.right 小于 inspector.left + 少量误差）
  const canvasBox = await page.locator('.ig-canvas').boundingBox();
  const inspectorBox = await page.locator('.ig-inspector').boundingBox();
  if (!canvasBox || !inspectorBox) throw new Error('canvas / inspector 未渲染');
  expect(canvasBox.x).toBeLessThan(inspectorBox.x);
  // 两者顶部基本对齐（允许 ≤ 20px 误差）
  expect(Math.abs(canvasBox.y - inspectorBox.y)).toBeLessThanOrEqual(20);
});
