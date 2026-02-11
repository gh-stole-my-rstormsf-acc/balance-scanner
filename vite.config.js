import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || 'dev'),
  },
  build: {
    target: 'es2020',
    outDir: '../dist',
    minify: 'esbuild',
    sourcemap: false,
    emptyOutDir: true,
  },
});
