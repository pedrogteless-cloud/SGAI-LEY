import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ImpressaoRelatorio from './ImpressaoRelatorio'
import { linhasDosSensos } from '../lib/relatorio5s'

const base = { titulo: 'Relatório', tabelas: [] }
const foto = (n) => ({ url: `f${n}.jpg`, legenda: `Legenda ${n}` })

describe('ImpressaoRelatorio · setor por setor', () => {
  it('não renderiza nada sem dados', () => {
    const { container } = render(<ImpressaoRelatorio dados={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('mostra dia da semana e data em destaque', () => {
    render(<ImpressaoRelatorio dados={{ ...base, destaqueData: { dia: 'QUARTA', data: '23/09/2026' } }} />)
    expect(screen.getByText('QUARTA')).toBeInTheDocument()
    expect(screen.getByText('23/09/2026')).toBeInTheDocument()
  })

  it('tabela os cinco sensos em português, com o texto rotulado', () => {
    const sensos = linhasDosSensos([
      { item: 'seiso', resposta: 'parcial', descricao_problema: 'Pó no piso', sugestao: 'Varrer' },
    ])
    render(<ImpressaoRelatorio dados={{ ...base, setores: [{ titulo: 'Corte', nota: 'Nota 4,0 · Bom', sensos, fotos: [] }] }} />)
    const tabela = document.querySelector('.impressao-sensos')
    for (const nome of ['1. Utilização', '2. Organização', '3. Limpeza', '4. Padronização', '5. Disciplina']) {
      expect(within(tabela).getByText(nome)).toBeInTheDocument()
    }
    expect(within(tabela).getByText('Pó no piso')).toBeInTheDocument()
    expect(within(tabela).getByText('Varrer')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Seiri|Seiton|Seiso|Seiketsu|Shitsuke/)
  })

  it('setor não visitado mostra o aviso no lugar da tabela', () => {
    render(<ImpressaoRelatorio dados={{ ...base, setores: [{ titulo: 'Molas', aviso: 'Setor não visitado. Motivo: fechado', sensos: [], fotos: [] }] }} />)
    expect(screen.getByText('Setor não visitado. Motivo: fechado')).toBeInTheDocument()
    expect(document.querySelector('.impressao-sensos')).toBeNull()
  })

  it('junta os setores não avaliados numa linha só', () => {
    render(<ImpressaoRelatorio dados={{ ...base, setores: [], notaSetores: 'Setores ainda não avaliados: Molas, Montagem.' }} />)
    expect(screen.getByText('Setores ainda não avaliados: Molas, Montagem.')).toBeInTheDocument()
  })

  // A primeira linha de fotos vai presa à tabela; só se sobrar foto é que
  // aparece o aviso de "mais fotos" pra quem vira a folha.
  it('marca a continuação só quando o setor tem mais de uma linha de fotos', () => {
    const sensos = linhasDosSensos([])
    const { unmount } = render(<ImpressaoRelatorio dados={{ ...base, setores: [{ titulo: 'Corte', sensos, fotos: [1, 2, 3, 4].map(foto) }] }} />)
    expect(document.querySelectorAll('.impressao-setor img')).toHaveLength(4)
    expect(screen.queryByText(/mais fotos/)).toBeNull()
    unmount()

    render(<ImpressaoRelatorio dados={{ ...base, setores: [{ titulo: 'Corte', sensos, fotos: [1, 2, 3, 4, 5, 6].map(foto) }] }} />)
    expect(document.querySelectorAll('.impressao-setor img')).toHaveLength(6)
    expect(screen.getAllByText('Corte — mais fotos')).toHaveLength(1)
    expect(document.querySelector('.impressao-setor-topo').querySelectorAll('img')).toHaveLength(4)
  })
})
