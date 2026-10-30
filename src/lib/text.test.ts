import { describe, it, expect } from 'vitest';
import { countWords, readingMinutes, hasCode, hasTable, plainText } from './text';

describe('text', () => {
  it('中文按字、英文按词计数，代码块不计', () => {
    expect(countWords('你好世界 hello world\n\n```ts\nconst a = 1;\n```')).toBe(6);
  });
  it('链接只保留文字', () => {
    expect(plainText('看[这篇](/a)文章')).toBe('看这篇文章');
  });
  it('阅读时长最少 1 分钟，中文 400 字/分钟', () => {
    expect(readingMinutes('字')).toBe(1);
    expect(readingMinutes('字'.repeat(2000))).toBe(5);
  });
  it('mermaid 不算代码；能识别表格', () => {
    expect(hasCode('```mermaid\ngraph TD\n```')).toBe(false);
    expect(hasCode('```js\n1\n```')).toBe(true);
    expect(hasTable('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe(true);
    expect(hasTable('普通段落')).toBe(false);
  });
});
