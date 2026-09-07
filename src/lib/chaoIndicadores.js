/**
 * Matemática de período, agregação e metas do módulo de Desperdícios.
 * Fica em arquivo próprio (em vez de espalhado pela tela) porque é a
 * parte que mais precisa ficar correta: nunca somar unidade de medida
 * diferente, nunca contar a mesma etapa duas vezes, nunca comparar
 * período com período de tamanho diferente.
 */

const isoData = (d) => d.toISOString().slice(0, 10)
const somarDias = (d, n) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export const PERIODOS = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7dias', rotulo: 'Últimos 7 dias' },
  { valor: 'semana', rotulo: 'Semana atual' },
  { valor: 'mes', rotulo: 'Mês atual' },
  { valor: 'ano', rotulo: 'Ano atual' },
  { valor: 'personalizado', rotulo: 'Período personalizado' },
]

/**
 * Devolve início/fim do período escolhido e, do mesmo tamanho, o período
 * imediatamente anterior — pra comparação nunca comparar 7 dias com 31.
 */
export function limitesPeriodo(chave, personalizado = {}) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  let inicio = hoje
  let fim = hoje

  if (chave === 'hoje') {
    inicio = hoje
    fim = hoje
  } else if (chave === '7dias') {
    inicio = somarDias(hoje, -6)
    fim = hoje
  } else if (chave === 'semana') {
    inicio = somarDias(hoje, -hoje.getDay())
    fim = hoje
  } else if (chave === 'mes') {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    fim = hoje
  } else if (chave === 'ano') {
    inicio = new Date(hoje.getFullYear(), 0, 1)
    fim = hoje
  } else if (chave === 'personalizado') {
    inicio = personalizado.inicio ? new Date(`${personalizado.inicio}T00:00:00`) : hoje
    fim = personalizado.fim ? new Date(`${personalizado.fim}T00:00:00`) : hoje
  }

  const dias = Math.max(1, Math.round((fim - inicio) / 86400000) + 1)
  const fimAnterior = somarDias(inicio, -1)
  const inicioAnterior = somarDias(fimAnterior, -(dias - 1))

  return {
    inicio: isoData(inicio),
    fim: isoData(fim),
    inicioAnterior: isoData(inicioAnterior),
    fimAnterior: isoData(fimAnterior),
  }
}

/**
 * "Achatar" cada lançamento nas suas medições — dali pra frente todo
 * agrupamento soma só dentro do mesmo (material, unidade_medida), igual
 * a view de saldo faz no banco. É o jeito de nunca somar kg com m³.
 */
export function achatarLancamentos(lancamentos) {
  const linhas = []
  for (const l of lancamentos || []) {
    for (const m of l.medicoes || []) {
      if (!(Number(m.quantidade) > 0)) continue
      linhas.push({
        material_id: l.material_id,
        material_nome: l.material_nome,
        unidade_medida: m.unidade_medida,
        quantidade: Number(m.quantidade),
        tipo_movimentacao: l.tipo_movimentacao,
        origem: l.origem,
        setor_id: l.setor_id,
        setor_nome: l.setor_nome,
        quadrante: l.quadrante,
        relatorio_data: l.relatorio_data,
      })
    }
  }
  return linhas
}

const somaPor = (linhas, chave, filtro = () => true) => {
  const acc = {}
  for (const l of linhas) {
    if (!filtro(l)) continue
    const k = chave(l)
    if (k == null) continue
    acc[k] = (acc[k] || 0) + l.quantidade
  }
  return acc
}

const topDe = (mapa, n = 5) =>
  Object.entries(mapa)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([chave, valor]) => ({ chave, valor }))

/** Indicadores de desperdício/reaproveitamento de um período já achatado. */
export function agregarPeriodo(linhas) {
  const geracao = linhas.filter((l) => l.tipo_movimentacao === 'geracao')
  const naoGeracao = linhas.filter((l) => l.tipo_movimentacao !== 'geracao')

  const geradoPorMaterialUnidade = {}
  for (const l of geracao) {
    const k = `${l.material_nome} (${l.unidade_medida})`
    geradoPorMaterialUnidade[k] = (geradoPorMaterialUnidade[k] || 0) + l.quantidade
  }

  return {
    totalLinhas: linhas.length,
    geradoPorMaterial: topDe(somaPor(geracao, (l) => l.material_nome), 8),
    geradoPorOrigem: topDe(somaPor(geracao, (l) => l.origem || 'não informado'), 8),
    geradoPorSetor: topDe(somaPor(geracao, (l) => l.setor_nome || 'sem setor'), 8),
    geradoPorQuadrante: topDe(somaPor(geracao, (l) => l.quadrante || 'sem quadrante'), 8),
    materialMaiorGeracao: topDe(somaPor(geracao, (l) => l.material_nome), 1)[0] || null,
    setorMaiorGeracao: topDe(somaPor(geracao, (l) => l.setor_nome || 'sem setor'), 1)[0] || null,
    descartado: sumTipo(naoGeracao, 'descarte'),
    enviadoMoagem: sumTipo(naoGeracao, 'enviado_moagem'),
    identificadoReaproveitavel: sumTipo(naoGeracao, 'identificado_reaproveitavel'),
    separado: sumTipo(naoGeracao, 'separado'),
    moido: sumTipo(naoGeracao, 'moido'),
    reutilizadoInterno: sumTipo(naoGeracao, 'reutilizacao_interna'),
    vendidoReciclado: sumTipo(naoGeracao, 'venda_reciclagem'),
    geradoTotalKg: somaUnidade(geracao, 'kg'),
    quadrantesDistintos: [...new Set(linhas.map((l) => l.quadrante).filter(Boolean))].sort(),
  }
}

// soma só a unidade pedida — o "total" que aparece nos cartões do topo é
// sempre em kg (a mais comum), sem fingir que dá pra somar as outras junto.
function somaUnidade(linhas, unidade) {
  return linhas.filter((l) => l.unidade_medida === unidade).reduce((acc, l) => acc + l.quantidade, 0)
}

function sumTipo(linhas, tipo) {
  return linhas.filter((l) => l.tipo_movimentacao === tipo).reduce((acc, l) => acc + l.quantidade, 0)
}

/** Índice de destinação útil = útil / (útil + descarte) × 100. */
export function indiceDestinacaoUtil({ reutilizadoInterno, vendidoReciclado, descartado }) {
  const util = reutilizadoInterno + vendidoReciclado
  const base = util + descartado
  return base > 0 ? (util / base) * 100 : null
}

export function variacaoPercentual(atual, anterior) {
  if (!(anterior > 0)) return null
  return ((atual - anterior) / anterior) * 100
}

/** Nota média, ignorando "não inspecionado" — nunca mistura os dois. */
export function notaMediaDe(avaliacoes) {
  const validas = (avaliacoes || []).filter((a) => a.nota != null)
  if (!validas.length) return null
  return validas.reduce((acc, a) => acc + Number(a.nota), 0) / validas.length
}

export function agregarLimpeza(avaliacoes) {
  const lista = avaliacoes || []
  const validas = lista.filter((a) => a.nota != null)
  const porSetor = {}
  for (const a of validas) {
    porSetor[a.setor_nome] ??= []
    porSetor[a.setor_nome].push(Number(a.nota))
  }
  const mediaPorSetor = Object.entries(porSetor)
    .map(([setor, notas]) => ({ setor, media: notas.reduce((s, n) => s + n, 0) / notas.length, n: notas.length }))
    .sort((a, b) => a.media - b.media)

  return {
    notaMedia: notaMediaDe(lista),
    mediaPorSetor,
    setoresNota12: validas.filter((a) => a.nota <= 2),
    pctInspecionados: lista.length ? ((validas.length + lista.filter((a) => a.nao_inspecionado).length) / lista.length) * 100 : null,
    totalAvaliacoes: lista.length,
  }
}

/**
 * Insights descritivos e calculados — nunca atribuindo causa, só
 * contando o que os números mostram.
 */
export function gerarInsights({ atual, anterior, limpezaAtual, limpezaAnterior, relatorios }) {
  const frases = []

  const variacaoGeral = variacaoPercentual(atual.geradoTotalKg, anterior.geradoTotalKg)
  if (variacaoGeral != null && Math.abs(variacaoGeral) >= 1) {
    frases.push(
      `A geração de resíduos (em kg) ${variacaoGeral >= 0 ? 'aumentou' : 'caiu'} ${Math.abs(variacaoGeral).toFixed(0)}% em relação ao período anterior.`
    )
  }

  if (atual.materialMaiorGeracao) {
    frases.push(`${atual.materialMaiorGeracao.chave} foi o material com maior geração no período.`)
  }
  if (atual.setorMaiorGeracao) {
    frases.push(`O setor "${atual.setorMaiorGeracao.chave}" concentrou a maior geração de resíduos no período.`)
  }
  if (atual.geradoPorQuadrante[0]) {
    frases.push(`O quadrante ${atual.geradoPorQuadrante[0].chave} concentrou o maior número de ocorrências no período.`)
  }

  if (atual.enviadoMoagem > 0) {
    const naoUtilizado = atual.enviadoMoagem - atual.moido - atual.reutilizadoInterno
    if (naoUtilizado > 0) {
      frases.push(
        `Há aproximadamente ${naoUtilizado.toFixed(0)} kg enviados para moagem que ainda não aparecem como reutilizados.`
      )
    }
  }

  if (limpezaAtual?.notaMedia != null && limpezaAnterior?.notaMedia != null) {
    const diff = limpezaAtual.notaMedia - limpezaAnterior.notaMedia
    if (Math.abs(diff) >= 0.3) {
      frases.push(
        `A nota média de limpeza ${diff >= 0 ? 'subiu' : 'caiu'} de ${limpezaAnterior.notaMedia.toFixed(1)} para ${limpezaAtual.notaMedia.toFixed(1)}.`
      )
    }
  }
  if (limpezaAtual?.mediaPorSetor?.length && limpezaAtual.mediaPorSetor[0].media <= 2.5) {
    frases.push(`O setor "${limpezaAtual.mediaPorSetor[0].setor}" está com nota de limpeza baixa (${limpezaAtual.mediaPorSetor[0].media.toFixed(1)}).`)
  }

  const atrasados = (relatorios || []).filter(
    (r) => r.status !== 'concluida' && r.status !== 'cancelada' && r.data < isoData(new Date())
  )
  if (atrasados.length > 0) {
    frases.push(`${atrasados.length} relatório(s) ficaram em aberto além do dia em que foram criados.`)
  }

  return frases
}

/* ------------------------------------------------------------- metas */

/**
 * Calcula o "realizado" de uma meta a partir dos dados já agregados do
 * período dela. Cobre os indicadores mais diretos; os que dependem de
 * produção (kg/100 colchões, índice de perda) ficam sem valor quando não
 * há registro de produção no período — nunca inventa proxy.
 */
export function calcularRealizadoMeta(meta, { linhasAchatadas, avaliacoes, relatorios }) {
  const porMaterial = (l) => !meta.material_id || l.material_id === meta.material_id
  const porSetor = (l) => !meta.setor_id || l.setor_id === meta.setor_id
  const porQuadrante = (l) => !meta.quadrante || l.quadrante === meta.quadrante
  const filtroComum = (l) => porMaterial(l) && porSetor(l) && porQuadrante(l)

  const geracao = linhasAchatadas.filter((l) => l.tipo_movimentacao === 'geracao' && filtroComum(l))
  const descarte = linhasAchatadas.filter((l) => l.tipo_movimentacao === 'descarte' && filtroComum(l))
  const reutilizado = linhasAchatadas.filter((l) => l.tipo_movimentacao === 'reutilizacao_interna' && filtroComum(l))
  const vendido = linhasAchatadas.filter((l) => l.tipo_movimentacao === 'venda_reciclagem' && filtroComum(l))

  const somaKg = (arr) => arr.filter((l) => l.unidade_medida === 'kg').reduce((a, l) => a + l.quantidade, 0)

  switch (meta.indicador) {
    case 'max_residuo_material':
    case 'max_residuo_setor':
      return { valor: somaKg(geracao), unidade: 'kg', sentido: 'max' }

    case 'max_descarte':
      return { valor: somaKg(descarte), unidade: 'kg', sentido: 'max' }

    case 'max_ocorrencias_quadrante': {
      const porQ = somaPor(geracao, (l) => l.quadrante || 'sem quadrante')
      const maior = Math.max(0, ...Object.values(porQ))
      return { valor: maior, unidade: 'ocorrências', sentido: 'max' }
    }

    case 'min_destinacao_util': {
      const util = somaKg(reutilizado) + somaKg(vendido)
      const base = util + somaKg(descarte)
      return { valor: base > 0 ? (util / base) * 100 : null, unidade: '%', sentido: 'min' }
    }

    case 'min_reaproveitamento_concluido':
      return { valor: somaKg(reutilizado), unidade: 'kg', sentido: 'min' }

    case 'min_nota_limpeza': {
      const filtradas = (avaliacoes || []).filter((a) => !meta.setor_id || a.setor_id === meta.setor_id)
      return { valor: notaMediaDe(filtradas), unidade: 'nota', sentido: 'min' }
    }

    case 'nenhum_setor_nota_1': {
      const comNota1 = (avaliacoes || []).filter((a) => a.nota === 1 && (!meta.setor_id || a.setor_id === meta.setor_id))
      return { valor: comNota1.length, unidade: 'setor(es) com nota 1', sentido: 'max', alvoForcado: 0 }
    }

    case 'pct_min_setores_inspecionados': {
      const lista = avaliacoes || []
      const inspecionados = lista.filter((a) => a.nota != null || a.nao_inspecionado).length
      return { valor: lista.length ? (inspecionados / lista.length) * 100 : null, unidade: '%', sentido: 'min' }
    }

    case 'pct_min_relatorios_no_prazo': {
      const lista = relatorios || []
      const concluidos = lista.filter((r) => r.status === 'concluida')
      if (!concluidos.length) return { valor: null, unidade: '%', sentido: 'min' }
      const noPrazo = concluidos.filter((r) => {
        if (!r.horario_previsto || !r.concluida_em) return true
        const previsto = new Date(`${r.data}T${r.horario_previsto}`)
        return new Date(r.concluida_em) <= previsto
      })
      return { valor: (noPrazo.length / concluidos.length) * 100, unidade: '%', sentido: 'min' }
    }

    case 'max_kg_por_100_colchoes':
    case 'max_indice_perda':
      // depende de registro de produção do período — sem dado, sem cálculo
      return { valor: null, unidade: meta.indicador === 'max_indice_perda' ? '%' : 'kg/100 colchões', sentido: 'max', semDados: true }

    case 'reducao_percentual':
      // comparação com o período-base fica pra quando houver período-base
      // definido e dados de dois períodos — sinalizado como sem dado por
      // enquanto pra não inventar número.
      return { valor: null, unidade: '%', sentido: 'min', semDados: true }

    default:
      return { valor: null, unidade: '', sentido: 'min', semDados: true }
  }
}

/** Situação da meta a partir do realizado: dentro / atenção / fora. */
export function situacaoMeta(realizado, meta) {
  if (realizado.valor == null) return 'sem_dado'
  const alvo = realizado.alvoForcado ?? Number(meta.valor_alvo)
  const pct = alvo > 0 ? (realizado.valor / alvo) * 100 : realizado.valor === 0 ? 0 : 100
  if (realizado.sentido === 'max') {
    if (realizado.valor <= alvo) return 'dentro'
    if (realizado.valor <= alvo * 1.15) return 'atencao'
    return 'fora'
  }
  // sentido "min": quanto maior, melhor
  if (realizado.valor >= alvo) return 'dentro'
  if (realizado.valor >= alvo * 0.85) return 'atencao'
  return 'fora'
}
