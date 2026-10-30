import { describe, it, expect } from 'vitest';
import { tokenize, tokenizeQuery } from './tokenize';
import { buildIndex, search, snippet, type SearchDoc } from './bm25';
import { highlight, escapeHtml } from './highlight';

const doc = (id: string, type: SearchDoc['type'], title: string, text = '', tags: string[] = []): SearchDoc => ({
  id, type, title, text, tags, url: `/${id}`, meta: '',
});

describe('tokenize', () => {
  it('中文做一元 + 二元，英文整词小写', () => {
    expect(tokenize('本地优先 BM25')).toEqual(['bm25', '本', '地', '优', '先', '本地', '地优', '优先']);
  });
  it('保留 web-worker 这类带连字符的词，去掉末尾标点', () => {
    expect(tokenize('Web-Worker. v0.4')).toEqual(['web-worker', 'v0.4']);
  });
  it('查询侧多字中文只用二元，单字用一元', () => {
    expect(tokenizeQuery('上下文')).toEqual(['上下', '下文']);
    expect(tokenizeQuery('图')).toEqual(['图']);
  });
});

describe('bm25', () => {
  const idx = buildIndex([
    doc('a', 'feed', '上下文管理成为更新重点', '三家把它写进更新说明'),
    doc('b', 'post', '本地优先的 AI 工具', '注意力才是最贵的', ['本地优先']),
    doc('c', 'tool', 'Ollama', '一行命令跑起来的本地模型托管', ['本地优先', '命令行']),
    doc('d', 'feed', '小模型补全', '正文里提到上下文窗口'),
    doc('e', 'tool', 'MCP Inspector', '调试 MCP 服务'),
  ]);
  it('标题命中排在正文命中前面', () => {
    const ids = search(idx, '上下文').map((h) => h.doc.id);
    expect(ids[0]).toBe('a');
    expect(ids).toContain('d');
  });
  it('「本地优先」同时命中工具与文章', () => {
    const types = new Set(search(idx, '本地优先').map((h) => h.doc.type));
    expect(types.has('tool') && types.has('post')).toBe(true);
  });
  it('英文大小写不敏感', () => {
    expect(search(idx, 'mcp')[0].doc.id).toBe('e');
  });
  it('按类型过滤与空查询', () => {
    expect(search(idx, '本地优先', { type: 'tool' }).every((h) => h.doc.type === 'tool')).toBe(true);
    expect(search(idx, '   ')).toEqual([]);
    expect(search(idx, '完全不存在的词组')).toEqual([]);
  });
  it('摘要片段从命中处附近截取', () => {
    const s = snippet('a'.repeat(100) + '上下文' + 'b'.repeat(100), '上下文', 40);
    expect(s.startsWith('…')).toBe(true);
    expect(s).toContain('上下文');
  });
});

describe('highlight', () => {
  it('先转义再高亮，内容里的标签不会被执行', () => {
    expect(highlight('<b>上下文</b>', '上下文')).toBe('&lt;b&gt;<mark>上下文</mark>&lt;/b&gt;');
  });
  it('英文不区分大小写', () => {
    expect(highlight('Use MCP here', 'mcp')).toBe('Use <mark>MCP</mark> here');
  });
  it('escapeHtml', () => {
    expect(escapeHtml(`"&'`)).toBe('&quot;&amp;&#39;');
  });
});
