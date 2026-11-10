// 命中词高亮：先整体转义 HTML，再给命中片段包 <mark>，避免内容里的尖括号被当成标签。
import { highlightTerms } from './tokenize';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function highlight(text: string, query: string): string {
  const terms = highlightTerms(query)
    .filter((t) => t.trim())
    .sort((a, b) => b.length - a.length);
  const safe = escapeHtml(text);
  if (!terms.length) return safe;
  // 在转义后的文本上匹配，术语也要按同样规则转义
  const re = new RegExp(terms.map((t) => escapeRe(escapeHtml(t))).join('|'), 'gi');
  return safe.replace(re, (m) => `<mark>${m}</mark>`);
}
