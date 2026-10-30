// 构建期输出站内检索索引：只放检索需要的最小字段，浏览器端首次检索时再建倒排（src/lib/search/bm25.ts）。
import type { APIRoute } from 'astro';
import { getFeed, getPosts, getProjects, getTools } from '../lib/content';
import { plainText } from '../lib/text';
import { md } from '../lib/date';
import type { SearchDoc } from '../lib/search/bm25';

export const GET: APIRoute = async () => {
  const [feed, posts, tools, projects] = await Promise.all([getFeed(), getPosts(), getTools(), getProjects()]);
  const docs: SearchDoc[] = [];

  for (const f of feed) {
    const d = f.data;
    docs.push({
      id: `feed-${f.id}`,
      type: 'feed',
      title: d.title,
      text: [d.summary, d.verdict].filter(Boolean).join(' '),
      tags: d.tags,
      url: `/feed#${f.id}`,
      meta: `${md(d.date)} · ${d.category} · ${d.source}`,
      ext: d.sourceUrl,
    });
  }
  for (const t of tools) {
    const d = t.data;
    docs.push({
      id: `tool-${t.id}`,
      type: 'tool',
      title: d.name,
      text: [d.tagline, d.note, d.offline && '能离线跑 不上传文件', d.cli && '命令行', d.free && '免费']
        .filter(Boolean)
        .join(' '),
      tags: d.tags,
      url: `/tools#${t.id}`,
      meta: [d.mine ? '我做的' : '', ...d.tags.slice(0, 3), `验证 ${md(d.verifiedAt)}`].filter(Boolean).join(' · '),
      ext: d.href ?? d.url,
    });
  }
  for (const p of posts) {
    docs.push({
      id: `post-${p.id}`,
      type: 'post',
      title: p.title,
      text: [p.description, p.entry.data.verdict, plainText(p.entry.body ?? '').slice(0, 800)].filter(Boolean).join(' '),
      tags: p.tags,
      url: `/article/${p.id}`,
      meta: `${p.noLabel} · ${p.category} · ${md(p.date)} · ${p.minutes} 分钟`,
    });
  }
  for (const p of [...projects.main, ...projects.small]) {
    const d = p.data;
    docs.push({
      id: `project-${p.id}`,
      type: 'project',
      title: d.name,
      text: [d.oneLine, plainText(p.body ?? '').slice(0, 600)].filter(Boolean).join(' '),
      tags: d.stack,
      url: `/projects#${p.id}`,
      meta: [d.kind, d.version, `更新 ${md(d.updated)}`].filter(Boolean).join(' · '),
      ext: d.open,
    });
  }

  return new Response(JSON.stringify({ version: 1, builtAt: new Date().toISOString(), docs }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
