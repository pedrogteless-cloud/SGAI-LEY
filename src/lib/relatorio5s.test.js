import { describe, it, expect } from 'vitest'
import {
  diaDaSemana, diaCurto, dataPorExtenso, horaDe, situacaoDoSetor, resumoDoSetor,
  sugestoesDoSetor, orcamentoDeFotos, numerosDoDia,
  fraseDoResumo, fraseDaNotaMedia, fraseDasRessalvas, fraseFotosRestantes,
} from './relatorio5s'

describe('diaCurto', () => {
  it('tira o "-feira" e põe em caixa alta', () => {
    expect(diaCurto('2026-09-23')).toBe('QUARTA')
    expect(diaCurto('2026-09-24')).toBe('QUINTA')
  })

  it('mantém o acento de sábado e domingo', () => {
    expect(diaCurto('2026-09-26')).toBe('SÁBADO')
    expect(diaCurto('2026-09-27')).toBe('DOMINGO')
  })

  it('devolve nulo sem data', () => {
    expect(diaCurto(null)).toBeNull()
  })
})

describe('diaDaSemana', () => {
  // new Date('2026-09-22') é meia-noite UTC e, em Fortaleza, volta como
  // dia 21 — o relatório sairia com o dia da semana errado.
  it('não deixa o fuso empurrar pro dia anterior', () => {
    expect(diaDaSemana('2026-09-22')).toBe('terça-feira')
    expect(diaDaSemana('2026-09-21')).toBe('segunda-feira')
    expect(diaDaSemana('2026-09-20')).toBe('domingo')
  })

  it('devolve nulo sem data', () => {
    expect(diaDaSemana(null)).toBeNull()
  })
})

describe('dataPorExtenso', () => {
  it('escreve a data do jeito que vai no cabeçalho', () => {
    expect(dataPorExtenso('2026-09-22')).toBe('22 de setembro de 2026 (terça-feira)')
    expect(dataPorExtenso('2026-03-01')).toBe('1 de março de 2026 (domingo)')
  })

  it('aguenta data ausente', () => {
    expect(dataPorExtenso(null)).toBe('—')
  })
})

describe('horaDe', () => {
  it('mostra a hora no fuso da fábrica, não em UTC', () => {
    // 2026-09-22T17:35Z é 14:35 em Fortaleza (UTC-3)
    expect(horaDe('2026-09-22T17:35:00Z')).toBe('14:35')
  })

  it('devolve nulo quando não tem horário', () => {
    expect(horaDe(null)).toBeNull()
  })
})

describe('situacaoDoSetor', () => {
  it('separa avaliado, não visitado e sem registro', () => {
    expect(situacaoDoSetor({ nota: 4 })).toBe('avaliado')
    expect(situacaoDoSetor({ nota: null, nao_inspecionado: true })).toBe('nao_visitado')
    expect(situacaoDoSetor({ nota: null, nao_inspecionado: false })).toBe('nao_avaliado')
  })
})

describe('resumoDoSetor', () => {
  it('escreve o motivo quando o setor não foi visitado', () => {
    const texto = resumoDoSetor(
      { nao_inspecionado: true, justificativa_nao_inspecionado: 'Portão fechado' }, []
    )
    expect(texto).toBe('Não foi possível visitar o setor. Motivo: Portão fechado')
  })

  it('não inventa motivo quando não tem', () => {
    expect(resumoDoSetor({ nao_inspecionado: true }, [])).toBe('Não foi possível visitar o setor.')
  })

  it('diz quando o setor ficou sem avaliação', () => {
    expect(resumoDoSetor({ nota: null }, [])).toMatch(/ainda sem avaliação/)
  })

  it('elogia sem exagero quando está tudo conforme', () => {
    const texto = resumoDoSetor(
      { nota: 5 },
      [{ item: 'seiri', resposta: 'conforme' }, { item: 'seiton', resposta: 'conforme' }]
    )
    expect(texto).toBe('Os cinco pontos do 5S foram considerados conformes. Nota 5,0 — Bom.')
  })

  // O ponto do relatório: quem lê não deveria ter que traduzir
  // "seiri: parcial" de cabeça.
  it('escreve a ressalva por extenso, com onde e o quê', () => {
    const texto = resumoDoSetor(
      { nota: 3.2 },
      [
        { item: 'seiri', resposta: 'nao_conforme', descricao_problema: 'Retalho na passagem', quadrante: '7C' },
        { item: 'seiso', resposta: 'parcial', descricao_problema: 'Pó embaixo da prensa' },
        { item: 'seiton', resposta: 'conforme' },
      ]
    )
    expect(texto).toContain('Nota 3,2 — Regular.')
    expect(texto).toContain('2 ressalvas')
    expect(texto).toContain('no quadrante 7C')
    expect(texto).toContain('Retalho na passagem')
    expect(texto).toContain('Pó embaixo da prensa')
  })

  it('usa singular quando é uma ressalva só', () => {
    const texto = resumoDoSetor({ nota: 4 }, [{ item: 'seiri', resposta: 'parcial', descricao_problema: 'x' }])
    expect(texto).toContain('1 ressalva:')
    expect(texto).not.toContain('1 ressalvas')
  })

  // "Não inspecionado" não é conforme nem problema: ninguém julgou.
  it('não conta item não inspecionado como conforme', () => {
    const texto = resumoDoSetor(
      { nota: null, nao_inspecionado: false },
      [{ item: 'seiri', resposta: 'nao_inspecionado' }]
    )
    expect(texto).toMatch(/ainda sem avaliação/)
  })

  it('avisa quando o setor foi visitado mas nada pôde ser julgado', () => {
    const texto = resumoDoSetor(
      { nota: 2 },
      [{ item: 'seiri', resposta: 'nao_inspecionado' }]
    )
    expect(texto).toMatch(/nenhum dos cinco pontos pôde ser julgado/)
  })
})

describe('sugestoesDoSetor', () => {
  it('junta só as sugestões de item com ressalva', () => {
    const s = sugestoesDoSetor([
      { resposta: 'nao_conforme', sugestao: 'Tirar o retalho' },
      { resposta: 'conforme', sugestao: 'ignorar esta' },
      { resposta: 'parcial', sugestao: 'Varrer no fim do turno' },
    ])
    expect(s).toBe('Tirar o retalho; Varrer no fim do turno')
  })

  it('devolve nulo quando ninguém sugeriu nada', () => {
    expect(sugestoesDoSetor([{ resposta: 'parcial', sugestao: '  ' }])).toBeNull()
    expect(sugestoesDoSetor([])).toBeNull()
  })
})

describe('orcamentoDeFotos — o teto de três páginas', () => {
  it('dá pelo menos uma foto pra cada setor que tem, quando cabe', () => {
    const cota = orcamentoDeFotos([
      { id: 'a', fotos: 5 }, { id: 'b', fotos: 1 }, { id: 'c', fotos: 3 },
    ], { total: 8, porSetor: 2 })
    expect(cota.a).toBeGreaterThanOrEqual(1)
    expect(cota.b).toBeGreaterThanOrEqual(1)
    expect(cota.c).toBeGreaterThanOrEqual(1)
  })

  it('nunca passa do total nem do teto por setor', () => {
    const cota = orcamentoDeFotos([
      { id: 'a', fotos: 9 }, { id: 'b', fotos: 9 }, { id: 'c', fotos: 9 },
    ], { total: 4, porSetor: 2 })
    expect(Object.values(cota).reduce((s, n) => s + n, 0)).toBe(4)
    expect(Math.max(...Object.values(cota))).toBeLessThanOrEqual(2)
  })

  // Com muitos setores e pouco espaço, é melhor uma foto de cada do que
  // três de um e nenhuma dos outros.
  it('espalha antes de aprofundar', () => {
    const cota = orcamentoDeFotos([
      { id: 'a', fotos: 4 }, { id: 'b', fotos: 4 }, { id: 'c', fotos: 4 },
    ], { total: 3, porSetor: 2 })
    expect(cota).toEqual({ a: 1, b: 1, c: 1 })
  })

  it('não promete foto de setor que não tem', () => {
    const cota = orcamentoDeFotos([{ id: 'a', fotos: 0 }, { id: 'b', fotos: 2 }], { total: 8 })
    expect(cota.a).toBeUndefined()
    expect(cota.b).toBe(2)
  })

  it('não estoura quando ninguém tem foto', () => {
    expect(orcamentoDeFotos([{ id: 'a', fotos: 0 }])).toEqual({})
    expect(orcamentoDeFotos([])).toEqual({})
  })

  it('nunca dá mais foto do que o setor realmente tem', () => {
    const cota = orcamentoDeFotos([{ id: 'a', fotos: 1 }], { total: 8, porSetor: 2 })
    expect(cota.a).toBe(1)
  })
})

describe('numerosDoDia', () => {
  const setores = [
    { id: 's1', nota: 4 },
    { id: 's2', nota: 2 },
    { id: 's3', nota: null, nao_inspecionado: true },
    { id: 's4', nota: null, nao_inspecionado: false },
  ]
  const respostas = {
    s1: [{ resposta: 'parcial' }, { resposta: 'conforme' }],
    s2: [{ resposta: 'nao_conforme' }, { resposta: 'parcial' }],
  }

  it('conta cada situação no seu lugar', () => {
    const n = numerosDoDia(setores, respostas)
    expect(n).toMatchObject({ previstos: 4, avaliados: 2, naoVisitados: 1, semRegistro: 1, ressalvas: 3 })
  })

  it('a média ignora quem não tem nota', () => {
    expect(numerosDoDia(setores, respostas).notaMedia).toBe(3)
  })

  // Dia sem nenhuma avaliação não teve média zero: não teve média.
  it('devolve média vazia quando ninguém foi avaliado', () => {
    expect(numerosDoDia([{ id: 'x', nota: null }], {}).notaMedia).toBeNull()
  })
})

describe('a redação do resumo', () => {
  // "1 não puderam ser visitados" num documento que vai pra reunião
  // estraga a impressão do relatório inteiro — e um setor só é comum.
  it('concorda no singular', () => {
    const f = fraseDoResumo({ previstos: 3, avaliados: 1, naoVisitados: 1, semRegistro: 1 })
    expect(f).toContain('1 foi avaliado')
    expect(f).toContain('1 não pôde ser visitado')
    expect(f).toContain('1 ficou sem registro')
    expect(f).not.toContain('puderam')
  })

  it('concorda no plural', () => {
    const f = fraseDoResumo({ previstos: 9, avaliados: 7, naoVisitados: 2, semRegistro: 3 })
    expect(f).toContain('7 foram avaliados')
    expect(f).toContain('2 não puderam ser visitados')
    expect(f).toContain('3 ficaram sem registro')
  })

  it('não cita o que não aconteceu', () => {
    const f = fraseDoResumo({ previstos: 4, avaliados: 4, naoVisitados: 0, semRegistro: 0 })
    expect(f).toBe('Dos 4 setores previstos no roteiro, 4 foram avaliados.')
  })

  it('aguenta o roteiro de um setor só', () => {
    expect(fraseDoResumo({ previstos: 1, avaliados: 1, naoVisitados: 0, semRegistro: 0 }))
      .toBe('Do único setor previsto no roteiro, 1 foi avaliado.')
  })
})

describe('fraseDaNotaMedia', () => {
  it('escreve com vírgula, como se lê em português', () => {
    expect(fraseDaNotaMedia(3.85)).toBe('Nota média: 3,9 de 5.')
  })

  // Dia sem avaliação não teve nota zero: não teve nota.
  it('não inventa zero quando ninguém foi avaliado', () => {
    expect(fraseDaNotaMedia(null)).toMatch(/nenhum setor chegou a ser avaliado/)
  })
})

describe('fraseDasRessalvas', () => {
  it('conjuga conforme a quantidade', () => {
    expect(fraseDasRessalvas(1)).toContain('Foi apontada 1 ressalva')
    expect(fraseDasRessalvas(4)).toContain('Foram apontadas 4 ressalvas')
    expect(fraseDasRessalvas(0)).toMatch(/Nenhuma ressalva/)
  })
})

describe('fraseFotosRestantes', () => {
  it('avisa o que ficou de fora, no singular e no plural', () => {
    expect(fraseFotosRestantes(1, true)).toBe('Mais 1 foto deste setor está no sistema.')
    expect(fraseFotosRestantes(3, true)).toBe('Mais 3 fotos deste setor estão no sistema.')
  })

  it('muda o texto quando nenhuma foto coube', () => {
    expect(fraseFotosRestantes(2, false)).toMatch(/2 fotos deste setor estão no sistema — não couberam/)
    expect(fraseFotosRestantes(1, false)).toMatch(/não coube/)
  })

  it('cala a boca quando coube tudo', () => {
    expect(fraseFotosRestantes(0, true)).toBeNull()
  })
})
