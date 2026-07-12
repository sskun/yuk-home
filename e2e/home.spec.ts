import { test, expect } from '@playwright/test';

// 首页冒烟测试：验证区块存在、外链安全、渐进增强。

test('页面加载且各区块存在', async ({ page }) => {
  await page.goto('/');
  // 四个区块的锚点 id 应都存在
  await expect(page.locator('#hero')).toBeVisible();
  await expect(page.locator('#features')).toBeVisible();
  await expect(page.locator('#showcase')).toBeVisible();
  await expect(page.locator('#footer')).toBeVisible();
  // 首屏主标题来自配置
  await expect(page.locator('#hero h1')).toHaveText('用 Astro 构建极速站点');
});

test('外链均带 rel="noopener noreferrer"', async ({ page }) => {
  await page.goto('/');
  const externalLinks = page.locator('a[target="_blank"]');
  const count = await externalLinks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(externalLinks.nth(i)).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test('动画元素最终会显示（进入视口后 in-view）', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('#hero h1');
  await expect(hero).toHaveClass(/in-view/);
});

test.describe('渐进增强：禁用 JS', () => {
  test.use({ javaScriptEnabled: false });

  test('禁用 JS 时区块内容仍完整可见', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero h1')).toBeVisible();
    await expect(page.locator('#features')).toBeVisible();
    // 无 JS 时 html 不应带有 .js 标记，data-animate 元素不被隐藏
    await expect(page.locator('html')).not.toHaveClass(/\bjs\b/);
    await expect(page.locator('#hero h1')).toHaveText('用 Astro 构建极速站点');
  });
});
