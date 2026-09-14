import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 侧边栏轻量 H5：无重型 UI 库（TTFT 预算），纯 fetch REST
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
