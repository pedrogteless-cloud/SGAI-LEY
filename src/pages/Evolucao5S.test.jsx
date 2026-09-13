import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderizar, consulta, carregando } from '../teste/utilitarios'

const tabela = vi.fn()

vi.mock('../hooks/useDados', () => ({
  useTabela: (...args) => tabela(...args),
  useUnidades: () => consulta([{ id: 'u1', nome: 'Eusébio' }]),
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ perfil: { id: 'p1', nome: 'Fulano', unidade_id: 'u1' }, ehGestor: true }),
}))

const { default: Evolucao5S } = await import('./Evolucao5S')

// Um dia de checklist: dois setores observados, um justificado.
const AVALIACOES = [
  { id: 'a1', setor_nome: 'Corte', nota: 3, nao_inspecionado: false, relatorio_data: '2026-09-01' },
  { id: 'a2', setor_nome: 'Corte', nota: 4.2, nao_inspecionado: false, relatorio_data: '2026-09-04' },
  { id: 'a3', setor_nome: 'Montagem', nota: 2, nao_inspecionado: false, relatorio_data: '2026-09-01' },
  { id: 'a4', setor_nome: 'Colagem', nota: null, nao_inspecionado: true, relatorio_data: '2026-09-01' },
]
const RESPOSTAS = [
  { id: 'r1', setor_nome: 'Corte', item: 'seiri', resposta: 'nao_conforme', descricao_problema: 'Retalho na passagem', relatorio_data: '2026-09-01' },
  { id: 'r2', setor_nome: 'Corte', item: 'seiri', resposta: 'parcial', descricao_problema: 'Retalho ainda ali', relatorio_data: '2026-09-04' },
  { id: 'r3', setor_nome: 'Corte', item: 'seiton', resposta: 'conforme', relatorio_data: '2026-09-01' },
  { id: 'r4', setor_nome: 'Montagem', item: 'seiso', resposta: 'parcial', descricao_problema: 'Pó embaixo da prensa', relatorio_data: '2026-09-01' },
]

const responder = (avaliacoes, respostas) =>
  tabela.mockImplementation((nome) =>
    nome === 'vw_relatorio_chao_setor_avaliacoes' ? avaliacoes : respostas
  )

beforeEach(() => tabela.mockReset())

describe('Evolução do 5S', () => {
  it('abre com a consulta ainda carregando', () => {
    responder(carregando(), carregando())
    renderizar(<Evolucao5S />)
    expect(screen.getByText('Evolução do 5S')).toBeInTheDocument()
  })

  // O estado mais comum no primeiro dia de uso — e o que mais quebra
  // tela, porque quase todo cálculo divide por algo.
  it('abre sem nenhum checklist no período', () => {
    responder(consulta([]), consulta([]))
    renderizar(<Evolucao5S />)
    expect(screen.getByText('Ainda não há checklist nesse período')).toBeInTheDocument()
  })

  it('abre com data indefinido (consulta que ainda não respondeu)', () => {
    responder(consulta(undefined), consulta(undefined))
    renderizar(<Evolucao5S />)
    expect(screen.getByText('Evolução do 5S')).toBeInTheDocument()
  })

  it('mostra a consistência da observação, não uma nota geral', () => {
    responder(consulta(AVALIACOES), consulta(RESPOSTAS))
    renderizar(<Evolucao5S />)
    expect(screen.getByText('Setores observados')).toBeInTheDocument()
    // 3 de 4 previstos têm nota; o justificado não conta a favor
    expect(screen.getByText('3 de 4 previstos')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  // A regra combinada pra fase de aprendizado: nada de classificação.
  it('lista os setores em ordem alfabética, nunca por nota', () => {
    responder(consulta(AVALIACOES), consulta(RESPOSTAS))
    const { container } = renderizar(<Evolucao5S />)
    const nomes = [...container.querySelectorAll('p.truncate.text-sm.font-semibold')]
      .map((e) => e.textContent)
    expect(nomes).toEqual(['Corte', 'Montagem'])
  })

  it('deixa claro na tela que não é ranking nem cobrança de meta', () => {
    responder(consulta(AVALIACOES), consulta(RESPOSTAS))
    renderizar(<Evolucao5S />)
    expect(screen.getByText(/não é ranking nem cobrança de meta/)).toBeInTheDocument()
  })

  it('aponta o problema que voltou no mesmo setor', () => {
    responder(consulta(AVALIACOES), consulta(RESPOSTAS))
    renderizar(<Evolucao5S />)
    expect(screen.getByText('Retalho ainda ali')).toBeInTheDocument()
    expect(screen.getByText('2×')).toBeInTheDocument()
  })
})
