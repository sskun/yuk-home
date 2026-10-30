// Mermaid 流程图：页面里有 .mermaid 块时才动态加载 mermaid；渲染后可点击放大（滚轮缩放、拖拽平移、Esc 关闭）。
// 从旧版 ArticleLayout 迁移，改为浅色主题并接入 ClientRouter 生命周期。
import { onPageLoad, prefersReducedMotion } from './lifecycle';

function setupZoom(nodes: HTMLElement[], signal: AbortSignal) {
  const reduce = prefersReducedMotion();
  const overlay = document.createElement('div');
  overlay.className = 'mermaid-lightbox';
  overlay.hidden = true;
  overlay.innerHTML =
    '<button class="mlb-close" aria-label="关闭放大视图"><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg></button>' +
    '<div class="mlb-stage"></div><p class="mlb-hint">滚轮缩放 · 拖拽平移 · Esc 关闭</p>';
  const stage = overlay.querySelector<HTMLDivElement>('.mlb-stage')!;
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let drag = false;
  let sx = 0;
  let sy = 0;
  const apply = () => (stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`);
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  const close = () => {
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      overlay.hidden = true;
      stage.innerHTML = '';
    }, reduce ? 0 : 200);
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || (e.target as HTMLElement).closest('.mlb-close')) close();
  });
  overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    scale = Math.min(6, Math.max(0.5, scale * (e.deltaY < 0 ? 1.12 : 0.89)));
    apply();
  }, { passive: false });
  stage.addEventListener('pointerdown', (e) => {
    drag = true;
    sx = e.clientX - tx;
    sy = e.clientY - ty;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    tx = e.clientX - sx;
    ty = e.clientY - sy;
    apply();
  });
  const end = () => (drag = false);
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  document.body.appendChild(overlay);
  signal.addEventListener('abort', () => overlay.remove());

  for (const node of nodes) {
    const svg = node.querySelector('svg');
    if (!svg) continue;
    node.classList.add('zoomable');
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', '点击放大流程图');
    const open = () => {
      scale = 1;
      tx = 0;
      ty = 0;
      const clone = svg.cloneNode(true) as SVGElement;
      clone.removeAttribute('height');
      stage.replaceChildren(clone);
      apply();
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add('open'));
      document.addEventListener('keydown', onKey);
    };
    node.addEventListener('click', open, { signal });
    node.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()), { signal });
  }
}

onPageLoad(() => {
  const blocks = [...document.querySelectorAll<HTMLElement>('pre.mermaid')];
  if (!blocks.length) return;
  const ac = new AbortController();
  void import('mermaid').then(async ({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'strict',
      themeVariables: {
        fontFamily: getComputedStyle(document.body).fontFamily,
        primaryColor: '#EEF2FF',
        primaryBorderColor: '#1D4ED8',
        primaryTextColor: '#0A0A0A',
        lineColor: '#9CA3AF',
        secondaryColor: '#FFFFFF',
        tertiaryColor: '#FAFAFA',
      },
    });
    await mermaid.run({ nodes: blocks });
    if (!ac.signal.aborted) setupZoom(blocks, ac.signal);
  });
  return () => ac.abort();
});
