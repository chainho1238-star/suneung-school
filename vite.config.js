// Vite 설정 파일: 개발 서버 포트 등을 정해요. shared 폴더(서버와 같이 쓰는 파일)를 읽을 수 있게 허용해요.
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, host: true, fs: { allow: ['..'] } },
  build: { chunkSizeWarningLimit: 1500 },
});
