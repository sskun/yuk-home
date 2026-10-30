// 列表页交互（情报流 / 工具库 / 文章列表）：chips 筛选、排序、页内检索、加载更多、URL 同步、锚点定位。
// 列表在服务端已经全部渲染，这里只做显示 / 隐藏与重排；禁用 JS 时全部条目可见。
//
// 标记约定：
//   [data-list]                      列表根，data-page-size 为每页条数（0 = 不分页）
//   [data-item]                      条目，data-* 携带筛选字段（cat / tags / verdict / mine / year / sort-*）
//   [data-group] / [data-group-count] 分组（按天、按年）与分组计数，组内无可见条目时整组隐藏
//   [data-chip-group=key]            一组 chips，data-mode="or|and|single"；chip 上 data-value，空值表示「全部」
//   [data-sort-btn=value]            排序按钮；[data-sort-body] 是要重排的容器
//   [data-find=type]                 页内检索框（type 对应检索索引的 feed / tool）
//   [data-shown] [data-more] [data-empty]
import { onPageLoad } from './lifecycle';
import { withFlip } from './motion';
import { query } from './search-client';

type Mode = 'or' | 'and' | 'single';

interface State {
  filters: Map<string, Set<string>>;
  sort: string;
  q: string;
  limit: number;
}

const has = (el: HTMLElement, key: string, val: string) => {
  const raw = el.dataset[key] ?? '';
  return raw.split('|').includes(val);
};

function init(root: HTMLElement, signal: AbortSignal) {
  const pageSize = Number(root.dataset.pageSize ?? 0);
  const items = [...root.querySelectorAll<HTMLElement>('[data-item]')];
  const groups = [...root.querySelectorAll<HTMLElement>('[data-group]')];
  const chipGroups = [...document.querySelectorAll<HTMLElement>('[data-chip-group]')];
  const sortBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-sort-btn]')];
  const find = document.querySelector<HTMLInputElement>('[data-find]');
  const shown = document.querySelector<HTMLElement>('[data-shown]');
  const more = document.querySelector<HTMLButtonElement>('[data-more]');
  const empty = document.querySelector<HTMLElement>('[data-empty]');
  const params = new URLSearchParams(location.search);

  const state: State = {
    filters: new Map(),
    sort: params.get('sort') ?? sortBtns.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.sortBtn ?? '',
    q: params.get('q') ?? '',
    limit: pageSize,
  };
  for (const g of chipGroups) {
    const key = g.dataset.chipGroup!;
    const v = params.get(key);
    state.filters.set(key, new Set(v ? v.split(',') : []));
  }
  let matched: Set<string> | null = null;

  const modeOf = (key: string) =>
    (chipGroups.find((g) => g.dataset.chipGroup === key)?.dataset.mode as Mode | undefined) ?? 'or';

  function passes(el: HTMLElement): boolean {
    for (const [key, set] of state.filters) {
      if (!set.size) continue;
      const vals = [...set];
      const ok = modeOf(key) === 'and' ? vals.every((v) => has(el, key, v)) : vals.some((v) => has(el, key, v));
      if (!ok) return false;
    }
    if (matched && !matched.has(el.dataset.id!)) return false;
    return true;
  }

  function syncControls() {
    for (const g of chipGroups) {
      const set = state.filters.get(g.dataset.chipGroup!)!;
      g.querySelectorAll<HTMLElement>('[data-value]').forEach((c) => {
        const v = c.dataset.value!;
        c.setAttribute('aria-pressed', String(v === '' ? set.size === 0 : set.has(v)));
      });
    }
    // 侧栏等处的联动按钮（data-link-key / data-link-value）
    document.querySelectorAll<HTMLElement>('[data-link-key]').forEach((b) => {
      const set = state.filters.get(b.dataset.linkKey!);
      b.setAttribute('aria-pressed', String(!!set?.has(b.dataset.linkValue!)));
    });
    sortBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sortBtn === state.sort)));
    if (find && find.value !== state.q) find.value = state.q;
  }

  function syncUrl() {
    const p = new URLSearchParams();
    for (const [key, set] of state.filters) if (set.size) p.set(key, [...set].join(','));
    const defSort = sortBtns[0]?.dataset.sortBtn ?? '';
    if (state.sort && state.sort !== defSort) p.set('sort', state.sort);
    if (state.q) p.set('q', state.q);
    const qs = p.toString();
    history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  }

  function sortItems() {
    if (!state.sort) return;
    const key = `sort${state.sort[0].toUpperCase()}${state.sort.slice(1)}`;
    root.querySelectorAll<HTMLElement>('[data-sort-body]').forEach((body) => {
      const rows = [...body.querySelectorAll<HTMLElement>(':scope > [data-item]')];
      rows.sort((a, b) => Number(b.dataset[key] ?? 0) - Number(a.dataset[key] ?? 0));
      body.append(...rows);
    });
  }

  function apply(animate = true) {
    const mutate = () => {
      sortItems();
      const ordered = [...root.querySelectorAll<HTMLElement>('[data-item]')];
      const pass = ordered.filter(passes);
      // 检索或筛选时不分页，避免命中项藏在「加载更多」后面
      const filtering = !!state.q || [...state.filters.values()].some((s) => s.size);
      const limit = filtering || !pageSize ? Infinity : state.limit;
      const visible = new Set(pass.slice(0, limit));
      for (const el of ordered) el.hidden = !visible.has(el);
      for (const g of groups) {
        const n = [...g.querySelectorAll<HTMLElement>('[data-item]')].filter((x) => !x.hidden).length;
        g.hidden = n === 0;
        const c = g.querySelector<HTMLElement>('[data-group-count]');
        if (c) c.textContent = c.dataset.tpl ? c.dataset.tpl.replace('{n}', String(n)) : String(n);
      }
      if (shown) shown.textContent = String(visible.size);
      if (more) more.hidden = visible.size >= pass.length;
      if (empty) empty.hidden = pass.length > 0;
    };
    if (animate) withFlip(root, mutate);
    else mutate();
    syncControls();
  }

  async function runQuery() {
    const q = state.q.trim();
    if (!q) {
      matched = null;
    } else {
      try {
        const hits = await query(q, { type: find?.dataset.find as 'feed' | 'tool' });
        const prefix = `${find?.dataset.find}-`;
        matched = new Set(hits.map((h) => h.doc.id.slice(prefix.length)));
      } catch {
        matched = null;
      }
    }
    apply();
    syncUrl();
  }

  // —— 事件 ——
  for (const g of chipGroups) {
    const key = g.dataset.chipGroup!;
    g.addEventListener('click', (e) => {
      const c = (e.target as HTMLElement).closest<HTMLElement>('[data-value]');
      if (!c) return;
      const v = c.dataset.value!;
      const set = state.filters.get(key)!;
      const mode = modeOf(key);
      if (v === '') set.clear();
      else if (mode === 'single') {
        const on = set.has(v);
        set.clear();
        if (!on) set.add(v);
      } else if (set.has(v)) set.delete(v);
      else set.add(v);
      state.limit = pageSize;
      apply();
      syncUrl();
    }, { signal });
  }
  document.querySelectorAll<HTMLElement>('[data-link-key]').forEach((b) =>
    b.addEventListener('click', () => {
      const key = b.dataset.linkKey!;
      const v = b.dataset.linkValue!;
      if (!state.filters.has(key)) state.filters.set(key, new Set());
      const set = state.filters.get(key)!;
      if (set.has(v)) set.delete(v);
      else if (modeOf(key) === 'single') {
        set.clear();
        set.add(v);
      } else set.add(v);
      apply();
      syncUrl();
      // 侧栏里的按钮在列表下方（移动端），点完滚回列表顶部
      if (b.closest('aside') && root.getBoundingClientRect().top < 0) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, { signal }),
  );
  sortBtns.forEach((b) =>
    b.addEventListener('click', () => {
      state.sort = b.dataset.sortBtn!;
      apply();
      syncUrl();
    }, { signal }),
  );
  more?.addEventListener('click', () => {
    state.limit += pageSize;
    apply(false);
  }, { signal });
  if (find) {
    let t = 0;
    find.addEventListener('input', () => {
      clearTimeout(t);
      t = window.setTimeout(() => {
        state.q = find.value;
        void runQuery();
      }, 120);
    }, { signal });
    find.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      state.q = find.value;
      void runQuery();
    }, { signal });
    find.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && find.value) {
        find.value = '';
        state.q = '';
        void runQuery();
      }
    }, { signal });
  }
  document.querySelectorAll<HTMLElement>('[data-reset]').forEach((b) =>
    b.addEventListener('click', () => {
      for (const s of state.filters.values()) s.clear();
      state.q = '';
      matched = null;
      apply();
      syncUrl();
    }, { signal }),
  );

  // —— 锚点：目标被筛选或分页藏起来时先放出来，再滚动并高亮 ——
  function reveal() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (!el || !root.contains(el)) return;
    if (el.hidden || el.closest('[hidden]')) {
      if (!passes(el)) {
        for (const s of state.filters.values()) s.clear();
        state.q = '';
        matched = null;
      }
      state.limit = Infinity;
      apply(false);
      syncUrl();
    }
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    });
  }
  window.addEventListener('hashchange', reveal, { signal });

  root.classList.add('is-enhanced');
  if (state.q && find) void runQuery();
  else apply(false);
  reveal();
  void items;
}

onPageLoad(() => {
  const ac = new AbortController();
  document.querySelectorAll<HTMLElement>('[data-list]').forEach((root) => init(root, ac.signal));
  return () => ac.abort();
});
