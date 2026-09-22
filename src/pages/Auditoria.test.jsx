import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderizar, consulta, carregando } from '../teste/utilitarios'

const auth = { valor: { ehGestor: true } }
const tabela = vi.fn()

vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth.valor }))
vi.mock('../hooks/useDados', () => ({ useTabela: (...a) => tabela(...a) }))

const { default: Auditoria } = await import('./Auditoria')

const REGISTROS = [
  {
    id: 3, criado_em: '2026-09-22T17:40:00Z', tabela: 'perfis', registro_id: 'p2',
    operacao: 'update', autor_id: 'p1', autor: 'Pedro Teles', autor_papel: 'gestor',
    campos: ['papel'], rotulo: 'Rogério Alves',
    dados_antes: { papel: 'operador' }, dados_depois: { papel: 'tecnico' },
  },
  {
    id: 2, criado_em: '2026-09-22T14:10:00Z', tabela: 'ordens_servico', registro_id: 'os1',
    operacao: 'insert', autor_id: 'p2', autor: 'Rogério Alves', autor_papel: 'tecnico',
    campos: ['numero', 'titulo'], rotulo: 'OS-2026-0031',
    dados_antes: null, dados_depois: { numero: 'OS-2026-0031', titulo: 'Troca de correia' },
  },
  {
    id: 1, criado_em: '2026-09-21T10:00:00Z', tabela: 'setores', registro_id: 's9',
    operacao: 'delete', autor_id: null, autor: 'Sistema', autor_papel: null,
    campos: ['nome'], rotulo: 'Setor velho',
    dados_antes: { nome: 'Setor velho' }, dados_depois: null,
  },
]

beforeEach(() => {
  auth.valor = { ehGestor: true }
  tabela.mockReturnValue(consulta(REGISTROS))
})

describe('Auditoria', () => {
  it('não abre pra quem não é gestor', () => {
    auth.valor = { ehGestor: false }
    renderizar(<Auditoria />)
    expect(screen.getByText('Só gestor abre esta tela')).toBeInTheDocument()
  })

  it('abre carregando', () => {
    tabela.mockReturnValue(carregando())
    renderizar(<Auditoria />)
    expect(screen.getByText('Auditoria')).toBeInTheDocument()
  })

  it('aguenta consulta que ainda não respondeu', () => {
    tabela.mockReturnValue(consulta(undefined))
    renderizar(<Auditoria />)
    expect(screen.getByText('Auditoria')).toBeInTheDocument()
  })

  it('avisa quando o período não tem nada', () => {
    tabela.mockReturnValue(consulta([]))
    renderizar(<Auditoria />)
    expect(screen.getByText('Nada registrado nesse recorte')).toBeInTheDocument()
  })

  // "Alterou" e os nomes também aparecem nas caixas de filtro, então a
  // busca precisa ser dentro da lista, senão o teste passa pelo motivo
  // errado.
  it('traduz a tabela e a operação em vez de mostrar o nome cru', () => {
    const { container } = renderizar(<Auditoria />)
    const lista = within(container.querySelector('ul'))
    expect(lista.getByText('Alterou')).toBeInTheDocument()
    expect(lista.getByText('Criou')).toBeInTheDocument()
    expect(lista.getByText('Apagou')).toBeInTheDocument()
    expect(lista.getByText('Serviço')).toBeInTheDocument()
    expect(screen.queryByText('ordens_servico')).toBeNull()
  })

  // Num update, o que interessa é o que mudou — não dois jsonb inteiros.
  it('diz qual campo mudou, em português', () => {
    renderizar(<Auditoria />)
    expect(screen.getByText('Mudou: papel')).toBeInTheDocument()
  })

  // Sem autor quer dizer RPC do QR, função no servidor ou mexida direta
  // no banco. Deixar em branco pareceria defeito.
  it('mostra "Sistema" quando não veio de gente logada', () => {
    const { container } = renderizar(<Auditoria />)
    expect(within(container.querySelector('ul')).getByText('Sistema')).toBeInTheDocument()
  })

  it('mostra quem fez, com o papel de quem fez', () => {
    const { container } = renderizar(<Auditoria />)
    const lista = within(container.querySelector('ul'))
    expect(lista.getByText('Pedro Teles')).toBeInTheDocument()
    expect(lista.getByText('(Gestor)')).toBeInTheDocument()
  })
})
