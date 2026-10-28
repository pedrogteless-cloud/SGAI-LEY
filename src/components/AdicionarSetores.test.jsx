import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderizar, consulta } from '../teste/utilitarios'

const upsert = vi.fn()
const invalidar = vi.fn()
vi.mock('../hooks/useDados', () => ({
  useSetores: () => consulta([
    { id: 's1', nome: 'Corte' }, { id: 's2', nome: 'Embalagem' }, { id: 's3', nome: 'Laminação' },
  ]),
  useInvalidar: () => invalidar,
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ upsert }) } }))

const { default: AdicionarSetores } = await import('./AdicionarSetores')

beforeEach(() => {
  upsert.mockReset().mockResolvedValue({ error: null })
  invalidar.mockReset()
})

describe('AdicionarSetores', () => {
  it('some quando todos os setores já estão no relatório', () => {
    const { container } = renderizar(<AdicionarSetores relatorioId="r1" unidadeId="u1" jaNoRelatorio={['s1', 's2', 's3']} />)
    expect(container.textContent).toBe('')
  })

  it('lista só os que faltam, já marcados, e grava todos', async () => {
    renderizar(<AdicionarSetores relatorioId="r1" unidadeId="u1" jaNoRelatorio={['s1']} />)
    fireEvent.click(screen.getByRole('button', { name: /Adicionar setor\s*\(2 fora deste relatório\)/ }))
    expect(screen.queryByLabelText('Corte')).toBeNull()
    expect(screen.getByLabelText('Embalagem')).toBeChecked()
    expect(screen.getByLabelText('Laminação')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 2' }))
    await waitFor(() => expect(upsert).toHaveBeenCalled())
    expect(upsert.mock.calls[0][0]).toEqual([
      { relatorio_id: 'r1', setor_id: 's2' },
      { relatorio_id: 'r1', setor_id: 's3' },
    ])
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith('relatorio_chao_setores', 'vw_relatorio_chao_resumo'))
  })

  it('grava só o que ficou marcado', async () => {
    renderizar(<AdicionarSetores relatorioId="r1" unidadeId="u1" jaNoRelatorio={['s1']} />)
    fireEvent.click(screen.getByRole('button', { name: /Adicionar setor/ }))
    fireEvent.click(screen.getByLabelText('Laminação'))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 1' }))
    await waitFor(() => expect(upsert).toHaveBeenCalled())
    expect(upsert.mock.calls[0][0]).toEqual([{ relatorio_id: 'r1', setor_id: 's2' }])
  })

  it('mostra o erro do banco e não fecha', async () => {
    upsert.mockResolvedValue({ error: { message: 'sem permissão' } })
    renderizar(<AdicionarSetores relatorioId="r1" unidadeId="u1" jaNoRelatorio={['s1']} />)
    fireEvent.click(screen.getByRole('button', { name: /Adicionar setor/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 2' }))
    expect(await screen.findByText('sem permissão')).toBeInTheDocument()
    expect(invalidar).not.toHaveBeenCalled()
  })
})
