// 文章正文的派生信息：字数、阅读时长、是否含代码 / 数据表格。构建期计算，不需要手填。

const FENCE = /```([\w-]*)[^\n]*\n[\s\S]*?```/g;
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const LATIN_WORD = /[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*/g;

/** 去掉代码块、HTML、Markdown 语法符号后的纯文本 */
export function plainText(markdown: string): string {
  return markdown
    .replace(FENCE, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`[^`]*`/g, ' ')
    .replace(/^[#>\-*+|\s]+/gm, ' ')
    .replace(/[*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 字数：中文按字、英文按词 */
export function countWords(markdown: string): number {
  const text = plainText(markdown);
  const cjk = text.match(CJK)?.length ?? 0;
  const latin = text.replace(CJK, ' ').match(LATIN_WORD)?.length ?? 0;
  return cjk + latin;
}

/** 阅读时长（分钟）：中文 400 字/分钟，英文 200 词/分钟，最少 1 分钟 */
export function readingMinutes(markdown: string): number {
  const text = plainText(markdown);
  const cjk = text.match(CJK)?.length ?? 0;
  const latin = text.replace(CJK, ' ').match(LATIN_WORD)?.length ?? 0;
  return Math.max(1, Math.round(cjk / 400 + latin / 200));
}

/** 是否含代码块（mermaid 图不算代码） */
export function hasCode(markdown: string): boolean {
  for (const m of markdown.matchAll(FENCE)) if (m[1] !== 'mermaid') return true;
  return false;
}

/** 是否含数据表格 */
export function hasTable(markdown: string): boolean {
  return /^\s*\|.+\|\s*\n\s*\|[\s:|-]+\|/m.test(markdown.replace(FENCE, ''));
}

/** 4120 → 4,120 */
export const thousands = (n: number) => n.toLocaleString('en-US');

/** 46000 → 4.6（万） */
export const wan = (n: number) => (n / 10000).toFixed(1).replace(/\.0$/, '');
