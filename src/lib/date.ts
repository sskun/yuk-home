// 日期格式化统一按北京时间（Asia/Shanghai）。
// Cloudflare 构建机是 UTC，不显式指定时区的话，晚上的情报会被分到第二天。
const TZ = 'Asia/Shanghai';
const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

export interface DateParts {
  y: string;
  m: string;
  d: string;
  hh: string;
  mm: string;
  /** 0 = 周日 */
  wd: number;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function parts(date: Date): DateParts {
  const o: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) o[p.type] = p.value;
  return { y: o.year, m: o.month, d: o.day, hh: o.hour, mm: o.minute, wd: WD[o.weekday] ?? 0 };
}

/** 2026-10-29，用作按天分组的键 */
export const dayKey = (d: Date) => {
  const p = parts(d);
  return `${p.y}-${p.m}-${p.d}`;
};
/** 10.29 */
export const md = (d: Date) => {
  const p = parts(d);
  return `${p.m}.${p.d}`;
};
/** 2026.10.29 */
export const ymd = (d: Date) => {
  const p = parts(d);
  return `${p.y}.${p.m}.${p.d}`;
};
/** 16:10 */
export const hm = (d: Date) => {
  const p = parts(d);
  return `${p.hh}:${p.mm}`;
};
/** 2026.11（年月） */
export const ym = (d: Date) => {
  const p = parts(d);
  return `${p.y}.${p.m}`;
};
export const year = (d: Date) => parts(d).y;
export const weekday = (d: Date) => WEEK[parts(d).wd];

/** 北京时间当天 0 点对应的 UTC 毫秒数 */
export function dayStart(d: Date): number {
  const p = parts(d);
  return Date.parse(`${p.y}-${p.m}-${p.d}T00:00:00+08:00`);
}

/** 北京时间所在周（周一开始）的周一 0 点，UTC 毫秒数 */
export function weekStart(d: Date): number {
  const p = parts(d);
  const offset = (p.wd + 6) % 7; // 周一 = 0
  return dayStart(d) - offset * 86_400_000;
}
