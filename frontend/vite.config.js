import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_BACKEND_URL || 'http://localhost:5001';
  // Everything the Express server owns: API, uploads, SSR SEO pages, sitemaps, robots
  const proxied = ['/api', '/uploads', '/hotels', '/blog', '/sitemap.xml', '/sitemaps', '/robots.txt', '/seo-assets'];
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve('src') } },
    server: {
      port: 5173,
      host: true, // reachable from phones on the same Wi-Fi
      proxy: Object.fromEntries(proxied.map((p) => [p, { target: backend, changeOrigin: true }])),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'charts';
            if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) return 'editor';
          },
        },
      },
    },
  };
});
