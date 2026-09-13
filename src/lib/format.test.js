import { describe, it, expect } from 'vitest'
import { data, dataHora, moeda, numero, duracao, mesLabel } from './format'

/**
 * O bug que isso protege: uma data pura do banco ("2026-09-07", coluna
 * `date`) passada pro construtor Date é lida como meia-noite EM UTC.
 * Exibida no fuso local (Fortaleza, UTC-3) virava 21h do dia ANTERIOR —
 * ou seja, o relatório do dia 7 aparecia como dia 6 na tela.
 */
describe('data', () => {
  it('data pura do banco não anda um dia pra trás', () => {
    expect(data('2026-09-07')).toBe('07/09/2026')
    expect(data('2026-01-01')).toBe('01/01/2026')
    expect(data('2026-12-31')).toBe('31/12/2026')
  })

  it('timestamp de verdade continua sendo convertido normalmente', () => {
    // instante real, com fuso explícito — aí não há ambiguidade
    expect(data('2026-09-07T15:00:00Z')).toBe('07/09/2026')
  })

  it('vazio vira travessão em vez de "Invalid Date"', () => {
    expect(data(null)).toBe('—')
    expect(data(undefined)).toBe('—')
    expect(data('')).toBe('—')
  })
})

describe('dataHora', () => {
  it('vazio vira travessão', () => {
    expect(dataHora(null)).toBe('—')
  })

  it('formata instante com dia e hora', () => {
    expect(dataHora('2026-09-07T15:30:00Z')).toMatch(/07\/09\/2026/)
  })
})

describe('moeda e numero', () => {
  it('moeda em real, com duas casas', () => {
    expect(moeda(1234.5)).toMatch(/1\.234,50/)
    expect(moeda(0)).toMatch(/0,00/)
  })

  it('valor inválido vira zero em vez de NaN', () => {
    expect(moeda(null)).toMatch(/0,00/)
    expect(moeda('abc')).toMatch(/0,00/)
    expect(numero(undefined)).toBe('0')
  })

  it('numero respeita as casas pedidas', () => {
    expect(numero(3.456, 1)).toBe('3,5')
    expect(numero(3.456, 2)).toBe('3,46')
    expect(numero(1000, 0)).toBe('1.000')
  })
})

describe('duracao', () => {
  it('minutos, horas e dias', () => {
    expect(duracao(30)).toBe('30 min')
    expect(duracao(60)).toBe('1h')
    expect(duracao(90)).toBe('1h 30min')
    expect(duracao(60 * 25)).toBe('1d 1h')
  })

  it('negativo não vira duração negativa', () => {
    expect(duracao(-10)).toBe('0 min')
  })
})

describe('mesLabel', () => {
  it('abrevia mês/ano', () => {
    expect(mesLabel('2026-09')).toBe('set/26')
    expect(mesLabel('2026-01')).toBe('jan/26')
  })

  it('vazio vira travessão', () => {
    expect(mesLabel(null)).toBe('—')
  })
})
