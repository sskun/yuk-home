// @ts-check
import { defineConfig } from 'astro/config';
// Tailwind v4 的 Vite 插件：处理 src/styles/global.css（Tailwind + Starwind 主题 + 设计令牌 + 手写样式）
import tailwindcss from '@tailwindcss/vite';

// remark 插件：把 ```mermaid 代码块转成 <pre class="mermaid">，
// 从而绕过 Shiki 语法高亮，交给客户端 mermaid 运行时渲染成流程图。
function remarkMermaid() {
  /** @param {string} s */
  const escapeHtml = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 递归遍历 mdast，替换 lang 为 mermaid 的 code 节点
  /** @param {any} node */
  const walk = (node) => {
    if (!node || !Array.isArray(node.children)) return;
    node.children = node.children.map((/** @type {any} */ child) => {
      if (child.type === 'code' && child.lang === 'mermaid') {
        return { type: 'html', value: `<pre class="mermaid">${escapeHtml(child.value)}</pre>` };
      }
      walk(child);
      return child;
    });
  };
  return (/** @type {any} */ tree) => walk(tree);
}

// Astro 配置：静态优先输出，产物为纯静态资源，契合 Cloudflare Pages 托管
export default defineConfig({
  // 正式域名：用于生成 canonical、JSON-LD、sitemap 等的绝对 URL
  site: 'https://yuk-bvc.pages.dev',
  // 纯静态站点，无需 SSR 适配器
  output: 'static',
  // 站内链接悬停即预取，配合 ClientRouter 的视图过渡，切换页面几乎没有等待
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    remarkPlugins: [remarkMermaid],
    // Shiki 语法高亮：深色主题；代码块背景在 prose.css 里统一成设计令牌 --dark。
    // mermaid 代码块已被 remarkMermaid 转为 <pre class="mermaid">，不会经过 Shiki。
    shikiConfig: {
      theme: 'one-dark-pro',
      wrap: false,
    },
  },
});
