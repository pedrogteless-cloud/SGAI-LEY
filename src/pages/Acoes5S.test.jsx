import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderizar, consulta, carregando } from '../teste/utilitarios'

const tabela = vi.fn()

vi.mock('../hooks/useDados', () => ({
  useTabela: (...args) => tabela(...args),
  useUnidades: () => consulta([{ id: 'u1', nome: 'Eusébio' }]),
  useSetores: () => consulta([{ id: 's1', nome: 'Corte' }]),
  useTecnicos: () => consulta([{ id: 'p1', nome: 'Fulano' }]),
  useInvalidar: () => () => {},
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ perfil: { id: 'p1', nome: 'Fulano', unidade_id: 'u1' }, ehGestor: true }),
}))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))

const { default: Acoes5S } = await import('./Acoes5S')

const acao = (extra) => ({
  id: 'x', unidade_id: 'u1', descricao: 'Tirar o retalho da passagem',
  prioridade: 'alta', status: 'aberta', prazo: null, dias_atraso: null,
  responsavel_id: 'p1', responsavel_nome: 'Fulano', setor_nome: 'Corte',
  item_5s: 'seiri', ...extra,
})

beforeEach(() => tabela.mockReset())

describe('Ações do 5S', () => {
  it('abre carregando', () => {
    tabela.mockReturnValue(carregando())
    renderizar(<Acoes5S />)
    expect(screen.getByText('Ações do 5S')).toBeInTheDocument()
  })

  it('abre sem ação nenhuma', () => {
    tabela.mockReturnValue(consulta([]))
    renderizar(<Acoes5S />)
    expect(screen.getByText('Ações do 5S')).toBeInTheDocument()
  })

  it('abre com data indefinido', () => {
    tabela.mockReturnValue(consulta(undefined))
    renderizar(<Acoes5S />)
    expect(screen.getByText('Ações do 5S')).toBeInTheDocument()
  })

  // "Atrasada" e "sem responsável" também são nomes de aba e de texto de
  // linha — o número tem que sair do cartão de resumo, não de qualquer
  // lugar da tela onde a palavra aparece.
  const numeroDoCartao = (rotulo) => {
    const titulo = screen
      .getAllByText(rotulo)
      .find((e) => e.className.includes('text-xs') && e.className.includes('text-slate-500'))
    return titulo.nextElementSibling.textContent.trim()
  }

  it('conta como atrasada só o que passou do prazo', () => {
    tabela.mockReturnValue(consulta([
      acao({ id: 'a', dias_atraso: 3, prazo: '2026-09-01' }),
      acao({ id: 'b', dias_atraso: -2, prazo: '2026-09-30' }),
      acao({ id: 'c', dias_atraso: null }),
    ]))
    renderizar(<Acoes5S />)
    expect(numeroDoCartao('Atrasadas')).toBe('1')
    expect(numeroDoCartao('Pendentes')).toBe('3')
    expect(numeroDoCartao('Sem prazo')).toBe('1')
  })

  it('conta quem está sem responsável', () => {
    tabela.mockReturnValue(consulta([
      acao({ id: 'a', responsavel_id: null, responsavel_nome: null }),
      acao({ id: 'b' }),
    ]))
    renderizar(<Acoes5S />)
    expect(numeroDoCartao('Sem responsável')).toBe('1')
  })
})
