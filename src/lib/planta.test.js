import { describe, it, expect } from 'vitest'
import { endereco, letraFaixa, letraFaixaDoTopo, divisoes, CELULA_LARGURA } from './planta'

describe('letraFaixa', () => {
  it('conta A, B, C… a partir de zero', () => {
    expect(letraFaixa(0)).toBe('A')
    expect(letraFaixa(1)).toBe('B')
    expect(letraFaixa(4)).toBe('E')
  })

  it('passa de Z pra AA', () => {
    expect(letraFaixa(25)).toBe('Z')
    expect(letraFaixa(26)).toBe('AA')
  })
})

describe('letraFaixaDoTopo', () => {
  // A numeração de campo começa no FUNDO do galpão: 1A é o canto
  // inferior esquerdo. O desenho e o cursor contam de cima pra baixo
  // (índice 0 no topo) — é essa conversão que não pode inverter sozinha.
  it('dá a última letra pro topo e A pro fundo', () => {
    const total = 6 // A..F
    expect(letraFaixaDoTopo(0, total)).toBe('F') // topo do desenho
    expect(letraFaixaDoTopo(total - 1, total)).toBe('A') // fundo do desenho
  })

  it('mantém a ordem crescente de baixo pra cima', () => {
    const total = 5
    const letras = Array.from({ length: total }, (_, i) => letraFaixaDoTopo(i, total))
    expect(letras).toEqual(['E', 'D', 'C', 'B', 'A'])
  })
})

describe('endereco', () => {
  // Galpão de 72×30 m (Eusébio), célula de 6×5 m -> 6 faixas (A..F).
  const planta = { comprimento_m: 72, largura_m: 30 }

  it('1A fica no canto inferior esquerdo (x=0, y=máximo)', () => {
    expect(endereco(0, 30, planta).curto).toBe('1A')
  })

  it('o topo do desenho (y=0) fica na última letra, não em A', () => {
    expect(endereco(0, 0, planta).faixa).toBe('F')
  })

  it('o vão continua contado da esquerda (1) pra direita, sem inverter', () => {
    expect(endereco(0, 30, planta).vao).toBe(1)
    expect(endereco(71.9, 30, planta).vao).toBe(12)
  })

  it('a letra desce conforme o ponto se aproxima do fundo (y crescente)', () => {
    // y=0 é o topo do desenho (F); y perto de 30 é o fundo, onde mora o A.
    const letras = [0, 5, 10, 15, 20, 25, 29.9].map((y) => endereco(0, y, planta).faixa)
    expect(letras).toEqual(['F', 'E', 'D', 'C', 'B', 'A', 'A'])
  })

  it('acompanha a grade desenhada: mesma quantidade de faixas nos dois', () => {
    const { faixas } = divisoes(planta)
    const totalFaixas = faixas.length - 1
    expect(totalFaixas).toBe(6)
    expect(CELULA_LARGURA * totalFaixas).toBeGreaterThanOrEqual(Number(planta.largura_m))
  })

  it('devolve null sem planta ou sem coordenada', () => {
    expect(endereco(null, 0, planta)).toBeNull()
    expect(endereco(0, 0, null)).toBeNull()
  })
})
