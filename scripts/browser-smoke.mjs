// 浏览器端到端冒烟：跑真实 Chrome，加载 /tools/image-governance，
// 上传测试 JPEG，跑裁剪 + 压缩两个 Tab，截屏并打印关键文本。
// 用 puppeteer-core，不引 puppeteer 自带的 Chromium。

import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '..', 'test-fixtures', 'test-800x600.jpg');
const SHOTS_DIR = path.resolve(__dirname, '..', 'test-fixtures', 'shots');

await fs.mkdir(SHOTS_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

const errors = [];
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});

async function shot(name) {
  const p = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`[shot] ${p}`);
}

try {
  // 1. 首页
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
  await shot('01-home');
  const navText = await page.$eval('nav.nav-inner', (el) => el.innerText);
  console.log('[nav]', navText.replace(/\s+/g, ' '));

  const toolsCard = await page.$('a[href="/tools/image-governance"]');
  console.log('[home] tools card present:', !!toolsCard);

  // 2. 工具列表页
  await page.goto('http://localhost:4321/tools', { waitUntil: 'networkidle0' });
  await shot('02-tools-list');
  const h1 = await page.$eval('h1', (el) => el.innerText);
  console.log('[tools list] h1:', h1);

  // 3. 详情页 + 上传 + 裁剪
  await page.goto('http://localhost:4321/tools/image-governance', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.ig-workspace', { hidden: true, timeout: 5000 });
  await shot('03-detail-empty');

  const fileInput = await page.$('input[type=file]');
  if (!fileInput) throw new Error('file input not found');
  await fileInput.uploadFile(FIXTURE);
  console.log('[upload] uploaded', FIXTURE);

  await page.waitForFunction(() => {
    const ws = document.querySelector('.ig-workspace');
    return ws && !ws.hidden;
  }, { timeout: 5000 });
  await shot('04-after-upload');

  // 读取原始信息
  const originalSize = await page.$eval('.ig-compare-inner .ig-panel:nth-child(1) .ig-panel-size', (el) => el.innerText);
  const originalMeta = await page.$eval('.ig-compare-inner .ig-panel:nth-child(1) .ig-panel-meta', (el) => el.innerText);
  console.log('[original]', { size: originalSize, meta: originalMeta });

  // 设置 400x300 并应用：直接 set value + dispatch input 事件，避免 detach
  await page.evaluate(() => {
    const nums = document.querySelectorAll('.ig-control-card input.ig-number');
    if (nums.length >= 2) {
      const setVal = (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setVal(nums[0], '400');
      setVal(nums[1], '300');
    }
  });
  await shot('05-crop-inputs');

  // 点击应用裁剪
  const applyBtn = await page.$('.ig-actions .ig-primary');
  console.log('[apply button text]', await applyBtn.evaluate((el) => el.innerText));
  await applyBtn.click();

  await page.waitForFunction(() => {
    const dl = document.querySelector('.ig-compare-inner a.ig-download');
    return !!dl;
  }, { timeout: 8000 });
  await shot('06-crop-result');

  const cropSize = await page.$eval('.ig-compare-inner .ig-panel:nth-child(2) .ig-panel-size', (el) => el.innerText);
  const cropMeta = await page.$eval('.ig-compare-inner .ig-panel:nth-child(2) .ig-panel-meta', (el) => el.innerText);
  const dlName = await page.$eval('.ig-compare-inner a.ig-download', (el) => el.getAttribute('download'));
  console.log('[crop result]', { size: cropSize, meta: cropMeta, downloadName: dlName });

  // 4. 切换到压缩 Tab
  const compressTab = await page.$('button.ig-tab[data-tab="compress"]');
  await compressTab.click();
  await page.waitForFunction(() => {
    const t = document.querySelector('button.ig-tab[data-tab="compress"]');
    return t && t.getAttribute('aria-selected') === 'true';
  }, { timeout: 3000 });
  await shot('07-compress-tab');

  // 设置目标 50 KB，质量 60：直接 set value + dispatch input 事件
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
  await shot('08-compress-inputs');

  const compBtn = await page.$('.ig-actions .ig-primary');
  console.log('[compress button text]', await compBtn.evaluate((el) => el.innerText));
  await compBtn.click();

  await page.waitForFunction(() => {
    const dl = document.querySelector('.ig-compare-inner a.ig-download');
    if (!dl) return false;
    const txt = document.querySelector('.ig-compare-inner .ig-panel:nth-child(2) .ig-panel-size')?.innerText ?? '';
    // 等到结果出现且不再显示迭代中的瞬时态
    return /\d/.test(txt) && txt !== '—';
  }, { timeout: 30000 });

  await shot('09-compress-result');

  const compSize = await page.$eval('.ig-compare-inner .ig-panel:nth-child(2) .ig-panel-size', (el) => el.innerText);
  const compMeta = await page.$eval('.ig-compare-inner .ig-panel:nth-child(2) .ig-panel-meta', (el) => el.innerText);
  const compDl = await page.$eval('.ig-compare-inner a.ig-download', (el) => el.getAttribute('download'));
  console.log('[compress result]', { size: compSize, meta: compMeta, downloadName: compDl });

  console.log('\n=== ERRORS ===');
  if (errors.length === 0) console.log('(none)');
  else errors.forEach((e) => console.log(' -', e));
} catch (e) {
  console.error('TEST FAILED:', e.message);
  await shot('99-error');
  console.log('\n=== ERRORS ===');
  errors.forEach((e) => console.log(' -', e));
  process.exitCode = 1;
} finally {
  await browser.close();
}
