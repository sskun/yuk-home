import { describe, it, expect } from 'vitest';
import { feedStats, streakWeeks, postStats, toolStats, countBy } from './stats';
import { dayKey, weekStart } from './date';

const d = (s: string) => new Date(s);

describe('date（北京时间）', () => {
  it('UTC 晚上 20 点属于北京时间第二天', () => {
    expect(dayKey(d('2026-10-28T20:00:00Z'))).toBe('2026-10-29');
  });
  it('周一为一周开始', () => {
    // 2026-10-29 是周四，所在周的周一是 10-26
    expect(weekStart(d('2026-10-29T10:00:00+08:00'))).toBe(Date.parse('2026-10-26T00:00:00+08:00'));
  });
});

describe('stats', () => {
  it('连续周数遇到空周即停止', () => {
    const dates = ['2026-10-29', '2026-10-21', '2026-10-14', '2026-09-30'].map((x) => d(`${x}T12:00:00+08:00`));
    expect(streakWeeks(dates)).toBe(3);
    expect(streakWeeks([])).toBe(0);
  });
  it('情报统计：本周、今日、日均、带判断', () => {
    const now = d('2026-10-29T18:00:00+08:00');
    const items = [
      { date: d('2026-10-29T16:10:00+08:00'), category: '模型', source: '官方', verdict: 'x', tags: ['a'] },
      { date: d('2026-10-29T09:00:00+08:00'), category: '工具', source: 'GitHub', tags: ['a', 'b'] },
      { date: d('2026-10-25T09:00:00+08:00'), category: '模型', source: '官方', tags: [] },
    ];
    const s = feedStats(items, now);
    expect(s).toMatchObject({ total: 3, today: 2, week: 2, withVerdict: 1, sources: 2, byCategory: { 模型: 2, 工具: 1 } });
    expect(s.perDay).toBe(0.6);
    expect(s.topTags[0]).toBe('a');
  });
  it('空数组不报错', () => {
    const now = new Date();
    expect(feedStats([], now)).toMatchObject({ total: 0, perDay: 0, streak: 0 });
    expect(postStats([], now)).toMatchObject({ total: 0, avgWords: 0 });
    expect(toolStats([], now).total).toBe(0);
  });
  it('countBy 支持数组键', () => {
    expect(countBy([{ t: ['x', 'y'] }, { t: ['x'] }], (o) => o.t)).toEqual({ x: 2, y: 1 });
  });
});
