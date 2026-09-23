/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.npm_package_version && process.env.npm_package_version !== '0.0.0'
        ? process.env.npm_package_version
        : '1.3'
    ),
  },
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router',
      'react-router-dom',
      'zustand',
      'sonner',
      '@tanstack/react-query',
    ],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router',
      'react-router-dom',
      'zustand',
      'sonner',
      '@tanstack/react-query',
      'lucide-react',
      'clsx',
      'tailwind-merge',
      'framer-motion',
      'i18next',
      'react-i18next',
      '@hookform/resolvers/zod',
      'react-hook-form',
      'zod',
      'bwip-js',
    ],
  },
  build: {
    modulePreload: {
      resolveDependencies(_filename, deps, { hostType }) {
        if (hostType === 'html') {
          return deps.filter((dep) => !dep.includes('recharts') && !dep.includes('print-engine') && !dep.includes('chart-math'));
        }
        return deps;
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) {
            return 'recharts';
          }
          if (id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor')) {
            return 'chart-math';
          }
          if (id.includes('node_modules/bwip-js') || id.includes('src/lib/barcode')) {
            return 'print-engine';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/sitemap-products.xml': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/sitemap-categories.xml': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/sitemap-pages.xml': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/robots.txt': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '^/store/[^/]+/sitemap.*\\.xml': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '^/store/[^/]+/robots\\.txt': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '^/manifest.*\\.json': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '^/store/[^/]+/manifest\\.json': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
