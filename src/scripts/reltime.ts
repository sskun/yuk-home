// 相对时间：静态页面只在构建时生成，「今日 / 本周」需要按访问时的当前时间重算。
// 标记约定：
//   <span data-today-count data-dates="ms|ms|…" data-tpl="今日 {n} 条" data-fallback="更新至 10.29">
//   <span data-week-count  data-dates="…" data-tpl="本周 +{n}" data-fallback="…">
//   <span data-month-count data-dates="…" data-tpl="{m} 月 +{n}" data-fallback="…">
// 当前时间算出来是 0 时显示 fallback（避免「今日 0 条」这种空数字）。
import { onPageLoad } from './lifecycle';

const DAY = 86_400_000;
// 北京时间的日界
const bjDay = (ms: number) => Math.floor((ms + 8 * 3600_000) / DAY);
const bjWeek = (ms: number) => {
  const d = bjDay(ms);
  // 1970-01-01 是周四；换算成周一开始的周序号
  return Math.floor((d + 3) / 7);
};

onPageLoad(() => {
  const now = Date.now();
  const bjMonth = (ms: number) => {
    const d = new Date(ms + 8 * 3600_000);
    return d.getUTCFullYear() * 12 + d.getUTCMonth();
  };
  const month = new Date(now + 8 * 3600_000).getUTCMonth() + 1;
  document.querySelectorAll<HTMLElement>('[data-today-count],[data-week-count],[data-month-count]').forEach((el) => {
    const dates = (el.dataset.dates ?? '').split('|').filter(Boolean).map(Number);
    const same = el.hasAttribute('data-week-count')
      ? (d: number) => bjWeek(d) === bjWeek(now)
      : el.hasAttribute('data-month-count')
        ? (d: number) => bjMonth(d) === bjMonth(now)
        : (d: number) => bjDay(d) === bjDay(now);
    const n = dates.filter(same).length;
    el.textContent =
      n > 0
        ? (el.dataset.tpl ?? '{n}').replace('{n}', String(n)).replace('{m}', String(month))
        : (el.dataset.fallback ?? '');
  });
});
