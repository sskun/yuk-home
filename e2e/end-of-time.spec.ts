import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('观测站默认静止，慢速播放、倒流与复位由用户控制', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/end-of-time');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-ready','true');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-paused','true');
  await expect(page.locator('#rate')).toHaveText('0.25×');
  const initial = await page.locator('canvas').screenshot();
  await page.waitForTimeout(1200);
  expect((await page.locator('canvas').screenshot()).equals(initial)).toBe(true);
  await page.getByRole('button',{name:'▶ 慢速播放'}).click();
  await expect(page.locator('#phase')).toHaveText('时间仍在流动');
  await page.locator('#time').fill('-0.25');
  await expect(page.locator('#phase')).toHaveText('正在回溯消逝的星光');
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');
  await page.locator('#sound').click();
  await page.locator('#reset').click();
  await expect(page.locator('#rate')).toHaveText('0.25×');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-paused','true');
  const before = await page.locator('canvas').screenshot();
  await page.mouse.move(850,280);await page.mouse.down();
  await page.mouse.move(1030,360,{steps:12});await page.mouse.up();
  expect((await page.locator('canvas').screenshot()).equals(before)).toBe(false);
  expect(errors).toEqual([]);
});

test('手机可操作且无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/end-of-time');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#collapse')).toBeInViewport();
  await expect(page.locator('#reset')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#phase')).toHaveText('万物静止于此刻');
  await page.locator('#pause').click();
  await expect(page.locator('#phase')).toHaveText('时间仍在流动');
});

test('减少动态效果时默认暂停，仍可主动播放', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/end-of-time');
  await expect(page.locator('#pause')).toHaveText('▶ 慢速播放');
  await page.locator('#pause').click();
  await expect(page.locator('#phase')).toHaveText('时间仍在流动');
});

test('WebGL 不可用时给出明确提示', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind === 'webgl2') return null;
      return original.apply(this, [kind, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto('/end-of-time');
  await expect(page.locator('#status')).toContainText('当前设备无法开启 3D 观测');
  await expect(page.locator('#collapse')).toBeDisabled();
});

for (const width of [1440, 390]) {
  test(`${width}px 首页星空不阻挡搜索，往返后正确恢复`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('[data-cosmic-art]')).toHaveAttribute('data-ready', 'true');
    await expect(page.getByRole('heading', { name: '我做的', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '暂停星空' }).click();
    await expect(page.locator('[data-cosmic-art]')).toHaveAttribute('data-paused', 'true');
    await page.locator('[data-hero-search] input').fill('本地优先');
    await expect(page.locator('[data-hero-list] mark').first()).toBeVisible();
    await page.locator('[data-hero-search] input').fill('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: '进入时间尽头 ↗' }).click();
    await expect(page.locator('#cosmos')).toHaveAttribute('data-ready', 'true');
    await page.getByRole('link', { name: /返回首页/ }).click();
    await expect(page.locator('[data-cosmic-art] canvas')).toHaveCount(1);
    await page.locator('.tile[href="/projects"]').click();
    await expect(page.locator('[data-cosmic-art] canvas')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('[data-cosmic-art]')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('[data-cosmic-art] canvas')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test('首页减少动态效果与 WebGL 降级保留内容', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '播放星空' })).toBeVisible();
  await expect(page.locator('[data-cosmic-art]')).toHaveAttribute('data-paused', 'true');
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind === 'webgl2') return null;
      return original.apply(this, [kind, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.reload();
  await expect(page.locator('[data-cosmic-art]')).toHaveAttribute('data-ready', 'fallback');
  await expect(page.locator('[data-hero-search] input')).toBeVisible();
  await expect(page.getByRole('link', { name: '进入时间尽头 ↗' })).toBeVisible();
});

test('首页星际仪可拖拽、缩放、键盘旋转并释放共振', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('[data-cosmic-art]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: '暂停星空' }).click();
  const stage = page.locator('[data-cosmic-stage]');
  const box = (await stage.boundingBox())!;
  const canvas = page.locator('[data-cosmic-art] canvas');
  const before = await canvas.screenshot();
  await page.mouse.move(box.x+box.width*.4, box.y+box.height*.5);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.7, box.y+box.height*.65, { steps: 15 });
  await page.mouse.up();
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  const beforeZoom = await canvas.screenshot();
  await page.mouse.wheel(0, -220);
  await page.waitForTimeout(300);
  expect((await canvas.screenshot()).equals(beforeZoom)).toBe(false);
  await stage.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-cosmic-art]')).toHaveAttribute('data-pulse', '1');
  await expect(page.locator('[data-cosmic-status]')).toContainText('共振已释放');
  await page.getByRole('button', { name: '复位', exact: true }).click();
  await expect(page.locator('[data-cosmic-status]')).toContainText('拖拽旋转');
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) {
test(`${width}px 穿越三片星域收集碎片，点燃新纪元并重新探索`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/end-of-time');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-ready', 'true');
  await page.locator('#mission-panel summary').click();
  await page.locator('#pause').click();
  await expect(page.locator('#ignite')).toBeDisabled();
  for (let realm=0;realm<3;realm++) {
    await page.locator(`button[data-realm="${realm}"]`).click();
    await expect(page.locator('#cosmos')).toHaveAttribute('data-realm', String(realm));
    if(realm===1){await expect(page.locator('#beacon')).toBeDisabled();await page.locator('#time').fill('-0.25');}
    if(realm===2){await expect(page.locator('#beacon')).toBeDisabled();await page.locator('#pause').click();}
    await page.locator('#beacon').click();
    await expect(page.locator('#progress')).toHaveText(`${realm+1} / 3`);
    await expect(page.locator(`[data-slot="${realm}"]`)).toHaveClass('collected');
    await expect(page.locator('#beacon')).toBeHidden();
  }
  await page.locator('button[data-realm="0"]').click();
  await expect(page.locator('#beacon')).toBeHidden();
  await expect(page.locator('#ignite')).toBeEnabled();
  await page.locator('#ignite').click();
  await expect(page.locator('#cosmos')).toHaveAttribute('data-epoch','reborn');
  await expect(page.locator('#status')).toContainText('新纪元已点燃');
  await expect(page.locator('#ignite')).toBeDisabled();
  await page.locator('#restart').click();
  await expect(page.locator('#progress')).toHaveText('0 / 3');
  await expect(page.locator('#beacon')).toBeVisible();
  await expect(page.locator('#ignite')).toBeDisabled();
});

}


test('完整页星域与共振不会造成核心大面积发白', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/end-of-time');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-ready','true');
  const checkHighlights = async () => {
    const shot = await page.screenshot({ clip: { x:480, y:230, width:600, height:520 } });
    const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject:true });
    let white = 0;
    for(let i=0;i<data.length;i+=info.channels) {
      if(data[i]>210 && data[i+1]>210 && data[i+2]>210) white++;
    }
    expect(white/(info.width*info.height)).toBeLessThan(.01);
  };
  for(const realm of [0,1,2]) {
    await page.locator(`button[data-realm="${realm}"]`).click();
    await checkHighlights();
  }
  await page.locator('#collapse').click();
  await page.waitForTimeout(2000);
  await checkHighlights();
});


test('单次涟漪有冷却，不会重复叠加或强制开启场景播放', async ({ page }) => {
  await page.goto('/end-of-time');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-ready','true');
  await page.locator('#collapse').click();
  await expect(page.locator('#collapse')).toBeDisabled();
  await expect(page.locator('#cosmos')).toHaveAttribute('data-pulses','1');
  await page.locator('canvas').dblclick({position:{x:600,y:400}});
  await expect(page.locator('#cosmos')).toHaveAttribute('data-pulses','1');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-paused','true');
  await expect(page.locator('#collapse')).toBeEnabled({timeout:14000});
  await page.locator('#collapse').click();
  await expect(page.locator('#cosmos')).toHaveAttribute('data-pulses','2');
});

test('观察视角可切换，用户拖拽能接管镜头，复位回到全景', async ({ page }) => {
  await page.goto('/end-of-time');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-ready','true');
  await page.getByRole('button',{name:'核心',exact:true}).click();
  await expect(page.locator('#cosmos')).toHaveAttribute('data-view','1');
  await expect(page.getByRole('button',{name:'核心',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-paused','true');
  await page.getByRole('button',{name:'极轴',exact:true}).click();
  await page.mouse.move(800,350);await page.mouse.down();await page.mouse.move(940,420,{steps:8});await page.mouse.up();
  await expect(page.locator('#cosmos')).toHaveAttribute('data-view','free');
  await page.locator('#reset').click();
  await expect(page.locator('#cosmos')).toHaveAttribute('data-view','0');
  await expect(page.getByRole('button',{name:'全景',exact:true})).toHaveAttribute('aria-pressed','true');
});


test('任务折叠标题保留键盘操作，方向键可以接管镜头过渡', async ({ page }) => {
  await page.goto('/end-of-time');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-ready','true');
  await page.locator('#mission-panel summary').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#mission-panel')).toHaveAttribute('open','');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-paused','true');
  await page.getByRole('button',{name:'核心',exact:true}).click();
  await page.locator('#cosmos').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#cosmos')).toHaveAttribute('data-view','free');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect(page.locator('#cosmos')).toHaveAttribute('data-paused','true');
});
