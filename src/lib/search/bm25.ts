// 浏览器端 BM25：索引在构建期以 JSON 形式输出（只含原始文档），首次检索时在浏览器里建倒排。
// 355 条左右的规模，建索引约几十毫秒；1,800 条以上再考虑分片与 Web Worker（见落地方案 6.6）。
import { tokenize, tokenizeQuery, highlightTerms } from './tokenize';

export type DocType = 'feed' | 'tool' | 'post' | 'project';

export interface SearchDoc {
  id: string;
  type: DocType;
  title: string;
  /** 参与检索的正文：摘要、判断、正文截断等 */
  text: string;
  /** 标签单独存，命中标签额外加分 */
  tags: string[];
  url: string;
  /** 结果里的元信息行，例如「10.29 · 模型」 */
  meta: string;
  /** 外链（情报来源、工具官网），可选 */
  ext?: string;
}

export interface Index {
  docs: SearchDoc[];
  postings: Map<string, number[]>;
  tfs: Map<string, number[]>;
  tagSets: Set<string>[];
  len: number[];
  avgdl: number;
}

const K1 = 1.2;
const B = 0.75;
/** 标题重复 3 次参与计分，等价于标题加权 */
const TITLE_BOOST = 3;
/** 查询完整命中某个标签时的加分 */
const TAG_BONUS = 1.5;

export function buildIndex(docs: SearchDoc[]): Index {
  const postings = new Map<string, number[]>();
  const tfs = new Map<string, number[]>();
  const len: number[] = [];
  docs.forEach((d, id) => {
    const toks = tokenize(`${`${d.title} `.repeat(TITLE_BOOST)}${d.tags.join(' ')} ${d.text}`);
    len[id] = toks.length;
    const local = new Map<string, number>();
    for (const t of toks) local.set(t, (local.get(t) ?? 0) + 1);
    for (const [term, tf] of local) {
      let p = postings.get(term);
      if (!p) postings.set(term, (p = []));
      let f = tfs.get(term);
      if (!f) tfs.set(term, (f = []));
      p.push(id);
      f.push(tf);
    }
  });
  const avgdl = len.reduce((a, b) => a + b, 0) / (len.length || 1);
  const tagSets = docs.map((d) => new Set(d.tags.map((t) => t.toLowerCase())));
  return { docs, postings, tfs, tagSets, len, avgdl };
}

export interface Hit {
  doc: SearchDoc;
  score: number;
}

export function search(idx: Index, query: string, opts: { limit?: number; type?: DocType } = {}): Hit[] {
  const q = [...new Set(tokenizeQuery(query))];
  if (!q.length) return [];
  const N = idx.docs.length;
  const scores = new Map<number, number>();
  for (const term of q) {
    const p = idx.postings.get(term);
    if (!p) continue;
    const idf = Math.log(1 + (N - p.length + 0.5) / (p.length + 0.5));
    const tf = idx.tfs.get(term)!;
    for (let i = 0; i < p.length; i++) {
      const id = p[i];
      const f = tf[i];
      const dl = idx.len[id];
      const s = (idf * (f * (K1 + 1))) / (f + K1 * (1 - B + (B * dl) / idx.avgdl));
      scores.set(id, (scores.get(id) ?? 0) + s);
    }
  }
  const ql = query.trim().toLowerCase();
  const hits: Hit[] = [];
  for (const [id, score] of scores) {
    const doc = idx.docs[id];
    if (opts.type && doc.type !== opts.type) continue;
    hits.push({ doc, score: score + (idx.tagSets[id].has(ql) ? TAG_BONUS : 0) });
  }
  hits.sort((a, b) => b.score - a.score);
  return opts.limit ? hits.slice(0, opts.limit) : hits;
}

/** 摘要片段：从第一个命中的关键片段前 30 字开始截 90 字 */
export function snippet(text: string, query: string, size = 90): string {
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of highlightTerms(query).sort((a, b) => b.length - a.length)) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) at = 0;
  const start = Math.max(0, at - 30);
  return (start > 0 ? '…' : '') + text.slice(start, start + size) + (text.length > start + size ? '…' : '');
}
