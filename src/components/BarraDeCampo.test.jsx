import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderizar } from '../teste/utilitarios'

const conexao = { valor: true }
vi.mock('../hooks/useConexao', () => ({ useConexao: () => conexao.valor }))

const { default: BarraDeCampo } = await import('./BarraDeCampo')

describe('BarraDeCampo', () => {
  beforeEach(() => { conexao.valor = true })

  it('não mostra nada quando está online e não tem atualização', () => {
    renderizar(<BarraDeCampo atualizacao={null} />)
    expect(screen.queryByText(/Sem internet/)).toBeNull()
    expect(screen.queryByText(/versão nova/)).toBeNull()
  })

  it('avisa quando cai a internet', () => {
    conexao.valor = false
    renderizar(<BarraDeCampo atualizacao={null} />)
    expect(screen.getByText(/Sem internet/)).toBeInTheDocument()
  })

  // Sem internet manda mais do que uma versão nova esperando: primeiro
  // resolve o que impede de trabalhar agora.
  it('prioriza o aviso de offline sobre o de atualização', () => {
    conexao.valor = false
    renderizar(<BarraDeCampo atualizacao={() => {}} />)
    expect(screen.getByText(/Sem internet/)).toBeInTheDocument()
    expect(screen.queryByText(/versão nova/)).toBeNull()
  })

  it('chama a função de atualizar ao tocar no aviso', () => {
    const aplicar = vi.fn()
    renderizar(<BarraDeCampo atualizacao={aplicar} />)
    fireEvent.click(screen.getByText(/versão nova/))
    expect(aplicar).toHaveBeenCalledOnce()
  })
})
