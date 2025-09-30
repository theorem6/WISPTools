import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    exclude: ['@firebase/app']
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      process: 'process/browser',
    },
  },
  server: {
    fs: {
      allow: ['..']
    }
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true
  },
  ssr: {
    noExternal: ['@arcgis/core']
  }
});
