import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Isso libera o acesso para a rede (0.0.0.0)
    port: 5173, // (Opcional) Fixa a porta, caso queira garantir que seja sempre a mesma
  }
})