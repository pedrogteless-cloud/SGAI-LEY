import { describe, it, expect } from 'vitest'
import {
  diaDe, passaNoFiltro, aplicarFiltros, agregar, agruparPorCampo,
  inicioDoBalde, serieNoTempo, validarBloco, camposDoBloco,
} from './painelDados'

describe('diaDe', () => {
  it('deixa data pura passar sem converter', () => {
    // O bug clássico: "2026-09-13" vira meia-noite UTC e, em Fortaleza,
    // é mostrado como dia 12.
    expect(diaDe('2026-09-13')).toBe('2026-09-13')
  })

  it('converte data com hora pro fuso da fábrica', () => {
    // 2026-09-14T01:00Z é ainda dia 13 em Fortaleza (UTC-3).
    expect(diaDe('2026-09-14T01:00:00Z')).toBe('2026-09-13')
  })

  it('devolve nulo pra valor ausente', () => {
    expect(diaDe(null)).toBeNull()
    expect(diaDe('')).toBeNull()
  })
})

describe('passaNoFiltro', () => {
  const linha = { setor: 'Corte', custo: 150, obs: null, parada: true }

  it('compara texto e número pelo tipo certo', () => {
    expect(passaNoFiltro(linha, { campo: 'setor', comparador: 'igual', valor: 'Corte' })).toBe(true)
    expect(passaNoFiltro(linha, { campo: 'custo', comparador: 'maior', valor: '100' })).toBe(true)
    expect(passaNoFiltro(linha, { campo: 'custo', comparador: 'maior', valor: '200' })).toBe(false)
  })

  it('entende vazio e preenchido', () => {
    expect(passaNoFiltro(linha, { campo: 'obs', comparador: 'vazio' })).toBe(true)
    expect(passaNoFiltro(linha, { campo: 'obs', comparador: 'preenchido' })).toBe(false)
    expect(passaNoFiltro(linha, { campo: 'setor', comparador: 'preenchido' })).toBe(true)
  })

  // "custo maior que 100" não pode incluir a OS que ainda não tem custo:
  // sem valor não é zero, é desconhecido.
  it('não deixa linha sem valor entrar numa comparação de conteúdo', () => {
    expect(passaNoFiltro({ custo: null }, { campo: 'custo', comparador: 'maior', valor: '-1' })).toBe(false)
    expect(passaNoFiltro({ custo: null }, { campo: 'custo', comparador: 'igual', valor: '0' })).toBe(false)
  })

  it('compara booleano como Sim/Não', () => {
    expect(passaNoFiltro(linha, { campo: 'parada', comparador: 'igual', valor: 'Sim' })).toBe(true)
    expect(passaNoFiltro(linha, { campo: 'parada', comparador: 'igual', valor: 'Não' })).toBe(false)
  })

  it('compara data como texto ISO, sem criar Date', () => {
    const l = { d: '2026-09-13' }
    expect(passaNoFiltro(l, { campo: 'd', comparador: 'maior', valor: '2026-09-02' })).toBe(true)
    expect(passaNoFiltro(l, { campo: 'd', comparador: 'menor', valor: '2026-01-31' })).toBe(false)
  })
})

describe('aplicarFiltros', () => {
  const linhas = [
    { setor: 'Corte', custo: 100 },
    { setor: 'Colagem', custo: 300 },
    { setor: 'Corte', custo: 50 },
  ]

  it('junta os filtros com E, não com OU', () => {
    const r = aplicarFiltros(linhas, [
      { campo: 'setor', comparador: 'igual', valor: 'Corte' },
      { campo: 'custo', comparador: 'maior', valor: '60' },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].custo).toBe(100)
  })

  it('ignora filtro pela metade em vez de zerar a tela', () => {
    expect(aplicarFiltros(linhas, [{ campo: 'setor', comparador: 'igual', valor: '' }])).toHaveLength(3)
    expect(aplicarFiltros(linhas, [{ campo: '', comparador: 'igual', valor: 'x' }])).toHaveLength(3)
  })
})

describe('agregar', () => {
  const linhas = [{ v: 10 }, { v: 20 }, { v: null }, { v: 30 }]

  it('faz as contas ignorando o que está vazio', () => {
    expect(agregar(linhas, 'contar')).toBe(4)
    expect(agregar(linhas, 'somar', 'v')).toBe(60)
    expect(agregar(linhas, 'media', 'v')).toBe(20)
    expect(agregar(linhas, 'minimo', 'v')).toBe(10)
    expect(agregar(linhas, 'maximo', 'v')).toBe(30)
  })

  it('conta valores diferentes sem contar o vazio', () => {
    const l = [{ s: 'a' }, { s: 'b' }, { s: 'a' }, { s: null }, { s: '' }]
    expect(agregar(l, 'contar_distintos', 's')).toBe(2)
  })

  // Um mês sem lançamento nenhum não teve média zero: não teve média.
  // Devolver 0 aqui faria o gráfico afirmar algo que ninguém mediu.
  it('devolve vazio (e não zero) quando não há número pra média', () => {
    expect(agregar([{ v: null }], 'media', 'v')).toBeNull()
    expect(agregar([], 'maximo', 'v')).toBeNull()
    expect(agregar([], 'somar', 'v')).toBe(0)
  })
})

describe('agruparPorCampo', () => {
  const linhas = [
    { setor: 'Corte', custo: 100 },
    { setor: 'Colagem', custo: 300 },
    { setor: 'Corte', custo: 50 },
    { setor: null, custo: 7 },
  ]

  it('agrupa e ordena pelo valor', () => {
    const r = agruparPorCampo(linhas, 'setor', 'somar', 'custo')
    expect(r.map((i) => i.rotulo)).toEqual(['Colagem', 'Corte', '—'])
    expect(r[1].valor).toBe(150)
  })

  it('dá nome ao grupo sem valor em vez de escondê-lo', () => {
    const r = agruparPorCampo(linhas, 'setor', 'contar')
    expect(r.find((i) => i.rotulo === '—').valor).toBe(1)
  })

  it('ordena por rótulo quando pedido', () => {
    const r = agruparPorCampo(linhas, 'setor', 'contar', null, { ordem: 'rotulo' })
    expect(r.map((i) => i.rotulo)).toEqual(['—', 'Colagem', 'Corte'])
  })

  // Cortar o excedente sem avisar faria o gráfico mentir sobre o total.
  it('junta o excedente num "Outros" em vez de sumir com ele', () => {
    // valores 10,9,8…1 — os 3 maiores ficam, os 7 restantes (7+6+5+4+3+2+1)
    // viram uma fatia só, somando 28.
    const muitos = Array.from({ length: 10 }, (_, i) => ({ s: `s${i}`, v: 10 - i }))
    const r = agruparPorCampo(muitos, 's', 'somar', 'v', { limite: 3 })
    expect(r).toHaveLength(4)
    expect(r.slice(0, 3).map((i) => i.valor)).toEqual([10, 9, 8])
    expect(r[3].rotulo).toBe('Outros (7)')
    expect(r[3].valor).toBe(28)
  })

  it('não inventa "outros" quando cabe tudo', () => {
    const r = agruparPorCampo(linhas, 'setor', 'contar', null, { limite: 12 })
    expect(r.some((i) => i.resto)).toBe(false)
  })
})

describe('inicioDoBalde', () => {
  it('agrupa por dia, semana (domingo), mês e ano', () => {
    expect(inicioDoBalde('2026-09-16', 'dia')).toBe('2026-09-16')
    expect(inicioDoBalde('2026-09-16', 'mes')).toBe('2026-09-01')
    expect(inicioDoBalde('2026-09-16', 'ano')).toBe('2026-01-01')
    // 2026-09-16 é quarta; o domingo anterior é 13.
    expect(inicioDoBalde('2026-09-16', 'semana')).toBe('2026-09-13')
  })

  it('deixa o domingo no lugar dele', () => {
    expect(inicioDoBalde('2026-09-13', 'semana')).toBe('2026-09-13')
  })
})

describe('serieNoTempo', () => {
  const linhas = [
    { d: '2026-09-01', v: 2 },
    { d: '2026-09-01', v: 3 },
    { d: '2026-09-04', v: 8 },
  ]

  // Sem preencher o buraco, a linha ligaria 01 a 04 numa reta, como se o
  // valor tivesse caído devagar — quando na verdade não houve nada.
  it('preenche com zero os dias sem dado, quando a conta é soma', () => {
    const s = serieNoTempo(linhas, 'd', 'dia', 'somar', 'v')
    expect(s.map((p) => p.periodo)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'])
    expect(s.map((p) => p.valor)).toEqual([5, 0, 0, 8])
  })

  // Média é diferente: num dia sem medição ninguém mediu nada, então o
  // ponto tem que ser um buraco no gráfico, não um zero.
  it('preenche com vazio quando a conta é média', () => {
    const s = serieNoTempo(linhas, 'd', 'dia', 'media', 'v')
    expect(s[1].valor).toBeNull()
    expect(s[0].valor).toBe(2.5)
  })

  it('agrupa por mês juntando os dias', () => {
    const s = serieNoTempo(
      [{ d: '2026-08-30', v: 1 }, { d: '2026-09-02', v: 2 }, { d: '2026-09-20', v: 3 }],
      'd', 'mes', 'somar', 'v'
    )
    expect(s).toEqual([
      { periodo: '2026-08-01', valor: 1, linhas: 1 },
      { periodo: '2026-09-01', valor: 5, linhas: 2 },
    ])
  })

  it('usa o fuso da fábrica pra decidir o dia de um timestamp', () => {
    // 01:00Z do dia 14 ainda é dia 13 em Fortaleza.
    const s = serieNoTempo([{ d: '2026-09-14T01:00:00Z', v: 1 }], 'd', 'dia', 'contar')
    expect(s[0].periodo).toBe('2026-09-13')
  })

  it('devolve lista vazia sem dado nenhum', () => {
    expect(serieNoTempo([], 'd', 'dia', 'contar')).toEqual([])
    expect(serieNoTempo([{ d: null }], 'd', 'dia', 'contar')).toEqual([])
  })
})

describe('validarBloco — a trava das unidades de medida', () => {
  const base = { tipo: 'numero', fonte: 'residuos', operacao: 'somar', campoValor: 'quantidade' }

  // O erro mais caro do módulo: kg + m³ + unidade dá um total que não
  // existe, e ninguém percebe olhando o cartão.
  it('recusa somar quantidade de resíduo sem separar a unidade', () => {
    const r = validarBloco(base)
    expect(r.ok).toBe(false)
    expect(r.erro).toMatch(/unidades diferentes/)
  })

  it('aceita quando agrupa por unidade de medida', () => {
    expect(validarBloco({ ...base, tipo: 'barras', agruparPor: 'unidade_medida' }).ok).toBe(true)
  })

  it('aceita quando o filtro fixa uma unidade só', () => {
    const r = validarBloco({
      ...base,
      filtros: [{ campo: 'unidade_medida', comparador: 'igual', valor: 'kg' }],
    })
    expect(r.ok).toBe(true)
  })

  it('não aceita um filtro que não fixa de verdade a unidade', () => {
    expect(validarBloco({
      ...base,
      filtros: [{ campo: 'unidade_medida', comparador: 'diferente', valor: 'kg' }],
    }).ok).toBe(false)
    expect(validarBloco({
      ...base,
      filtros: [{ campo: 'unidade_medida', comparador: 'igual', valor: '' }],
    }).ok).toBe(false)
  })

  // Contar linhas não mistura grandeza nenhuma: a trava não vale aqui.
  it('deixa contar resíduo sem exigir unidade', () => {
    expect(validarBloco({ tipo: 'numero', fonte: 'residuos', operacao: 'contar' }).ok).toBe(true)
  })

  it('não exige nada de campo que não tem unidade misturada', () => {
    expect(validarBloco({
      tipo: 'numero', fonte: 'os', operacao: 'somar', campoValor: 'custo_total',
    }).ok).toBe(true)
  })
})

describe('validarBloco — o resto', () => {
  it('texto livre não precisa de fonte', () => {
    expect(validarBloco({ tipo: 'texto' }).ok).toBe(true)
  })

  it('cobra o que falta, com o nome do que falta', () => {
    expect(validarBloco({ tipo: 'numero' }).erro).toMatch(/de onde vêm/)
    expect(validarBloco({ tipo: 'barras', fonte: 'os', operacao: 'contar' }).erro).toMatch(/agrupar/)
    expect(validarBloco({ tipo: 'linha', fonte: 'os', operacao: 'contar' }).erro).toMatch(/eixo do tempo/)
    expect(validarBloco({ tipo: 'lista', fonte: 'os', colunas: [] }).erro).toMatch(/coluna/)
    expect(validarBloco({ tipo: 'numero', fonte: 'os', operacao: 'somar' }).erro).toMatch(/Somar/i)
  })
})

describe('camposDoBloco', () => {
  it('junta tudo que o bloco usa, sem repetir', () => {
    const campos = camposDoBloco({
      tipo: 'barras', fonte: 'os', operacao: 'somar',
      campoValor: 'custo_total', agruparPor: 'setor',
      filtros: [{ campo: 'setor', comparador: 'igual', valor: 'Corte' }, { campo: 'tipo' }],
    })
    expect(campos.sort()).toEqual(['custo_total', 'setor', 'tipo'])
  })

  it('bloco de texto não pede campo nenhum', () => {
    expect(camposDoBloco({ tipo: 'texto' })).toEqual([])
  })
})
