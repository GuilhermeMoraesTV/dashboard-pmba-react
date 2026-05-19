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
            if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('pdfjs-dist')) {
              return 'vendor-pdf';
            }
            if (id.includes('chart.js') || id.includes('react-chartjs-2') || id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('framer-motion') || id.includes('lucide-react')) {
              return 'vendor-ui';
            }
          }

          if (
            id.includes('/src/pages/Planejamento') ||
            id.includes('/src/components/cronograma/') ||
            id.includes('/src/hooks/useCronograma') ||
            id.includes('/src/services/scheduling/') ||
            id.includes('/src/services/cronograma')
          ) {
            return 'planning-flow';
          }

          if (
            id.includes('/src/pages/CiclosPage') ||
            id.includes('/src/pages/CicloDetalhePage') ||
            id.includes('/src/components/ciclos/') ||
            id.includes('/src/hooks/useCiclos') ||
            id.includes('/src/hooks/useCicloRevisoes') ||
            id.includes('/src/services/cicloRevisoes')
          ) {
            return 'cycle-flow';
          }

          if (
            id.includes('/src/pages/RevisaoPage') ||
            id.includes('/src/pages/EditalPage') ||
            id.includes('/src/pages/NoticiasPage') ||
            id.includes('/src/pages/SimuladosPage')
          ) {
            return 'secondary-pages';
          }
        },
      },
    },
  },
})
