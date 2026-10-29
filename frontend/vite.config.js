import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // El chunk principal (React + Supabase + iconos) ronda ~570 kB; el resto
    // de los módulos ya va en chunks aparte por ruta (ver App.jsx, lazy()).
    chunkSizeWarningLimit: 600,
  },
})
