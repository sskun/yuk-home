// 站内检索的界面层：全局浮层（顶栏按钮、/、Cmd/Ctrl+K）与首页大检索框的内联结果。
import { navigate } from 'astro:transitions/client';
import { onPageLoad, once, prefersReducedMotion } from './lifecycle';
import { openDialog } from './dialogs';
import { getIndex, prefetchIndex, query, snippet, type Hit, type DocType } from './search-client';
import { highlight, escapeHtml } from '../lib/search/highlight';

const GROUPS: { type: DocType; label: string }[] = [
  { type: 'feed', label: '情报' },
  { type: 'tool', label: '工具' },
  { type: 'post', label: '文章' },
  { type: 'project', label: '项目' },
];
const SUGGEST = ['本地优先', 'MCP', '上下文', '图片压缩'];

let uid = 0;

function renderItem(h: Hit, q: string, i: number): string {
  const d = h.doc;
  return `<a class="sov-item" role="option" aria-selected="false" id="sr-${++uid}" href="${escapeHtml(d.url)}" style="--i:${i}">
<span class="t">${highlight(d.title, q)}</span>
<span class="s">${highlight(snippet(d.text, q), q)}</span>
<span class="m">${escapeHtml(d.meta)}</span></a>`;
}

/** 按类型分组渲染；perGroup 限制每组条数（首页内联用） */
function renderGroups(hits: Hit[], q: string, perGroup?: number): string {
  let i = 0;
  return GROUPS.map(({ type, label }) => {
    const list = hits.filter((h) => h.doc.type === type);
    if (!list.length) return '';
    const shown = perGroup ? list.slice(0, perGroup) : list;
    return `<div class="sov-g" role="group" aria-label="${label}"><div class="sov-gh" aria-hidden="true">${label}<span class="n">${list.length}</span></div>${shown
      .map((h) => renderItem(h, q, i++))
      .join('')}</div>`;
  }).join('');
}

function renderSuggest(lead: string): string {
  return `<div class="sov-empty">${escapeHtml(lead)}<div class="chips">${SUGGEST.map(
    (s) => `<button type="button" class="chip" data-suggest="${s}">${s}</button>`,
  ).join('')}</div></div>`;
}

/** 在结果容器里用 ↑↓ 移动选中项，返回处理过的按键 */
function moveSelection(box: HTMLElement, input: HTMLInputElement, dir: 1 | -1): void {
  const items = [...box.querySelectorAll<HTMLAnchorElement>('.sov-item')];
  if (!items.length) return;
  const cur = items.findIndex((x) => x.getAttribute('aria-selected') === 'true');
  items.forEach((x) => x.setAttribute('aria-selected', 'false'));
  const next = items[(cur + dir + items.length) % items.length];
  next.setAttribute('aria-selected', 'true');
  input.setAttribute('aria-activedescendant', next.id);
  next.scrollIntoView({ block: 'nearest' });
}

/** 打开结果：同页锚点直接改 hash（列表脚本会展开并高亮），其余走 ClientRouter */
export function go(href: string, dialog?: HTMLDialogElement | null): void {
  dialog?.close();
  const url = new URL(href, location.href);
  if (url.pathname === location.pathname && url.hash) {
    if (location.hash === url.hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = url.hash;
    return;
  }
  navigate(url.pathname + url.search + url.hash);
}

function selected(box: HTMLElement): HTMLAnchorElement | null {
  return box.querySelector<HTMLAnchorElement>('.sov-item[aria-selected="true"]');
}

/** 给一个输入框 + 结果容器接上检索 */
function wire(
  input: HTMLInputElement,
  box: HTMLElement,
  opts: { perGroup?: number; onRender?: (total: number, q: string) => void; dialog?: HTMLDialogElement | null },
  signal: AbortSignal,
) {
  let seq = 0;
  const run = async () => {
    const q = input.value.trim();
    const my = ++seq;
    input.removeAttribute('aria-activedescendant');
    if (!q) {
      box.innerHTML = opts.perGroup ? '' : renderSuggest('试试这些：');
      opts.onRender?.(0, q);
      return;
    }
    try {
      const hits = await query(q, { limit: 60 });
      if (my !== seq) return;
      box.innerHTML = hits.length ? renderGroups(hits, q, opts.perGroup) : renderSuggest(`没有匹配「${q}」。试试：`);
      opts.onRender?.(hits.length, q);
    } catch {
      box.innerHTML = '<div class="sov-empty">检索暂时不可用，请刷新页面重试。</div>';
    }
  };
  input.addEventListener('input', run, { signal });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(box, input, e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      const s = selected(box) ?? box.querySelector<HTMLAnchorElement>('.sov-item');
      if (s) {
        e.preventDefault();
        go(s.getAttribute('href')!, opts.dialog);
      }
    }
  }, { signal });
  box.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const sug = t.closest<HTMLElement>('[data-suggest]');
    if (sug) {
      input.value = sug.dataset.suggest!;
      input.focus();
      void run();
      return;
    }
    const a = t.closest<HTMLAnchorElement>('.sov-item');
    if (a && !(e as MouseEvent).metaKey && !(e as MouseEvent).ctrlKey) {
      e.preventDefault();
      go(a.getAttribute('href')!, opts.dialog);
    }
  }, { signal });
  box.addEventListener('mousemove', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('.sov-item');
    if (!a || a.getAttribute('aria-selected') === 'true') return;
    box.querySelectorAll('.sov-item[aria-selected="true"]').forEach((x) => x.setAttribute('aria-selected', 'false'));
    a.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', a.id);
  }, { signal });
  return run;
}

/** 打开全局浮层，可以带上初始查询 */
export function openSearch(initial = ''): void {
  const d = openDialog('site-search');
  const input = d?.querySelector<HTMLInputElement>('input');
  if (!d || !input) return;
  if (initial) input.value = initial;
  input.dispatchEvent(new Event('input'));
  input.focus();
  input.select();
}

// 全局快捷键只注册一次：/ 与 Cmd/Ctrl+K
once('search-keys', () => {
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable;
    const isK = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey);
    if ((e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) || isK) {
      if (document.querySelector('dialog[open]:not(#site-search)')) return;
      e.preventDefault();
      openSearch();
    }
  });
});

onPageLoad(() => {
  const ac = new AbortController();
  const { signal } = ac;
  prefetchIndex();

  // —— 全局浮层 ——
  const dialog = document.getElementById('site-search') as HTMLDialogElement | null;
  const input = dialog?.querySelector<HTMLInputElement>('input');
  const box = dialog?.querySelector<HTMLElement>('#sov-list');
  const total = dialog?.querySelector<HTMLElement>('[data-total]');
  if (dialog && input && box) {
    wire(input, box, { dialog, onRender: (n) => total && (total.textContent = n ? `共 ${n} 条` : '') }, signal);
    document.querySelectorAll<HTMLElement>('[data-search-open]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        openSearch(b.dataset.q ?? '');
      }, { signal }),
    );
    input.addEventListener('focus', () => void getIndex().catch(() => {}), { signal });
  }

  // —— 首页大检索框：内联结果 ——
  const hero = document.querySelector<HTMLFormElement>('[data-hero-search]');
  if (hero) {
    const hin = hero.querySelector<HTMLInputElement>('input')!;
    const hres = document.querySelector<HTMLElement>('[data-hero-results]')!;
    const hlist = hres.querySelector<HTMLElement>('[data-hero-list]')!;
    const hfoot = hres.querySelector<HTMLElement>('[data-foot]')!;
    const run = wire(hin, hlist, {
      perGroup: 3,
      onRender: (n, q) => {
        hres.hidden = !q;
        hfoot.innerHTML = n
          ? `<span>共 ${n} 条 · ↑↓ 选择 · Enter 打开</span><button type="button" data-all>查看全部 ${n} 条 →</button>`
          : '<span>换个说法试试</span>';
      },
    }, signal);
    hfoot.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-all]')) openSearch(hin.value);
    }, { signal });
    hero.addEventListener('submit', (e) => {
      e.preventDefault();
      const s = selected(hlist) ?? hlist.querySelector<HTMLAnchorElement>('.sov-item');
      if (s) go(s.getAttribute('href')!);
      else if (hin.value.trim()) openSearch(hin.value);
      else hin.focus();
    }, { signal });
    hin.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && hin.value) {
        hin.value = '';
        void run();
      }
    }, { signal });
    hin.addEventListener('focus', () => void getIndex().catch(() => {}), { signal });
    document.querySelectorAll<HTMLElement>('[data-hero-q]').forEach((c) =>
      c.addEventListener('click', () => {
        hin.value = c.dataset.heroQ!;
        hin.focus();
        void run();
      }, { signal }),
    );
    // placeholder 轮播示例问题（打字效果），聚焦或已有输入时停止
    const prompts = (hero.dataset.prompts ?? '').split('|').filter(Boolean);
    if (prompts.length > 1 && !prefersReducedMotion()) {
      let pi = 0;
      let ci = prompts[0].length;
      let deleting = true;
      let hold = 40;
      const timer = window.setInterval(() => {
        if (document.activeElement === hin || hin.value) return;
        if (hold > 0) return void hold--;
        const p = prompts[pi];
        if (deleting) {
          ci = Math.max(0, ci - 2);
          if (ci === 0) {
            deleting = false;
            pi = (pi + 1) % prompts.length;
          }
        } else {
          ci++;
          if (ci >= prompts[pi].length) {
            deleting = true;
            hold = 40;
          }
        }
        hin.placeholder = (deleting ? p : prompts[pi]).slice(0, ci) || ' ';
      }, 70);
      signal.addEventListener('abort', () => clearInterval(timer));
    }
  }
  return () => ac.abort();
});
