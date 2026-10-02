import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderizar, consulta, carregando } from '../teste/utilitarios'

const tabela = vi.fn()
vi.mock('../hooks/useDados', () => ({
  useTabela: (...args) => tabela(...args),
  useUnidades: () => consulta([{ id: 'u1', nome: 'Eusébio' }]),
  useSetores: () => consulta([{ id: 's1', nome: 'Corte' }]),
}))
vi.mock('qrcode', () => ({ default: { toString: vi.fn(async (link) => `<svg data-link="${link}"></svg>`) } }))

const { default: EtiquetasEmLote } = await import('./EtiquetasEmLote')

const ATIVOS = [
  { id: 'a1', codigo: 'MAQ-001', nome: 'Serra fita', qr_token: 't1', setor: { nome: 'Corte' } },
  { id: 'a2', codigo: 'MAQ-002', nome: 'Máquina de costura', qr_token: 't2', setor: { nome: 'Costura' } },
  { id: 'a3', codigo: 'MAQ-003', nome: 'Sem token', qr_token: null },
]

beforeEach(() => {
  tabela.mockReset()
  window.print = vi.fn()
})

describe('Etiquetas em lote', () => {
  it('abre carregando', () => {
    tabela.mockReturnValue(carregando())
    renderizar(<EtiquetasEmLote />)
    expect(screen.getByText('Imprimir etiquetas')).toBeInTheDocument()
  })

  it('abre com data indefinido', () => {
    tabela.mockReturnValue(consulta(undefined))
    renderizar(<EtiquetasEmLote />)
    expect(screen.getByText('Nenhuma máquina com esse filtro')).toBeInTheDocument()
  })

  it('vem com todas marcadas e ignora máquina sem QR', () => {
    tabela.mockReturnValue(consulta(ATIVOS))
    renderizar(<EtiquetasEmLote />)
    expect(screen.getByText('2 de 2 marcadas')).toBeInTheDocument()
    expect(screen.queryByText('Sem token')).toBeNull()
    expect(screen.getByRole('button', { name: /Imprimir 2 etiquetas/ })).toBeEnabled()
  })

  it('desmarcar tira da contagem', () => {
    tabela.mockReturnValue(consulta(ATIVOS))
    renderizar(<EtiquetasEmLote />)
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    expect(screen.getByText('1 de 2 marcadas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Imprimir 1 etiqueta$/ })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Desmarcar todas'))
    expect(screen.getByRole('button', { name: /Imprimir 0 etiquetas/ })).toBeDisabled()
  })

  // O ponto da tela: uma página por etiqueta, cada QR com o próprio link.
  it('gera uma página por etiqueta marcada, com o link de cada uma', async () => {
    tabela.mockReturnValue(consulta(ATIVOS))
    renderizar(<EtiquetasEmLote />)
    fireEvent.click(screen.getByRole('button', { name: /Imprimir 2 etiquetas/ }))
    await waitFor(() => expect(document.querySelectorAll('.etiquetas-lote .etiqueta-pagina')).toHaveLength(2))
    const links = [...document.querySelectorAll('.etiquetas-lote svg')].map((s) => s.getAttribute('data-link'))
    expect(links[0]).toMatch(/\/reportar\/t1$/)
    expect(links[1]).toMatch(/\/reportar\/t2$/)
  })
})
