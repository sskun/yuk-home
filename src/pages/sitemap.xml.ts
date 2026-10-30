// 站点地图：手写静态接口，不额外引入集成。mock 页面带 noindex，不进站点地图。
import type { APIRoute } from 'astro';
import { getPosts } from '../lib/content';

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://example.com');
  const posts = await getPosts();
  const urls = [
    { loc: '/', pri: '1.0' },
    { loc: '/feed', pri: '0.8' },
    { loc: '/tools', pri: '0.8' },
    { loc: '/tools/image-governance', pri: '0.7' },
    { loc: '/article', pri: '0.8' },
    { loc: '/projects', pri: '0.7' },
    { loc: '/about', pri: '0.5' },
    ...posts.filter((p) => !p.mock).map((p) => ({ loc: `/article/${p.id}`, pri: '0.6', last: (p.entry.data.updatedDate ?? p.date).toISOString().slice(0, 10) })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${new URL(u.loc, base).href}</loc>${'last' in u ? `<lastmod>${u.last}</lastmod>` : ''}<priority>${u.pri}</priority></url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
