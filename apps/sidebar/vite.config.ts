import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 侧边栏轻量 H5：无重型 UI 库（TTFT 预算），纯 fetch REST
export default defineConfig({
  base: '/sidebar/', // 同域托管：<domain>/sidebar/
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5180, // 避开 admin 的 5173
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
