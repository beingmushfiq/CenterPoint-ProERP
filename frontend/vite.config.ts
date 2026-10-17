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
        : '2.0'
    ),
  },
  resolve: {
    alias: {
      react: 'react',
      'react-dom': 'react-dom',
      'react-dom/client': 'react-dom/client',
    },
    dedupe: [
      'react',
      'react-dom',
      'react-dom/client',
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
      'apexcharts',
      'react-apexcharts',
    ],
  },
  build: {
    modulePreload: {
      resolveDependencies(_filename, deps, { hostType }) {
        if (hostType === 'html') {
          return [];
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
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-xlsx';
          }
          if (id.includes('node_modules/apexcharts') || id.includes('node_modules/react-apexcharts')) {
            return 'vendor-apexcharts';
          }
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.host) {
              proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
            }
          });
        },
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
