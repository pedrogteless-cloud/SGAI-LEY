// Roda antes de cada arquivo de teste.
//
// Os testes de tela precisam de umas poucas peças de navegador que o jsdom
// não traz e que o app usa de verdade (gráfico que mede o container, tela
// que pergunta o tema do sistema). Sem isso o teste quebraria por causa do
// ambiente, não por causa de um defeito — que é o pior tipo de teste.
import { afterEach, beforeEach, vi } from 'vitest'

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (consulta) => ({
      matches: false,
      media: consulta,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })
  }

  // O recharts desenha dentro de um ResponsiveContainer, que no jsdom mede
  // 0x0 e não renderiza nada. Um tamanho fixo faz o gráfico existir — é o
  // suficiente pra pegar erro de uso da biblioteca.
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  for (const [prop, valor] of [['offsetWidth', 800], ['offsetHeight', 400]]) {
    Object.defineProperty(window.HTMLElement.prototype, prop, {
      configurable: true,
      value: valor,
    })
  }

  // Sem `globals: true` o Testing Library não registra a limpeza sozinho,
  // e aí uma tela renderizada num teste continua no documento no próximo —
  // toda busca por texto passa a achar dois elementos.
  const { cleanup } = await import('@testing-library/react')
  await import('@testing-library/jest-dom/vitest')
  afterEach(cleanup)

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      // Um erro do React durante o render é falha de teste, não ruído:
      // é exatamente o "a tela quebrou" que estes testes existem pra pegar.
      throw new Error(`console.error durante o render: ${args.join(' ')}`)
    })
  })
}
