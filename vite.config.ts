import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import manifest from './extension/manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
});
