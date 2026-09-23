import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderizar, consulta, carregando } from '../teste/utilitarios'

const auth = { valor: { ehGestor: true } }
const tabela = vi.fn()

vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth.valor }))
vi.mock('../hooks/useDados', () => ({
  useTabela: (...a) => tabela(...a),
  useUnidades: () => consulta([{ id: 'u1', nome: 'Eusébio' }]),
  useInvalidar: () => () => {},
}))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }))

const { default: Equipe } = await import('./Equipe')

const PESSOAS = [
  { id: 'p1', nome: 'Pedro Teles', email: 'pedro@ley.com.br', papel: 'gestor', ativo: true, sou_eu: true, unidade_nome: null, criado_em: '2026-01-10', tem_pin: false },
  { id: 'p2', nome: 'Rogério Alves', email: 'rogerio@ley.com.br', papel: 'tecnico', ativo: true, sou_eu: false, unidade_nome: 'Eusébio', criado_em: '2026-02-01', tem_pin: true },
  { id: 'p3', nome: 'Antigo Funcionário', email: 'antigo@ley.com.br', papel: 'tecnico', ativo: false, sou_eu: false, unidade_nome: null, criado_em: '2025-03-01', tem_pin: false },
]

beforeEach(() => {
  auth.valor = { ehGestor: true }
  tabela.mockReturnValue(consulta(PESSOAS))
})

describe('Equipe', () => {
  // A tela esconder não é a trava — o banco também fecha. Mas oferecer
  // porta que não abre é pior que não oferecer.
  it('não abre pra quem não é gestor', () => {
    auth.valor = { ehGestor: false }
    renderizar(<Equipe />)
    expect(screen.getByText('Só gestor abre esta tela')).toBeInTheDocument()
    expect(screen.queryByText('Nova pessoa')).toBeNull()
  })

  it('abre carregando', () => {
    tabela.mockReturnValue(carregando())
    renderizar(<Equipe />)
    expect(screen.getByText('Equipe')).toBeInTheDocument()
  })

  it('aguenta consulta que ainda não respondeu', () => {
    tabela.mockReturnValue(consulta(undefined))
    renderizar(<Equipe />)
    expect(screen.getByText('Equipe')).toBeInTheDocument()
  })

  it('lista só os ativos na aba de ativos', () => {
    renderizar(<Equipe />)
    expect(screen.getByText('Pedro Teles')).toBeInTheDocument()
    expect(screen.getByText('Rogério Alves')).toBeInTheDocument()
    expect(screen.queryByText('Antigo Funcionário')).toBeNull()
  })

  it('marca quem é você, pra não editar o próprio papel sem perceber', () => {
    renderizar(<Equipe />)
    expect(screen.getByText('(você)')).toBeInTheDocument()
  })

  it('diz por extenso o que cada papel entrega', () => {
    renderizar(<Equipe />)
    expect(screen.getByText('O que cada papel pode')).toBeInTheDocument()
    expect(screen.getByText(/Criar pessoa e mudar permissão/)).toBeInTheDocument()
    expect(screen.getByText(/Avisa problema pelo QR/)).toBeInTheDocument()
  })

  // Apagar deixaria serviço, relatório e auditoria órfãos.
  it('explica por que não existe apagar pessoa', () => {
    renderizar(<Equipe />)
    expect(screen.getByText(/Não existe apagar pessoa, só desativar/)).toBeInTheDocument()
  })
})
