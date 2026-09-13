import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Duas camadas de teste, por motivos diferentes:
  //
  // .test.js  — a matemática dos indicadores e as contas de data. É o que,
  //             se estiver errado, vira decisão de gestão errada sem
  //             ninguém perceber. Roda em node, sem DOM.
  // .test.jsx — as telas abrem sem quebrar. Não testa aparência: testa que
  //             a tela renderiza com dados vazios, com dados de verdade e
  //             com a consulta ainda carregando — os três estados em que
  //             um `undefined.map` derruba a página inteira e o build não
  //             reclama de nada.
  //
  // Fuso fixado em Fortaleza pra o teste rodar igual aqui e no CI.
  test: {
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
    setupFiles: ['./src/teste/preparo.js'],
    environmentMatchGlobs: [
      ['src/**/*.test.jsx', 'jsdom'],
      ['**', 'node'],
    ],
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
