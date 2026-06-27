import { defineConfig } from 'vite';

// Plain Vite config. The app is a static single-page site; no framework plugins
// are required. `base: './'` keeps asset URLs relative so the production build
// works when served from a sub-path (e.g. GitHub Pages or a nested route).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
  },
});
