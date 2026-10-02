import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorAviso } from '../components/ui'

/**
 * Monta a tela com o mínimo que ela precisa pra existir: rota, cache de
 * consulta e o provedor de aviso. Os dados não vêm daqui — quem testa
 * troca os hooks de dados por resultados de mentira (ver `consulta`).
 */
export function renderizar(elemento, { rota = '/' } = {}) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={cliente}>
      <ProvedorAviso>
        <MemoryRouter initialEntries={[rota]}>{elemento}</MemoryRouter>
      </ProvedorAviso>
    </QueryClientProvider>
  )
}

/**
 * O formato que o useTabela devolve. O padrão é o estado que mais
 * derruba tela: consulta ainda sem resposta, `data` indefinido.
 */
export function consulta(data, { isLoading = false } = {}) {
  return { data, isLoading, isError: false, error: null, refetch: () => {} }
}

export const carregando = () => consulta(undefined, { isLoading: true })
