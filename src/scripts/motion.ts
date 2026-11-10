// 动效层（GSAP，按需懒加载）。原则：动效只是增强——
// - 首屏内已经可见的元素不做入场动画，避免「先出现、再消失、再淡入」的闪烁
// - 系统开启「减少动态效果」时全部跳过
// - GSAP 加载失败时内容照常显示，只是没有动画
import { onPageLoad, prefersReducedMotion } from './lifecycle';

type GSAP = typeof import('gsap').gsap;
type FlipT = typeof import('gsap/Flip').Flip;

let gsapP: Promise<GSAP> | null = null;
let flipP: Promise<FlipT> | null = null;
let FlipRef: FlipT | null = null;

const loadGsap = () => (gsapP ??= import('gsap').then((m) => m.gsap));
const loadFlip = () =>
  (flipP ??= Promise.all([loadGsap(), import('gsap/Flip')]).then(([g, m]) => {
    g.registerPlugin(m.Flip);
    FlipRef = m.Flip;
    return m.Flip;
  }));

/** 列表筛选 / 排序时的平滑重排：保留的条目移到新位置，新出现的淡入 */
export function withFlip(root: HTMLElement, mutate: () => void): void {
  if (prefersReducedMotion() || !FlipRef) {
    mutate();
    if (!prefersReducedMotion()) void loadFlip().catch(() => {});
    return;
  }
  const targets = root.querySelectorAll<HTMLElement>('[data-item]');
  const st = FlipRef.getState(targets);
  mutate();
  FlipRef.from(st, {
    duration: 0.3,
    ease: 'power2.out',
    absolute: false,
    nested: true,
    onEnter: (els) => loadGsap().then((g) => g.fromTo(els, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.25 })),
  });
}

/** 首页 hero 标题逐字上浮，同一会话只播一次 */
async function heroTitle(signal: AbortSignal) {
  const h = document.querySelector<HTMLElement>('[data-split]');
  if (!h || sessionStorage.getItem('yk-hero')) return;
  sessionStorage.setItem('yk-hero', '1');
  const [g, { SplitText }] = await Promise.all([loadGsap(), import('gsap/SplitText')]);
  if (signal.aborted) return;
  g.registerPlugin(SplitText);
  const split = new SplitText(h, { type: 'chars', charsClass: 'ch' });
  g.from(split.chars, {
    opacity: 0,
    yPercent: 40,
    duration: 0.5,
    ease: 'power3.out',
    stagger: 0.035,
    onComplete: () => split.revert(),
  });
}

/** 数字滚动：进入视口时从 0 滚到目标值（只处理纯数字，带逗号的会保留格式） */
async function countUp(signal: AbortSignal) {
  const els = [...document.querySelectorAll<HTMLElement>('[data-count]')];
  if (!els.length) return;
  const g = await loadGsap();
  if (signal.aborted) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target as HTMLElement;
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target) || target <= 0) continue;
      const decimals = (el.dataset.count!.split('.')[1] ?? '').length;
      const o = { v: 0 };
      g.to(o, {
        v: target,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = o.v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        },
      });
    }
  });
  els.forEach((el) => io.observe(el));
  signal.addEventListener('abort', () => io.disconnect());
}

/** 卡片与列表行：首次进入视口时错位淡入；首屏内已可见的不动 */
async function reveal(signal: AbortSignal) {
  const els = [...document.querySelectorAll<HTMLElement>('[data-reveal] > *')].filter(
    (el) => el.getBoundingClientRect().top > window.innerHeight,
  );
  if (!els.length) return;
  const g = await loadGsap();
  if (signal.aborted) return;
  g.set(els, { opacity: 0, y: 14 });
  const queue: Element[] = [];
  let raf = 0;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      queue.push(e.target);
    }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      g.to(queue.splice(0), { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.04, overwrite: true });
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
  signal.addEventListener('abort', () => {
    io.disconnect();
    g.set(els, { clearProps: 'opacity,transform' });
  });
}

onPageLoad(() => {
  if (prefersReducedMotion()) return;
  const ac = new AbortController();
  void heroTitle(ac.signal).catch(() => {});
  void countUp(ac.signal).catch(() => {});
  void reveal(ac.signal).catch(() => {});
  if (document.querySelector('[data-list]')) void loadFlip().catch(() => {});
  return () => ac.abort();
});
