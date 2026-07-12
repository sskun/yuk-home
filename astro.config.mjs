// @ts-check
import { defineConfig } from 'astro/config';

// Astro 配置：静态优先输出，产物为纯静态资源，契合 Cloudflare Pages 托管
export default defineConfig({
  // 纯静态站点，无需 SSR 适配器
  output: 'static',
});
