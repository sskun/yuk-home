// 中英混合分词，零依赖：
// - 拉丁字母 / 数字词整体保留（bm25、mcp、web-worker、0.4）
// - 中文连续段做一元 + 二元切分：一元保召回，二元保精度；新词（「上下文压缩」）不需要词典
// 不设停用词：短文本里停用词表收益不稳定，还会误伤「不上传文件」里的「不」。
const LATIN = /[a-z0-9][a-z0-9_.+#-]*/g;
const CJK_RUN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g;

export function tokenize(input: string): string[] {
  const out: string[] = [];
  const s = input.toLowerCase();
  for (const m of s.matchAll(LATIN)) out.push(m[0].replace(/[.+#-]+$/, '') || m[0]);
  for (const m of s.matchAll(CJK_RUN)) {
    const t = m[0];
    for (let i = 0; i < t.length; i++) out.push(t[i]);
    for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  }
  return out;
}

/**
 * 查询分词：中文段长度 ≥2 时只取二元（不取一元），避免「上下文」被拆成「上 / 下 / 文」后召回大量无关条目；
 * 单字查询仍用一元。文档侧（tokenize）一元二元都建，所以单字和多字查询都能命中。
 */
export function tokenizeQuery(input: string): string[] {
  const out: string[] = [];
  const s = input.toLowerCase();
  for (const m of s.matchAll(LATIN)) out.push(m[0].replace(/[.+#-]+$/, '') || m[0]);
  for (const m of s.matchAll(CJK_RUN)) {
    const t = m[0];
    if (t.length === 1) out.push(t);
    else for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  }
  return out;
}

/** 用于高亮的关键片段：拉丁词 + 中文二元及以上的连续段 */
export function highlightTerms(query: string): string[] {
  const s = query.toLowerCase();
  const terms = new Set<string>();
  for (const m of s.matchAll(LATIN)) if (m[0].length >= 2) terms.add(m[0]);
  for (const m of s.matchAll(CJK_RUN)) {
    const t = m[0];
    // 整段优先（高亮时长的先匹配），再补二元，保证部分命中也能标出来
    terms.add(t);
    if (t.length > 2) for (let i = 0; i < t.length - 1; i++) terms.add(t.slice(i, i + 2));
  }
  return [...terms];
}
