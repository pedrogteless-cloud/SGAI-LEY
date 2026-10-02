import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderizar, consulta, carregando } from '../teste/utilitarios'

const registro = { valor: null }

vi.mock('../hooks/useDados', () => ({
  useRegistro: () => registro.valor,
  useUnidades: () => consulta([{ id: 'u1', nome: 'Eusébio' }]),
  useInvalidar: () => () => {},
}))
// O conteúdo de cada bloco tem consulta própria; aqui o que se testa é o
// montador, então o bloco vira um selo simples.
vi.mock('../components/painel/BlocoConteudo', () => ({
  default: ({ bloco }) => <div data-testid="conteudo">{bloco.tipo}</div>,
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

const { default: PainelMontar } = await import('./PainelMontar')

const painel = (extra = {}) => consulta({
  id: 'p1', nome: 'Manutenção da semana', descricao: 'O que olho toda segunda',
  dono_id: 'eu', dono_nome: 'Fulano', compartilhado: false, meu: true,
  unidade_id: null, blocos: [], ...extra,
})

const BLOCOS = [
  { id: 'b1', tipo: 'numero', titulo: 'Serviços abertos', x: 0, y: 0, w: 3, h: 2, fonte: 'os_abertas', operacao: 'contar' },
  { id: 'b2', tipo: 'barras', titulo: 'Custo por setor', x: 3, y: 0, w: 6, h: 4, fonte: 'os', operacao: 'somar', campoValor: 'custo_total', agruparPor: 'setor' },
]

beforeEach(() => { registro.valor = painel() })

describe('Montador de painel', () => {
  it('abre carregando', () => {
    registro.valor = carregando()
    renderizar(<PainelMontar />)
    expect(document.body.textContent).toContain('Carregando')
  })

  it('avisa quando o painel não existe mais', () => {
    registro.valor = consulta(null)
    renderizar(<PainelMontar />)
    expect(screen.getByText('Painel não encontrado')).toBeInTheDocument()
  })

  it('abre um painel em branco convidando a montar', () => {
    renderizar(<PainelMontar />)
    expect(screen.getByText('Painel em branco')).toBeInTheDocument()
  })

  it('desenha os blocos salvos', () => {
    registro.valor = painel({ blocos: BLOCOS })
    renderizar(<PainelMontar />)
    expect(screen.getByText('Serviços abertos')).toBeInTheDocument()
    expect(screen.getByText('Custo por setor')).toBeInTheDocument()
    expect(screen.getAllByTestId('conteudo')).toHaveLength(2)
  })

  // Compartilhar dá vista, não caneta: o layout salva como documento
  // inteiro, então dois editando ao mesmo tempo se sobrescreveriam.
  it('não oferece montar num painel de outra pessoa', () => {
    registro.valor = painel({ meu: false, blocos: BLOCOS })
    renderizar(<PainelMontar />)
    expect(screen.queryByText('Montar')).toBeNull()
    expect(screen.getByText(/você pode ver e duplicar, mas não mexer/i)).toBeInTheDocument()
  })

  it('mostra de quem é o painel compartilhado', () => {
    registro.valor = painel({ meu: false, compartilhado: true, blocos: BLOCOS })
    renderizar(<PainelMontar />)
    expect(screen.getByText(/Painel de Fulano/)).toBeInTheDocument()
  })

  it('aguenta blocos vindo nulo do banco em vez de quebrar a tela', () => {
    registro.valor = painel({ blocos: null })
    renderizar(<PainelMontar />)
    expect(screen.getByText('Painel em branco')).toBeInTheDocument()
  })
})
