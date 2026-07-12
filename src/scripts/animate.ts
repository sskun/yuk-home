// 客户端动画脚本：进入视口时为元素添加 .in-view 触发 CSS 动画。
// 渐进增强：不支持 IntersectionObserver、发生异常或用户偏好减少动态时，直接展示终态。

export interface AnimateOptions {
  /** 触发阈值 */
  threshold?: number;
  /** 预触发边距 */
  rootMargin?: string;
  /** 是否只触发一次 */
  once?: boolean;
}

/** 读取用户是否偏好减少动态 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 直接把所有待动画元素置为终态（兜底 / 无障碍路径） */
function revealAll(): void {
  document.querySelectorAll<HTMLElement>('[data-animate]').forEach((el) => el.classList.add('in-view'));
}

/**
 * 初始化动画。
 * 前置：运行于浏览器且 DOM 就绪。
 * 后置：所有 [data-animate] 元素最终都会获得 .in-view。
 */
export function initAnimations(options: AnimateOptions = {}): void {
  const { threshold = 0.15, rootMargin = '0px 0px -10% 0px', once = true } = options;

  // 无障碍或不支持 IO：直接展示，不做过渡
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    revealAll();
    return;
  }

  try {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            if (once) observer.unobserve(entry.target);
          }
        }
      },
      { threshold, rootMargin },
    );

    document.querySelectorAll<HTMLElement>('[data-animate]').forEach((el) => observer.observe(el));
  } catch {
    // 任何异常都不应影响内容可见性
    revealAll();
  }
}
