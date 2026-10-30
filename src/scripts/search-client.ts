// 检索索引的加载与缓存：页面空闲时预取，第一次检索时建倒排，之后常驻内存。
// ClientRouter 切换页面不会刷新 window，索引在整个会话里只加载一次。
import { buildIndex, search, snippet, type DocType, type Hit, type Index } from '../lib/search/bm25';

let idx: Index | null = null;
let pending: Promise<Index> | null = null;

export function getIndex(): Promise<Index> {
  if (idx) return Promise.resolve(idx);
  pending ??= fetch('/search-index.json')
    .then((r) => {
      if (!r.ok) throw new Error(`索引加载失败：${r.status}`);
      return r.json();
    })
    .then((j) => (idx = buildIndex(j.docs)))
    .catch((e) => {
      pending = null;
      throw e;
    });
  return pending;
}

export function prefetchIndex(): void {
  const run = () => void getIndex().catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 });
  else setTimeout(run, 1200);
}

export async function query(q: string, opts: { limit?: number; type?: DocType } = {}): Promise<Hit[]> {
  const i = await getIndex();
  return search(i, q, opts);
}

export { snippet };
export type { Hit, DocType };
