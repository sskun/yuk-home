// 原生 <dialog> 的通用行为：触发器打开、点遮罩关闭、Tab 在弹层内循环。
// showModal() 本身已经提供：背景 inert、Esc 关闭、关闭后焦点回到触发元素。
import { onPageLoad } from './lifecycle';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function openDialog(id: string): HTMLDialogElement | null {
  const d = document.getElementById(id) as HTMLDialogElement | null;
  if (d && !d.open) d.showModal();
  return d;
}

onPageLoad(() => {
  const ac = new AbortController();
  const { signal } = ac;
  document.querySelectorAll<HTMLElement>('[data-open]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openDialog(el.dataset.open!);
    }, { signal }),
  );
  document.querySelectorAll<HTMLDialogElement>('dialog[data-dialog]').forEach((d) => {
    // 点在 dialog 自身（即遮罩区域）时关闭
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    }, { signal });
    d.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => d.close(), { signal }));
    d.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...d.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }, { signal });
  });
  return () => {
    ac.abort();
    document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => d.close());
  };
});
