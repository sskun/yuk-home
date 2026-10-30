// 页面生命周期：站点用 Astro ClientRouter 做页面切换，模块脚本只执行一次，
// 所以每个页面级初始化都注册在 astro:page-load 上；返回的清理函数在下一次切换前（astro:before-swap）执行。
type Cleanup = void | (() => void);

export function onPageLoad(init: () => Cleanup): void {
  let cleanup: Cleanup;
  document.addEventListener('astro:page-load', () => {
    cleanup = init();
  });
  document.addEventListener('astro:before-swap', () => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
  });
}

/** 只在第一次加载时执行一次（全局快捷键等） */
export function once(key: string, fn: () => void): void {
  const w = window as unknown as Record<string, boolean>;
  const k = `__yk_${key}`;
  if (w[k]) return;
  w[k] = true;
  fn();
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
