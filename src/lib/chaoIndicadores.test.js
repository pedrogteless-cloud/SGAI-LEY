import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  limitesPeriodo,
  achatarLancamentos,
  agregarPeriodo,
  agregarLimpeza,
  indiceDestinacaoUtil,
  variacaoPercentual,
  notaMediaDe,
  calcularRealizadoMeta,
  situacaoMeta,
} from './chaoIndicadores'

/**
 * Esses testes existem por um motivo específico: a auditoria mostrou que
 * os indicadores estavam somando kg com m³ e com "unidade" no mesmo
 * número, e contando quantidade onde deveria contar ocorrência. Como
 * esses números viram decisão de gestão ("qual setor mais gera resíduo",
 * "estamos melhorando?"), eles precisam de rede de proteção — não dá pra
 * confiar só em ler o código de novo depois.
 */

// Lançamento cru no formato que vw_residuo_lancamentos devolve.
const lanc = (over = {}) => ({
  id: crypto.randomUUID(),
  material_id: 'm1',
  material_nome: 'Espuma',
  tipo_movimentacao: 'geracao',
  origem: 'corte',
  setor_id: 's1',
  setor_nome: 'Corte',
  quadrante: '7C',
  relatorio_data: '2026-09-10',
  medicoes: [{ unidade_medida: 'kg', quantidade: 10 }],
  ...over,
})

describe('achatarLancamentos', () => {
  it('vira uma linha por medição, guardando de qual lançamento veio', () => {
    const linhas = achatarLancamentos([
      lanc({ medicoes: [{ unidade_medida: 'kg', quantidade: 5 }, { unidade_medida: 'm3', quantidade: 2 }] }),
    ])
    expect(linhas).toHaveLength(2)
    expect(linhas[0].lancamento_id).toBe(linhas[1].lancamento_id)
  })

  it('descarta medição sem quantidade positiva', () => {
    const linhas = achatarLancamentos([
      lanc({ medicoes: [{ unidade_medida: 'kg', quantidade: 0 }, { unidade_medida: 'kg', quantidade: -3 }] }),
    ])
    expect(linhas).toHaveLength(0)
  })

  it('aguenta lançamento sem medição nenhuma', () => {
    expect(achatarLancamentos([lanc({ medicoes: null })])).toHaveLength(0)
    expect(achatarLancamentos(null)).toHaveLength(0)
  })
})

describe('agregarPeriodo — nunca somar unidade de medida diferente', () => {
  it('separa o mesmo material em linhas diferentes por unidade', () => {
    const linhas = achatarLancamentos([
      lanc({ medicoes: [{ unidade_medida: 'kg', quantidade: 10 }] }),
      lanc({ medicoes: [{ unidade_medida: 'm3', quantidade: 3 }] }),
    ])
    const r = agregarPeriodo(linhas)

    // O bug antigo somava 10 + 3 = 13 "de nada". O certo é duas linhas.
    expect(r.geradoPorMaterial).toHaveLength(2)
    const chaves = r.geradoPorMaterial.map((x) => x.chave).sort()
    expect(chaves).toEqual(['Espuma (kg)', 'Espuma (m3)'])
    expect(r.geradoPorMaterial.find((x) => x.chave === 'Espuma (kg)').valor).toBe(10)
    expect(r.geradoPorMaterial.find((x) => x.chave === 'Espuma (m3)').valor).toBe(3)
  })

  it('faz o mesmo por setor e por origem', () => {
    const linhas = achatarLancamentos([
      lanc({ setor_nome: 'Corte', medicoes: [{ unidade_medida: 'kg', quantidade: 8 }] }),
      lanc({ setor_nome: 'Corte', medicoes: [{ unidade_medida: 'unidade', quantidade: 4 }] }),
    ])
    const r = agregarPeriodo(linhas)
    expect(r.geradoPorSetor.map((x) => x.chave).sort()).toEqual(['Corte (kg)', 'Corte (unidade)'])
    expect(r.geradoPorOrigem.map((x) => x.chave).sort()).toEqual(['corte (kg)', 'corte (unidade)'])
  })

  it('o total do topo é só kg, sem fingir que dá pra somar o resto', () => {
    const linhas = achatarLancamentos([
      lanc({ medicoes: [{ unidade_medida: 'kg', quantidade: 10 }] }),
      lanc({ medicoes: [{ unidade_medida: 'm3', quantidade: 99 }] }),
      lanc({ medicoes: [{ unidade_medida: 'big_bag', quantidade: 7 }] }),
    ])
    expect(agregarPeriodo(linhas).geradoTotalKg).toBe(10)
  })

  it('descarte/moagem/reaproveitamento também só contam kg (a tela rotula kg)', () => {
    const linhas = achatarLancamentos([
      lanc({ tipo_movimentacao: 'descarte', medicoes: [{ unidade_medida: 'kg', quantidade: 6 }] }),
      lanc({ tipo_movimentacao: 'descarte', medicoes: [{ unidade_medida: 'm3', quantidade: 50 }] }),
      lanc({ tipo_movimentacao: 'enviado_moagem', medicoes: [{ unidade_medida: 'kg', quantidade: 4 }] }),
    ])
    const r = agregarPeriodo(linhas)
    expect(r.descartado).toBe(6)
    expect(r.enviadoMoagem).toBe(4)
  })
})

describe('agregarPeriodo — quadrante conta ocorrência, não quantidade', () => {
  it('conta 2 ocorrências no 7C mesmo com pesos quebrados', () => {
    const linhas = achatarLancamentos([
      lanc({ quadrante: '7C', medicoes: [{ unidade_medida: 'kg', quantidade: 3.2 }] }),
      lanc({ quadrante: '7C', medicoes: [{ unidade_medida: 'kg', quantidade: 0.5 }] }),
      lanc({ quadrante: '8A', medicoes: [{ unidade_medida: 'kg', quantidade: 100 }] }),
    ])
    const porQuadrante = agregarPeriodo(linhas).geradoPorQuadrante
    // O bug antigo devolvia 3.7 pro 7C (soma de peso) e deixava o 8A na
    // frente com 100. O certo: 7C com 2 ocorrências, na frente do 8A com 1.
    expect(porQuadrante[0]).toEqual({ chave: '7C', valor: 2 })
    expect(porQuadrante.find((x) => x.chave === '8A').valor).toBe(1)
  })

  it('um lançamento com 2 medições conta como 1 ocorrência, não 2', () => {
    const linhas = achatarLancamentos([
      lanc({ quadrante: '7C', medicoes: [{ unidade_medida: 'kg', quantidade: 3 }, { unidade_medida: 'm3', quantidade: 1 }] }),
    ])
    expect(agregarPeriodo(linhas).geradoPorQuadrante[0]).toEqual({ chave: '7C', valor: 1 })
  })
})

describe('agregarLimpeza — "não inspecionado" não é inspeção', () => {
  const aval = (over) => ({ setor_nome: 'Corte', nota: null, nao_inspecionado: false, ...over })

  it('não conta setor não inspecionado como inspecionado', () => {
    const r = agregarLimpeza([
      aval({ nota: 4 }),
      aval({ nao_inspecionado: true }),
      aval({ nota: null }),
      aval({ nota: 2 }),
    ])
    // 2 de 4 receberam nota de verdade
    expect(r.pctInspecionados).toBe(50)
    // e o número antigo (nota OU justificativa) continua disponível, com nome honesto
    expect(r.pctComJustificativaOuNota).toBe(75)
  })

  it('nota média ignora quem não tem nota', () => {
    expect(notaMediaDe([aval({ nota: 4 }), aval({ nao_inspecionado: true }), aval({ nota: 2 })])).toBe(3)
    expect(notaMediaDe([aval({ nao_inspecionado: true })])).toBeNull()
    expect(notaMediaDe([])).toBeNull()
  })

  it('média por setor vem do pior pro melhor', () => {
    const r = agregarLimpeza([
      aval({ setor_nome: 'Costura', nota: 5 }),
      aval({ setor_nome: 'Corte', nota: 1 }),
      aval({ setor_nome: 'Espuma', nota: 3 }),
    ])
    expect(r.mediaPorSetor.map((s) => s.setor)).toEqual(['Corte', 'Espuma', 'Costura'])
  })
})

describe('limitesPeriodo — comparação sempre com período do mesmo tamanho', () => {
  afterEach(() => vi.useRealTimers())

  // 10/09/2026 às 23h em Fortaleza = 11/09 às 02h UTC. Se a conta usasse
  // UTC, "hoje" viraria dia 11 — o bug que a auditoria pegou.
  const fixarEm = (iso) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(iso))
  }

  it('"hoje" respeita o fuso de Fortaleza mesmo depois das 21h', () => {
    fixarEm('2026-09-11T02:00:00Z') // 10/09 23h em Fortaleza
    const p = limitesPeriodo('hoje')
    expect(p.inicio).toBe('2026-09-10')
    expect(p.fim).toBe('2026-09-10')
  })

  it('7 dias pega 7 dias e compara com os 7 anteriores', () => {
    fixarEm('2026-09-10T15:00:00Z')
    const p = limitesPeriodo('7dias')
    expect(p.inicio).toBe('2026-09-04')
    expect(p.fim).toBe('2026-09-10')
    expect(p.inicioAnterior).toBe('2026-08-28')
    expect(p.fimAnterior).toBe('2026-09-03')
  })

  it('mês atual compara com uma janela do mesmo tamanho, não com o mês inteiro anterior', () => {
    fixarEm('2026-09-10T15:00:00Z')
    const p = limitesPeriodo('mes')
    expect(p.inicio).toBe('2026-09-01')
    expect(p.fim).toBe('2026-09-10')
    // 10 dias corridos → os 10 dias imediatamente anteriores
    expect(p.fimAnterior).toBe('2026-08-31')
    expect(p.inicioAnterior).toBe('2026-08-22')
  })

  it('período personalizado não cai no fuso do aparelho', () => {
    fixarEm('2026-09-10T15:00:00Z')
    const p = limitesPeriodo('personalizado', { inicio: '2026-01-01', fim: '2026-01-31' })
    expect(p.inicio).toBe('2026-01-01')
    expect(p.fim).toBe('2026-01-31')
    expect(p.fimAnterior).toBe('2025-12-31')
    expect(p.inicioAnterior).toBe('2025-12-01')
  })

  it('vira o ano sem quebrar', () => {
    fixarEm('2026-01-02T15:00:00Z')
    const p = limitesPeriodo('7dias')
    expect(p.inicio).toBe('2025-12-27')
    expect(p.fim).toBe('2026-01-02')
  })
})

describe('índices e variação', () => {
  it('destinação útil = útil / (útil + descarte)', () => {
    expect(indiceDestinacaoUtil({ reutilizadoInterno: 30, vendidoReciclado: 10, descartado: 10 })).toBe(80)
  })

  it('sem base nenhuma devolve null em vez de 0 (0% seria mentira)', () => {
    expect(indiceDestinacaoUtil({ reutilizadoInterno: 0, vendidoReciclado: 0, descartado: 0 })).toBeNull()
  })

  it('variação sem período anterior devolve null, não "+100%"', () => {
    expect(variacaoPercentual(50, 0)).toBeNull()
    expect(variacaoPercentual(50, 100)).toBe(-50)
    expect(variacaoPercentual(150, 100)).toBe(50)
  })
})

describe('metas — realizado x alvo', () => {
  const linhasDe = (ls) => achatarLancamentos(ls)

  it('resíduo por material soma só kg do material da meta', () => {
    const linhas = linhasDe([
      lanc({ material_id: 'm1', medicoes: [{ unidade_medida: 'kg', quantidade: 10 }] }),
      lanc({ material_id: 'm2', medicoes: [{ unidade_medida: 'kg', quantidade: 99 }] }),
      lanc({ material_id: 'm1', medicoes: [{ unidade_medida: 'm3', quantidade: 99 }] }),
    ])
    const r = calcularRealizadoMeta(
      { indicador: 'max_residuo_material', material_id: 'm1' },
      { linhasAchatadas: linhas, avaliacoes: [], relatorios: [] }
    )
    expect(r.valor).toBe(10)
    expect(r.sentido).toBe('max')
  })

  it('ocorrência por quadrante conta ocorrência (não peso)', () => {
    const linhas = linhasDe([
      lanc({ quadrante: '7C', medicoes: [{ unidade_medida: 'kg', quantidade: 0.5 }] }),
      lanc({ quadrante: '7C', medicoes: [{ unidade_medida: 'kg', quantidade: 0.5 }] }),
      lanc({ quadrante: '2B', medicoes: [{ unidade_medida: 'kg', quantidade: 80 }] }),
    ])
    const r = calcularRealizadoMeta(
      { indicador: 'max_ocorrencias_quadrante' },
      { linhasAchatadas: linhas, avaliacoes: [], relatorios: [] }
    )
    expect(r.valor).toBe(2)
    expect(r.unidade).toBe('ocorrências')
  })

  it('% de setores inspecionados não conta "não inspecionado"', () => {
    const r = calcularRealizadoMeta(
      { indicador: 'pct_min_setores_inspecionados' },
      {
        linhasAchatadas: [],
        avaliacoes: [{ nota: 3 }, { nota: null, nao_inspecionado: true }],
        relatorios: [],
      }
    )
    expect(r.valor).toBe(50)
  })

  it('indicador que depende de produção admite que não tem dado, em vez de inventar', () => {
    for (const indicador of ['max_kg_por_100_colchoes', 'max_indice_perda', 'reducao_percentual']) {
      const r = calcularRealizadoMeta({ indicador }, { linhasAchatadas: [], avaliacoes: [], relatorios: [] })
      expect(r.semDados).toBe(true)
      expect(r.valor).toBeNull()
    }
  })

  it('situação da meta respeita o sentido do indicador', () => {
    // sentido "max": quanto menor melhor
    expect(situacaoMeta({ valor: 90, sentido: 'max' }, { valor_alvo: 100 })).toBe('dentro')
    expect(situacaoMeta({ valor: 110, sentido: 'max' }, { valor_alvo: 100 })).toBe('atencao')
    expect(situacaoMeta({ valor: 200, sentido: 'max' }, { valor_alvo: 100 })).toBe('fora')
    // sentido "min": quanto maior melhor
    expect(situacaoMeta({ valor: 100, sentido: 'min' }, { valor_alvo: 90 })).toBe('dentro')
    expect(situacaoMeta({ valor: 80, sentido: 'min' }, { valor_alvo: 90 })).toBe('atencao')
    expect(situacaoMeta({ valor: 10, sentido: 'min' }, { valor_alvo: 90 })).toBe('fora')
    // sem dado nunca vira "fora" (não é culpa de ninguém não ter dado)
    expect(situacaoMeta({ valor: null, sentido: 'min' }, { valor_alvo: 90 })).toBe('sem_dado')
  })
})
