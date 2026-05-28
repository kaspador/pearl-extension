import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',     // service worker requires modern runtime
    sourcemap: false,     // smaller zip for Web Store upload
    rollupOptions: {
      output: { chunkFileNames: 'assets/chunk-[hash].js' },
    },
  },
  server: {
    port: 5173,
    strictPort: true,     // CRX HMR client expects a stable port
    hmr: { port: 5173 },
  },
});
