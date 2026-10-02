import { describe, it, expect } from 'vitest'
import {
  consistenciaDaObservacao, observacaoPorDia, serieDeCadaSetor,
  ressalvasPorItem, problemasQueVoltaram,
} from './evolucao5s'

const aval = (data, setor, nota, naoInspecionado = false) => ({
  relatorio_data: data, setor_nome: setor, nota, nao_inspecionado: naoInspecionado,
})

describe('consistenciaDaObservacao', () => {
  it('separa observado, justificado e o que ficou sem registro nenhum', () => {
    const c = consistenciaDaObservacao([
      aval('2026-09-01', 'Corte', 4),
      aval('2026-09-01', 'Colagem', null, true),
      aval('2026-09-01', 'Montagem', null, false),
    ])
    expect(c.previstos).toBe(3)
    expect(c.observados).toBe(1)
    expect(c.justificados).toBe(1)
    expect(c.semRegistro).toBe(1)
  })

  // O ponto do combinado com a fábrica: justificativa explica a falta,
  // não substitui a visita. Se contasse a favor, a porcentagem mediria
  // burocracia em vez de observação.
  it('não conta setor justificado como observado', () => {
    const c = consistenciaDaObservacao([
      aval('2026-09-01', 'Corte', 3),
      aval('2026-09-01', 'Colagem', null, true),
    ])
    expect(c.pctObservado).toBe(50)
  })

  it('conta dias distintos, não linhas', () => {
    const c = consistenciaDaObservacao([
      aval('2026-09-01', 'Corte', 3),
      aval('2026-09-01', 'Colagem', 4),
      aval('2026-09-02', 'Corte', 5),
    ])
    expect(c.diasComRelatorio).toBe(2)
    expect(c.diasComObservacao).toBe(2)
  })

  it('aguenta lista vazia sem inventar número', () => {
    const c = consistenciaDaObservacao([])
    expect(c.previstos).toBe(0)
    expect(c.pctObservado).toBeNull()
  })
})

describe('observacaoPorDia', () => {
  it('agrupa por dia em ordem cronológica', () => {
    const dias = observacaoPorDia([
      aval('2026-09-03', 'Corte', 4),
      aval('2026-09-01', 'Corte', 3),
      aval('2026-09-01', 'Colagem', null, true),
    ])
    expect(dias.map((d) => d.data)).toEqual(['2026-09-01', '2026-09-03'])
    expect(dias[0]).toMatchObject({ observados: 1, justificados: 1, semRegistro: 0 })
  })
})

describe('serieDeCadaSetor', () => {
  const avaliacoes = [
    aval('2026-09-02', 'Montagem', 2),
    aval('2026-09-01', 'Corte', 3),
    aval('2026-09-03', 'Corte', 5),
    aval('2026-09-01', 'Montagem', 4),
  ]

  // Ordenar por nota transformaria a tela num ranking, que é
  // exatamente o que não pode existir na fase de aprendizado.
  it('devolve em ordem alfabética, nunca por nota', () => {
    expect(serieDeCadaSetor(avaliacoes).map((s) => s.setor)).toEqual(['Corte', 'Montagem'])
  })

  it('ordena os pontos de cada setor por data', () => {
    const corte = serieDeCadaSetor(avaliacoes).find((s) => s.setor === 'Corte')
    expect(corte.pontos.map((p) => p.data)).toEqual(['2026-09-01', '2026-09-03'])
    expect(corte.primeira).toBe(3)
    expect(corte.ultima).toBe(5)
    expect(corte.media).toBe(4)
  })

  it('ignora setor sem nota (não visitado não vira ponto no gráfico)', () => {
    const series = serieDeCadaSetor([...avaliacoes, aval('2026-09-04', 'Expedição', null, true)])
    expect(series.map((s) => s.setor)).not.toContain('Expedição')
  })
})

describe('ressalvasPorItem', () => {
  const respostas = [
    { item: 'seiri', resposta: 'nao_conforme' },
    { item: 'seiri', resposta: 'parcial' },
    { item: 'seiri', resposta: 'conforme' },
    { item: 'seiton', resposta: 'conforme' },
    { item: 'seiso', resposta: 'nao_inspecionado' },
  ]

  it('mantém a ordem do método, não a da frequência', () => {
    expect(ressalvasPorItem(respostas).map((i) => i.item))
      .toEqual(['seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke'])
  })

  it('soma parcial e não conforme como ressalva', () => {
    const seiri = ressalvasPorItem(respostas).find((i) => i.item === 'seiri')
    expect(seiri.comRessalva).toBe(2)
    expect(seiri.respondidas).toBe(3)
    expect(seiri.pctComRessalva).toBeCloseTo(66.67, 1)
  })

  // "Não inspecionado" não é conforme nem problema: ninguém julgou.
  // Deixar entrar no denominador diluiria a leitura sem motivo.
  it('não conta "não inspecionado" em lugar nenhum', () => {
    const seiso = ressalvasPorItem(respostas).find((i) => i.item === 'seiso')
    expect(seiso.respondidas).toBe(0)
    expect(seiso.pctComRessalva).toBeNull()
  })

  it('devolve os 5 itens mesmo sem resposta nenhuma', () => {
    expect(ressalvasPorItem([])).toHaveLength(5)
  })
})

describe('problemasQueVoltaram', () => {
  const respostas = [
    { setor_nome: 'Corte', item: 'seiri', resposta: 'nao_conforme', relatorio_data: '2026-09-01', descricao_problema: 'Retalho na passagem' },
    { setor_nome: 'Corte', item: 'seiri', resposta: 'parcial', relatorio_data: '2026-09-03', descricao_problema: 'Retalho ainda ali' },
    { setor_nome: 'Corte', item: 'seiton', resposta: 'parcial', relatorio_data: '2026-09-01', descricao_problema: 'Ferramenta solta' },
    { setor_nome: 'Colagem', item: 'seiso', resposta: 'conforme', relatorio_data: '2026-09-01' },
  ]

  it('só lista o que apareceu em mais de um dia', () => {
    const voltaram = problemasQueVoltaram(respostas)
    expect(voltaram).toHaveLength(1)
    expect(voltaram[0]).toMatchObject({ setor: 'Corte', item: 'seiri', vezes: 2 })
  })

  it('mostra a descrição mais recente, não a primeira', () => {
    expect(problemasQueVoltaram(respostas)[0].ultimaDescricao).toBe('Retalho ainda ali')
  })

  // Duas respostas do mesmo dia (relatório reenviado) são uma
  // ocorrência só — senão corrigir um erro de digitação viraria
  // "problema que voltou".
  it('conta dia distinto, não linha', () => {
    const duplicado = [
      ...respostas,
      { setor_nome: 'Corte', item: 'seiton', resposta: 'parcial', relatorio_data: '2026-09-01', descricao_problema: 'Ferramenta solta' },
    ]
    expect(problemasQueVoltaram(duplicado).map((g) => g.item)).toEqual(['seiri'])
  })

  it('ignora o que está conforme', () => {
    expect(problemasQueVoltaram(respostas).some((g) => g.setor === 'Colagem')).toBe(false)
  })
})
