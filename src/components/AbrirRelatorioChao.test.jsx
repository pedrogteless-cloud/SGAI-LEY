import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderizar, consulta } from '../teste/utilitarios'

vi.mock('../hooks/useDados', () => ({
  useSetores: () => consulta([{ id: 's1', nome: 'Corte' }, { id: 's2', nome: 'Embalagem' }, { id: 's3', nome: 'Laminação' }]),
  useTecnicos: () => consulta([{ id: 'p1', nome: 'Fulano' }]),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ perfil: { id: 'p1' } }) }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))

const { default: AbrirRelatorioChao } = await import('./AbrirRelatorioChao')

describe('AbrirRelatorioChao', () => {
  it('não avisa nada com todos os setores marcados', () => {
    renderizar(<AbrirRelatorioChao aberto aoFechar={() => {}} unidadeId="u1" aoAbrir={() => {}} />)
    expect(screen.queryByText(/Vai ficar de fora/)).toBeNull()
  })

  it('diz quais setores vão ficar de fora quando algum é desmarcado', () => {
    renderizar(<AbrirRelatorioChao aberto aoFechar={() => {}} unidadeId="u1" aoAbrir={() => {}} />)
    fireEvent.click(screen.getByText('Embalagem'))
    fireEvent.click(screen.getByText('Laminação'))
    expect(screen.getByText(/Vai ficar de fora:/).parentElement.textContent).toMatch(/Embalagem, Laminação\./)
  })
})
