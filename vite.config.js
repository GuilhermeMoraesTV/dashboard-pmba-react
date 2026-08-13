import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifestFilename: 'manifest.webmanifest',
      includeAssets: ['logoModoQAP.png'],
      manifest: {
        name: 'ModoQAP - Plataforma de Estudos',
        short_name: 'ModoQAP',
        description: 'Plataforma de organização e acompanhamento de estudos para concursos públicos.',
        lang: 'pt-BR',
        start_url: '/app/home',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#f7f9fc',
        theme_color: '#111827',
        icons: [
          {
            src: '/logoModoQAP.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        globPatterns: [
          '**/*.{js,css,html,svg,woff,woff2,ttf}',
          'logoModoQAP.png',
        ],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'modoqap-images-v1',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'modoqap-fonts-v1',
              expiration: {
                maxEntries: 24,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true, // Isso libera o acesso para a rede (0.0.0.0)
    port: 5173, // (Opcional) Fixa a porta, caso queira garantir que seja sempre a mesma
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/pages/AdminPage/') || id.includes('\\src\\pages\\AdminPage\\')) return 'admin';
          if (id.includes('/src/pages/NoticiasPage') || id.includes('/src/components/noticias/')) return 'noticias';
          if (id.includes('/src/components/ciclos/StudyTimer/') || id.includes('/src/pages/SimuladosPage/SimuladoTimer')) return 'timers';
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('date-fns')) return 'date-utils';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('chart.js') || id.includes('recharts') || id.includes('react-chartjs-2')) return 'charts';
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('pdfjs-dist')) return 'export-pdf';
            if (id.includes('lucide-react') || id.includes('@dnd-kit') || id.includes('react-window') || id.includes('react-virtuoso')) return 'ui-libs';
            return 'vendor';
          }
        },
      },
    },
  },
})
