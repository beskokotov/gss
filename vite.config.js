import { defineConfig } from 'vitest/config';
import { newsSnapshot } from './scripts/lib/news-snapshot.mjs';

export default defineConfig({
  base: './',
  plugins: [newsSnapshot()],
  esbuild: { jsx: 'automatic' },
  build: {
    rollupOptions: {
      output: { manualChunks: { 'react-vendor': ['react', 'react-dom', 'react-dom/client'] } }
    }
  },
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/backups/**']
  }
});
