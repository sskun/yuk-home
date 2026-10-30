// 读取内容集合的统一入口：过滤草稿与 mock、排序、补充派生字段。页面只从这里取数据。
import { getCollection, type CollectionEntry } from 'astro:content';
import { countWords, readingMinutes, hasCode, hasTable } from './text';

/** SHOW_MOCK=false 时排除所有 mock 条目（正式上线时在 Cloudflare Pages 生产环境设置） */
export const SHOW_MOCK = (import.meta.env.SHOW_MOCK ?? process.env.SHOW_MOCK ?? 'true') !== 'false';

/** 构建时间：统计「本周 / 今日」的基准 */
export const BUILD_TIME = new Date();

const keep = (e: { data: { mock?: boolean } }) => SHOW_MOCK || !e.data.mock;

export interface Post {
  id: string;
  entry: CollectionEntry<'article'>;
  title: string;
  description: string;
  date: Date;
  category: CollectionEntry<'article'>['data']['category'];
  tags: string[];
  /** 编号：按发布日期升序从 1 开始，展示时补零到 3 位 */
  no: number;
  noLabel: string;
  words: number;
  minutes: number;
  hasCode: boolean;
  hasData: boolean;
  mock: boolean;
}

let postsCache: Post[] | undefined;
export async function getPosts(): Promise<Post[]> {
  if (postsCache) return postsCache;
  const entries = (await getCollection('article', (e) => !e.data.draft)).filter(keep);
  const asc = [...entries].sort(
    (a, b) => +(a.data.pubDate ?? 0) - +(b.data.pubDate ?? 0) || a.id.localeCompare(b.id),
  );
  const posts = asc.map((entry, i): Post => {
    const body = entry.body ?? '';
    return {
      id: entry.id,
      entry,
      title: entry.data.title,
      description: entry.data.description,
      date: entry.data.pubDate ?? new Date(0),
      category: entry.data.category,
      tags: entry.data.tags,
      no: i + 1,
      noLabel: String(i + 1).padStart(3, '0'),
      words: countWords(body),
      minutes: readingMinutes(body),
      hasCode: hasCode(body),
      hasData: hasTable(body),
      mock: entry.data.mock,
    };
  });
  postsCache = posts.reverse();
  return postsCache;
}

export async function getFeed() {
  const items = (await getCollection('feed')).filter(keep);
  return items.sort((a, b) => +b.data.date - +a.data.date);
}

export async function getTools() {
  const items = (await getCollection('tools')).filter(keep);
  return items.sort((a, b) => +b.data.verifiedAt - +a.data.verifiedAt || a.data.name.localeCompare(b.data.name));
}

export async function getProjects() {
  const items = (await getCollection('projects')).filter(keep).sort((a, b) => a.data.order - b.data.order);
  return {
    main: items.filter((p) => p.data.tier === 'main'),
    small: items.filter((p) => p.data.tier === 'small'),
  };
}

/** 页面渲染的内容里只要有一条 mock，就输出 noindex */
export const anyMock = (...lists: { mock?: boolean; data?: { mock?: boolean } }[][]) =>
  lists.some((l) => l.some((x) => x.mock ?? x.data?.mock));

/** 文章的元信息标签：带代码 / 带数据 */
export const postFlags = (p: Post) => [p.hasData && '带数据', p.hasCode && '带代码'].filter(Boolean) as string[];

/** 工具图标位的缩写 */
export function abbr(name: string, given?: string): string {
  if (given) return given;
  const latin = name.match(/[A-Za-z][A-Za-z0-9]*/g);
  if (latin && latin.length >= 2) return (latin[0][0] + latin[1][0]).toUpperCase();
  if (latin) {
    const caps = latin[0].match(/[A-Z]/g);
    if (caps && caps.length >= 2) return caps[0] + caps[1];
    return latin[0].slice(0, 2).replace(/^./, (c) => c.toUpperCase());
  }
  return name.slice(0, 2);
}
