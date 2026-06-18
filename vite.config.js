import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Isso libera o acesso para a rede (0.0.0.0)
    port: 5173, // (Opcional) Fixa a porta, caso queira garantir que seja sempre a mesma
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase';
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
