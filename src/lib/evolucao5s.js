import { ITENS_5S } from './constants'

/**
 * Leitura da evolução do 5S na fase de aprendizado.
 *
 * Tudo aqui é descritivo de propósito. O combinado com a fábrica pras
 * primeiras semanas é claro: sem ranking e sem cobrança por meta — o
 * primeiro objetivo é o encarregado aprender a observar o setor sempre do
 * mesmo jeito, não o setor tirar nota alta. Nota alta cedo demais só
 * ensina a preencher bonito.
 *
 * Então: nada de ordenar setor por nota, nada de "melhor" e "pior", nada
 * de comparar setor com setor. O que se mede primeiro é se a observação
 * está acontecendo, e o que se mostra é cada setor com ele mesmo ao
 * longo do tempo.
 */

/**
 * O indicador que realmente importa agora: quanto do que era pra ser
 * olhado foi olhado.
 *
 * Um setor "não visitado" com justificativa não conta como observado —
 * a justificativa explica a ausência, não substitui a visita. Mas conta
 * como registrado, e a diferença entre os dois números é o que mostra se
 * o problema é falta de tempo ou falta de hábito.
 */
export function consistenciaDaObservacao(avaliacoes) {
  const lista = avaliacoes || []
  const observados = lista.filter((a) => a.nota != null)
  const justificados = lista.filter((a) => a.nao_inspecionado)
  const semRegistro = lista.length - observados.length - justificados.length

  const dias = new Set(lista.map((a) => a.relatorio_data))
  const diasComObservacao = new Set(observados.map((a) => a.relatorio_data))

  return {
    previstos: lista.length,
    observados: observados.length,
    justificados: justificados.length,
    // Nem nota nem justificativa: o setor estava na lista do dia e
    // ninguém disse nada sobre ele. É o número que some primeiro quando
    // o hábito pega.
    semRegistro: Math.max(0, semRegistro),
    pctObservado: lista.length ? (observados.length / lista.length) * 100 : null,
    diasComRelatorio: dias.size,
    diasComObservacao: diasComObservacao.size,
  }
}

/** Quantos setores foram observados em cada dia, do mais antigo pro mais novo. */
export function observacaoPorDia(avaliacoes) {
  const porDia = new Map()
  for (const a of avaliacoes || []) {
    const dia = a.relatorio_data
    if (!dia) continue
    const linha = porDia.get(dia) || { data: dia, observados: 0, justificados: 0, semRegistro: 0 }
    if (a.nota != null) linha.observados += 1
    else if (a.nao_inspecionado) linha.justificados += 1
    else linha.semRegistro += 1
    porDia.set(dia, linha)
  }
  return [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data))
}

/**
 * A linha de cada setor com ele mesmo — nunca a de um contra a do outro.
 * Ordem alfabética justamente pra lista nenhuma virar classificação.
 */
export function serieDeCadaSetor(avaliacoes) {
  const porSetor = new Map()
  for (const a of avaliacoes || []) {
    if (a.nota == null) continue
    const nome = a.setor_nome || '—'
    const linha = porSetor.get(nome) || { setor: nome, pontos: [] }
    linha.pontos.push({ data: a.relatorio_data, nota: Number(a.nota) })
    porSetor.set(nome, linha)
  }

  return [...porSetor.values()]
    .map((linha) => {
      const pontos = [...linha.pontos].sort((a, b) => a.data.localeCompare(b.data))
      const notas = pontos.map((p) => p.nota)
      return {
        setor: linha.setor,
        pontos,
        observacoes: pontos.length,
        media: notas.reduce((s, n) => s + n, 0) / notas.length,
        primeira: notas[0],
        ultima: notas[notas.length - 1],
        menor: Math.min(...notas),
        maior: Math.max(...notas),
      }
    })
    .sort((a, b) => a.setor.localeCompare(b.setor, 'pt-BR'))
}

/**
 * Onde a observação mais engancha, na ordem fixa dos 5S.
 *
 * A ordem é a do método, não a da frequência: uma lista ordenada por
 * "qual S tem mais problema" vira placar, e o que interessa aqui é
 * enxergar em qual etapa vale reforçar o combinado com o pessoal.
 */
export function ressalvasPorItem(respostas) {
  const contagem = Object.fromEntries(
    ITENS_5S.map((i) => [i.item, { item: i.item, titulo: i.titulo, conforme: 0, parcial: 0, naoConforme: 0, respondidas: 0 }])
  )
  for (const r of respostas || []) {
    const linha = contagem[r.item]
    if (!linha) continue
    if (r.resposta === 'conforme') linha.conforme += 1
    else if (r.resposta === 'parcial') linha.parcial += 1
    else if (r.resposta === 'nao_conforme') linha.naoConforme += 1
    else continue // não inspecionado não entra: não foi julgado
    linha.respondidas += 1
  }
  return ITENS_5S.map((i) => {
    const c = contagem[i.item]
    return {
      ...c,
      comRessalva: c.parcial + c.naoConforme,
      pctComRessalva: c.respondidas ? ((c.parcial + c.naoConforme) / c.respondidas) * 100 : null,
    }
  })
}

/**
 * O mesmo item, no mesmo setor, apontado em mais de um dia.
 *
 * Isto não é nota de ninguém: é a lista do que não foi resolvido entre
 * uma visita e outra — exatamente o que alimenta o plano de ação. Por
 * isso aqui a ordem é por quantas vezes voltou.
 */
export function problemasQueVoltaram(respostas, { minimo = 2 } = {}) {
  const grupos = new Map()
  for (const r of respostas || []) {
    if (r.resposta !== 'parcial' && r.resposta !== 'nao_conforme') continue
    const chave = `${r.setor_nome || '—'}|${r.item}`
    const g = grupos.get(chave) || {
      setor: r.setor_nome || '—',
      item: r.item,
      titulo: ITENS_5S.find((i) => i.item === r.item)?.titulo || r.item,
      dias: new Set(),
      ultimaDescricao: null,
      ultimaData: null,
    }
    if (r.relatorio_data) g.dias.add(r.relatorio_data)
    if (!g.ultimaData || (r.relatorio_data || '') >= g.ultimaData) {
      g.ultimaData = r.relatorio_data
      g.ultimaDescricao = r.descricao_problema || null
    }
    grupos.set(chave, g)
  }

  return [...grupos.values()]
    .map((g) => ({ ...g, vezes: g.dias.size, dias: [...g.dias].sort() }))
    .filter((g) => g.vezes >= minimo)
    .sort((a, b) => b.vezes - a.vezes || a.setor.localeCompare(b.setor, 'pt-BR'))
}
