import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderizar, consulta, carregando } from '../teste/utilitarios'

const tabela = vi.fn()

vi.mock('../hooks/useDados', () => ({
  useTabela: (...args) => tabela(...args),
  useUnidades: () => consulta([{ id: 'u1', nome: 'Eusébio' }]),
  useTecnicos: () => consulta([{ id: 'p1', nome: 'Fulano' }]),
  useInvalidar: () => () => {},
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ perfil: { id: 'p1', nome: 'Fulano', unidade_id: 'u1' }, ehGestor: true }),
}))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }))

const { default: Chao5S } = await import('./Chao5S')

const RELATORIO = {
  id: 'r1', numero: 'RCF-2026-00001', status: 'em_andamento', data: '2026-09-13',
  unidade_id: 'u1', turno: 'manhã', aberta_em: '2026-09-13T08:00:00Z',
}
const SETORES = [
  { id: 'ss1', relatorio_id: 'r1', setor_id: 's1', nota: 4, nao_inspecionado: false, setor: { nome: 'Corte' } },
  { id: 'ss2', relatorio_id: 'r1', setor_id: 's2', nota: null, nao_inspecionado: true, justificativa_nao_inspecionado: 'Setor fechado', setor: { nome: 'Colagem' } },
  { id: 'ss3', relatorio_id: 'r1', setor_id: 's3', nota: null, nao_inspecionado: false, setor: { nome: 'Montagem' } },
]
const ITENS = [
  { id: 'i1', setor_avaliacao_id: 'ss1', item: 'seiri', resposta: 'parcial', descricao_problema: 'Retalho' },
  { id: 'i2', setor_avaliacao_id: 'ss1', item: 'seiton', resposta: 'conforme' },
]

const responder = ({ resumo, setores, itens, acoes }) =>
  tabela.mockImplementation((nome) => {
    if (nome === 'vw_relatorio_chao_resumo') return resumo
    if (nome === 'relatorio_chao_setores') return setores
    if (nome === 'vw_relatorio_chao_setor_5s') return itens
    if (nome === 'vw_acoes_chao') return acoes
    return consulta([])
  })

beforeEach(() => tabela.mockReset())

describe('5S do dia', () => {
  it('abre carregando', () => {
    responder({ resumo: carregando(), setores: carregando(), itens: carregando(), acoes: carregando() })
    renderizar(<Chao5S />)
    expect(screen.getByText('5S')).toBeInTheDocument()
  })

  it('abre quando não há relatório no dia', () => {
    responder({ resumo: consulta([]), setores: consulta([]), itens: consulta([]), acoes: consulta([]) })
    renderizar(<Chao5S />)
    expect(screen.getByText('Nenhum relatório nesse dia')).toBeInTheDocument()
  })

  it('abre com data indefinido em todas as consultas', () => {
    const vazio = consulta(undefined)
    responder({ resumo: vazio, setores: vazio, itens: vazio, acoes: vazio })
    renderizar(<Chao5S />)
    expect(screen.getByText('5S')).toBeInTheDocument()
  })

  it('distingue avaliado, não visitado e ainda sem avaliação', () => {
    responder({
      resumo: consulta([RELATORIO]), setores: consulta(SETORES),
      itens: consulta(ITENS), acoes: consulta([]),
    })
    renderizar(<Chao5S />)
    expect(screen.getByText('1 item(ns) com ressalva no 5S')).toBeInTheDocument()
    expect(screen.getByText(/Não visitado — Setor fechado/)).toBeInTheDocument()
    expect(screen.getByText('Ainda não avaliado')).toBeInTheDocument()
  })

  // O que fecha o ciclo aparece junto do que abriu: quem olha o setor vê
  // na mesma linha se a ressalva já virou conserto com dono.
  it('mostra quantas ações vivas a ressalva do setor já virou', () => {
    responder({
      resumo: consulta([RELATORIO]), setores: consulta(SETORES), itens: consulta(ITENS),
      acoes: consulta([
        { id: 'a1', setor_5s_id: 'i1', status: 'aberta' },
        { id: 'a2', setor_5s_id: 'i2', status: 'cancelada' },
      ]),
    })
    renderizar(<Chao5S />)
    expect(screen.getByText('1 ação(ões) em aberto')).toBeInTheDocument()
  })

  it('não conta ação já fechada como pendência do setor', () => {
    responder({
      resumo: consulta([RELATORIO]), setores: consulta(SETORES), itens: consulta(ITENS),
      acoes: consulta([{ id: 'a2', setor_5s_id: 'i1', status: 'concluida' }]),
    })
    renderizar(<Chao5S />)
    expect(screen.queryByText(/ação\(ões\) em aberto/)).toBeNull()
  })

  // Regressão: um relatório cancelado virava o "relatório do dia", a tela
  // caía num checklist só de leitura e não sobrava caminho pra abrir outro.
  it('não busca relatório cancelado como relatório do dia', () => {
    responder({ resumo: consulta([]), setores: consulta([]), itens: consulta([]), acoes: consulta([]) })
    renderizar(<Chao5S />)
    const chamada = tabela.mock.calls.find(([nome]) => nome === 'vw_relatorio_chao_resumo')
    expect(chamada[1].filtros).toContainEqual(['status', 'neq', 'cancelada'])
  })

  it('oferece abrir o relatório do dia quando não há nenhum', () => {
    responder({ resumo: consulta([]), setores: consulta([]), itens: consulta([]), acoes: consulta([]) })
    renderizar(<Chao5S />)
    expect(screen.getByRole('button', { name: /Abrir relatório do dia/ })).toBeInTheDocument()
  })
})
