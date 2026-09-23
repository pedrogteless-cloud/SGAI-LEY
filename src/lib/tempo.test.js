import { describe, it, expect, vi, afterEach } from 'vitest'
import { hojeISO, dataISOEm, FUSO_HORARIO } from './tempo'

/**
 * O bug que isso protege: `new Date().toISOString().slice(0,10)` devolve a
 * data em UTC. Fortaleza é UTC-3, então a partir das 21h locais o UTC já
 * virou o dia seguinte — relatório "de hoje", filtro e lançamento saíam
 * com a data de amanhã depois desse horário.
 */
describe('hojeISO', () => {
  afterEach(() => vi.useRealTimers())

  const em = (iso) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(iso))
  }

  it('usa o fuso da fábrica, não UTC', () => {
    expect(FUSO_HORARIO).toBe('America/Fortaleza')
  })

  it('às 20h59 de Fortaleza ainda é hoje', () => {
    em('2026-09-10T23:59:00Z') // 20h59 em Fortaleza
    expect(hojeISO()).toBe('2026-09-10')
  })

  it('às 21h01 de Fortaleza CONTINUA sendo hoje (o UTC já virou, a fábrica não)', () => {
    em('2026-09-11T00:01:00Z') // 21h01 do dia 10 em Fortaleza
    expect(hojeISO()).toBe('2026-09-10')
    // conferindo que o jeito antigo realmente erraria aqui:
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-09-11')
  })

  it('vira o dia às 00h de Fortaleza (03h UTC)', () => {
    em('2026-09-11T03:00:00Z')
    expect(hojeISO()).toBe('2026-09-11')
  })

  it('devolve sempre YYYY-MM-DD', () => {
    em('2026-01-05T12:00:00Z')
    expect(hojeISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(hojeISO()).toBe('2026-01-05')
  })
})

describe('dataISOEm', () => {
  it('converte um instante do banco na data-calendário certa em Fortaleza', () => {
    expect(dataISOEm('2026-09-11T00:30:00Z')).toBe('2026-09-10')
    expect(dataISOEm('2026-09-11T12:00:00Z')).toBe('2026-09-11')
  })

  it('sem valor devolve null em vez de quebrar', () => {
    expect(dataISOEm(null)).toBeNull()
    expect(dataISOEm(undefined)).toBeNull()
    expect(dataISOEm('')).toBeNull()
  })
})
