// RSS：文章（全部）+ 情报（最近 50 条）。只在 <head> 和页脚放链接，不做订阅界面。
import type { APIRoute } from 'astro';
import { getFeed, getPosts } from '../lib/content';
import { SITE } from '../consts';

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://example.com');
  const [posts, feed] = await Promise.all([getPosts(), getFeed()]);
  const items = [
    ...posts.map((p) => ({ title: p.title, link: new URL(`/article/${p.id}`, base).href, desc: p.description, date: p.date, cat: p.category })),
    ...feed.slice(0, 50).map((f) => ({
      title: `[情报] ${f.data.title}`,
      link: f.data.sourceUrl ?? new URL(f.data.link ?? `/feed#${f.id}`, base).href,
      desc: [f.data.summary, f.data.verdict && `判断：${f.data.verdict}`].filter(Boolean).join(' '),
      date: f.data.date,
      cat: f.data.category,
    })),
  ].sort((a, b) => +b.date - +a.date);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(SITE.title)}</title><link>${base.href}</link><description>${esc(SITE.description)}</description><language>zh-CN</language>
${items.map((i) => `<item><title>${esc(i.title)}</title><link>${esc(i.link)}</link><guid>${esc(i.link)}</guid><pubDate>${i.date.toUTCString()}</pubDate><category>${esc(i.cat)}</category><description>${esc(i.desc)}</description></item>`).join('\n')}
</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
