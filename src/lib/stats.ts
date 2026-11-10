// 派生统计：只接收普通数组、返回数值，不依赖 astro:content，方便单测。
// 「本周 / 今日」按构建时间计算；页面上的相对时间由浏览器端 reltime 脚本按当前时间覆盖。
import { dayKey, dayStart, weekStart, year } from './date';

const DAY = 86_400_000;

export interface FeedLike {
  date: Date;
  category: string;
  source: string;
  verdict?: string;
  tags?: string[];
}

export function countBy<T>(list: T[], key: (x: T) => string | string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of list) {
    const k = key(x);
    for (const one of Array.isArray(k) ? k : [k]) out[one] = (out[one] ?? 0) + 1;
  }
  return out;
}

/** 连续更新周数：从最新一条所在周往前数，每周至少一条才算连续 */
export function streakWeeks(dates: Date[]): number {
  if (!dates.length) return 0;
  const weeks = new Set(dates.map((d) => weekStart(d)));
  let cur = Math.max(...weeks);
  let n = 0;
  while (weeks.has(cur)) {
    n++;
    cur -= 7 * DAY;
  }
  return n;
}

export function feedStats(items: FeedLike[], now: Date) {
  const total = items.length;
  const dates = items.map((x) => x.date);
  const latest = dates.length ? new Date(Math.max(...dates.map(Number))) : undefined;
  const earliest = dates.length ? new Date(Math.min(...dates.map(Number))) : undefined;
  const days = latest && earliest ? Math.round((dayStart(latest) - dayStart(earliest)) / DAY) + 1 : 0;
  const ws = weekStart(now);
  const today = dayKey(now);
  const thisWeek = items.filter((x) => +x.date >= ws);
  return {
    total,
    byCategory: countBy(items, (x) => x.category),
    withVerdict: items.filter((x) => x.verdict).length,
    week: thisWeek.length,
    weekWithVerdict: thisWeek.filter((x) => x.verdict).length,
    today: items.filter((x) => dayKey(x.date) === today).length,
    perDay: days ? Math.round((total / days) * 10) / 10 : 0,
    sources: new Set(items.map((x) => x.source)).size,
    streak: streakWeeks(dates),
    latest,
    topTags: Object.entries(countBy(items, (x) => x.tags ?? []))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
      .map(([t]) => t),
  };
}

export interface ToolLike {
  tags: string[];
  mine: boolean;
  free: boolean;
  offline: boolean;
  verifiedAt: Date;
  addedAt: Date;
}

export function toolStats(items: ToolLike[], now: Date) {
  const ws = weekStart(now);
  return {
    total: items.length,
    byTag: countBy(items, (x) => x.tags),
    mine: items.filter((x) => x.mine).length,
    free: items.filter((x) => x.free).length,
    offline: items.filter((x) => x.offline).length,
    weekNew: items.filter((x) => +x.addedAt >= ws).length,
    verified30d: items.filter((x) => +now - +x.verifiedAt <= 30 * DAY).length,
  };
}

export interface PostLike {
  date: Date;
  words: number;
  hasCode: boolean;
  category: string;
  tags: string[];
}

export function postStats(items: PostLike[], now: Date) {
  const byYear = countBy(items, (x) => year(x.date));
  const years = Object.keys(byYear).sort();
  const words = items.reduce((a, x) => a + x.words, 0);
  const ny = year(now);
  const nm = dayKey(now).slice(0, 7);
  return {
    total: items.length,
    words,
    avgWords: items.length ? Math.round(words / items.length / 100) * 100 : 0,
    withCode: items.filter((x) => x.hasCode).length,
    byYear,
    years,
    span: years.length,
    earliestYear: years[0],
    latest: items.length ? new Date(Math.max(...items.map((x) => +x.date))) : undefined,
    thisMonth: items.filter((x) => dayKey(x.date).slice(0, 7) === nm).length,
    thisYear: byYear[ny] ?? 0,
    byCategory: countBy(items, (x) => x.category),
    topTags: Object.entries(countBy(items, (x) => x.tags))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
      .map(([t]) => t),
  };
}
