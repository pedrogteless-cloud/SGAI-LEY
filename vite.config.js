import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Os testes cobrem a matemática dos indicadores e as contas de data —
  // é o que, se estiver errado, vira decisão de gestão errada sem ninguém
  // perceber. Fuso fixado em Fortaleza pra o teste rodar igual aqui e no CI.
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          graficos: ['recharts'],
        },
      },
    },
  },
})
