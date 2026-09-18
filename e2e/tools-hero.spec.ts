import { test, expect } from '@playwright/test';

test.describe('Tools Page Hero Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4322/tools');
  });

  test('should render modern hero section with Bento Grid layout', async ({ page }) => {
    // 等待页面加载完成
    await expect(page.locator('.tools-hero')).toBeVisible({ timeout: 5000 });
    
    // 截图：完整页面
    await expect(page).toHaveScreenshot('tools-hero-modern.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('hero section should have all elements visible', async ({ page }) => {
    // 检查标题
    const title = page.locator('.hero-title');
    await expect(title).toBeVisible();
    await expect(title).toContainText('浏览器工具箱');
    
    // 检查 CTA 按钮
    const primaryBtn = page.locator('.btn-primary');
    await expect(primaryBtn).toBeVisible();
    await expect(primaryBtn).toContainText('立即体验');
    
    const secondaryBtn = page.locator('.btn-secondary');
    await expect(secondaryBtn).toBeVisible();
    await expect(secondaryBtn).toContainText('了解特性');
    
    // 检查统计卡片 (根据实际数量，可能为 2 或 3)
    const statCards = page.locator('.stat-card');
    await expect(statCards).toHaveCount(2); // 主要统计 + 隐私徽章（开发中为 0）
    
    // 截图：头部特写
    await expect(page.locator('.tools-hero')).toHaveScreenshot('hero-section-closeup.png', {
      maxDiffPixels: 100,
    });
  });

  test('Bento Grid statistics cards should be responsive', async ({ page }) => {
    // 检查桌面端布局
    await expect(page.locator('.hero-stats')).toBeVisible();
    
    // 截图：统计卡片组
    const statsSection = page.locator('.hero-stats');
    await expect(statsSection).toHaveScreenshot('bento-stats-cards.png', {
      maxDiffPixels: 100,
    });
  });

  test('background glow effect should be present', async ({ page }) => {
    // 检查背景光晕效果
    const glowEffect = page.locator('.hero-glow');
    await expect(glowEffect).toBeVisible();
    
    // 截图：整体视觉效果
    await expect(page.locator('.tools-hero')).toHaveScreenshot('hero-with-effects.png', {
      maxDiffPixels: 100,
    });
  });
});
