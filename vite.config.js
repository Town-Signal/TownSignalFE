import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 서버에서 /api 요청을 로컬 API(uvicorn, 8000 포트)로 넘긴다.
// 프론트는 항상 같은 출처 상대 경로(/api/...)만 쓴다. 운영은 vercel.json의 rewrites가 같은 역할을 한다(명세 12.1).
// 다른 서버(예: 운영 API)를 보려면 .env.local(커밋 안 됨)에 API_TARGET=http://… 한 줄을 둔다
const API_TARGET = loadEnv('development', process.cwd(), '').API_TARGET || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/health': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          leaflet: ['leaflet'],
        },
      },
    },
  },
});
