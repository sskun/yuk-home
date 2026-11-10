import { test, expect } from '@playwright/test';

// 站点冒烟：7 个页面可访问、导航高亮、无横向溢出、检索与筛选、视图过渡后仍可用、禁用 JS 降级。
const PAGES: [string, string | null][] = [
  ['/', null],
  ['/feed', '情报'],
  ['/tools', '工具库'],
  ['/article', '文章'],
  ['/article/astro-serverless-personal-site', '文章'],
  ['/projects', '项目'],
  ['/about', '关于'],
];

for (const [path, nav] of PAGES) {
  test(`页面 ${path} 可访问、导航高亮正确、无 JS 报错`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    const current = page.locator('.nav a[aria-current="page"]');
    if (nav) await expect(current).toHaveText(nav);
    else await expect(current).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}

for (const width of [1440, 390]) {
  test(`${width}px 宽度下各页无横向滚动`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [path] of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}

test('外链都带 rel="noopener noreferrer"', async ({ page }) => {
  for (const path of ['/', '/feed', '/tools', '/projects', '/about']) {
    await page.goto(path);
    const bad = await page.$$eval('a[target="_blank"]', (els) =>
      (els as HTMLAnchorElement[]).filter((a) => !/noopener/.test(a.rel) || !/noreferrer/.test(a.rel)).map((a) => a.href),
    );
    expect(bad, path).toEqual([]);
  }
});

test('首页检索：输入即出分组结果，命中词高亮', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-hero-search] input').fill('本地优先');
  const groups = page.locator('[data-hero-list] .sov-gh');
  await expect(groups.first()).toBeVisible();
  const labels = await groups.allTextContents();
  expect(labels.some((l) => l.startsWith('工具'))).toBe(true);
  expect(labels.some((l) => l.startsWith('文章'))).toBe(true);
  await expect(page.locator('[data-hero-list] mark').first()).toBeVisible();
  await page.locator('[data-hero-search] input').fill('zzqqxx');
  await expect(page.locator('[data-hero-list] .sov-empty')).toBeVisible();
});

test('全局检索浮层：/ 打开、↑↓ + Enter 跳转并定位、Esc 关闭', async ({ page }) => {
  await page.goto('/');
  await page.locator('h1').click();
  await page.keyboard.press('/');
  const dialog = page.locator('#site-search');
  await expect(dialog).toBeVisible();
  await page.keyboard.type('Ollama');
  await expect(dialog.locator('.sov-item').first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/tools#ollama$/);
  await expect(page.locator('#ollama')).toBeInViewport();
  await page.keyboard.press('Control+k');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('工具库筛选：chip 改变行数并写入 URL，刷新后还原', async ({ page }) => {
  await page.goto('/tools');
  const rows = page.locator('.tbl [data-item]:visible');
  const all = await rows.count();
  await page.locator('[data-chip-group="tag"] [data-value="命令行"]').click();
  await expect(page).toHaveURL(/tag=/);
  const filtered = await rows.count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(all);
  await page.reload();
  await expect(rows).toHaveCount(filtered);
});

test('情报流：默认 14 条，加载更多后展开', async ({ page }) => {
  await page.goto('/feed');
  const rows = page.locator('.log [data-item]:visible');
  const total = await page.locator('.log [data-item]').count();
  await expect(rows).toHaveCount(Math.min(14, total));
  if (total > 14) {
    await page.locator('[data-more]').click();
    await expect(rows).toHaveCount(total);
  }
});

test('视图过渡切页后，筛选与快捷键仍可用', async ({ page }) => {
  await page.goto('/');
  await page.locator('.nav a[href="/article"]').click();
  await expect(page).toHaveURL(/\/article$/);
  await page.locator('[data-chip-group="browse"] [data-value="y2025"]').click();
  await expect(page.locator('.acards [data-item]:visible')).not.toHaveCount(0);
  await page.locator('h1').click();
  await page.keyboard.press('/');
  await expect(page.locator('#site-search')).toBeVisible();
});

test('减少动态效果时内容立即可见', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.locator('.works').scrollIntoViewIfNeeded();
  const opacity = await page.locator('.work').first().evaluate((el) => getComputedStyle(el).opacity);
  expect(opacity).toBe('1');
  await ctx.close();
});

test('禁用 JS 时列表完整可见，筛选控件隐藏', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/feed');
  const total = await page.locator('.log [data-item]').count();
  await expect(page.locator('.log [data-item]:visible')).toHaveCount(total);
  await expect(page.locator('.chips.js-only')).toBeHidden();
  await ctx.close();
});

test('检索索引、RSS、站点地图可访问', async ({ request }) => {
  const idx = await request.get('/search-index.json');
  expect(idx.ok()).toBe(true);
  const j = await idx.json();
  expect(j.docs.length).toBeGreaterThan(10);
  expect((await request.get('/rss.xml')).ok()).toBe(true);
  expect(await (await request.get('/sitemap.xml')).text()).toContain('<urlset');
});
