import { defineConfig } from 'vitest/config';

// 单元/属性测试配置：仅覆盖 src 下的纯 TS 逻辑（校验、动画工具）
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
