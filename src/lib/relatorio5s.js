import { ITENS_5S, M_RESPOSTA_5S, labelDaNota5s } from './constants'

/**
 * O texto do relatório do 5S em Word.
 *
 * Separado da montagem do .docx porque é a parte que decide o que o
 * documento AFIRMA — e afirmação errada num relatório assinado é pior do
 * que relatório nenhum. A montagem (fonte, margem, imagem) fica em
 * relatorio5sWord.js e não precisa de teste; isto aqui precisa.
 */

const DIAS = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
]

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/**
 * Dia da semana a partir da data pura, sem passar por fuso nenhum.
 *
 * `new Date('2026-09-22')` é meia-noite UTC e, em Fortaleza, volta como
 * dia 21 — o relatório sairia com o dia da semana errado. Date.UTC
 * resolve porque aqui só interessa a aritmética de calendário.
 */
export function diaDaSemana(iso) {
  if (!iso) return null
  const [ano, mes, dia] = iso.split('-').map(Number)
  return DIAS[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()]
}

/**
 * Dia da semana curto e em caixa alta pro destaque do cabeçalho:
 * "QUARTA", "SÁBADO". O "-feira" sai porque ali o tamanho da letra é
 * que chama atenção, e a data completa vem logo embaixo.
 */
export function diaCurto(iso) {
  const dia = diaDaSemana(iso)
  return dia ? dia.split('-')[0].toUpperCase() : null
}

/** "22 de setembro de 2026 (terça-feira)" */
export function dataPorExtenso(iso) {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-').map(Number)
  return `${dia} de ${MESES[mes - 1]} de ${ano} (${diaDaSemana(iso)})`
}

/** Só a hora de um timestamp, no fuso da fábrica. */
export function horaDe(instante) {
  if (!instante) return null
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit',
  }).format(new Date(instante))
}

/** O que o documento chama de situação do setor. */
export function situacaoDoSetor(setor) {
  if (setor?.nao_inspecionado) return 'nao_visitado'
  if (setor?.nota == null) return 'nao_avaliado'
  return 'avaliado'
}

/**
 * O resumo do setor escrito como frase, não como tabela.
 *
 * Um relatório que só empilha "seiri: parcial" obriga quem lê a traduzir
 * de cabeça. Aqui sai o que a pessoa diria em voz alta.
 */
export function resumoDoSetor(setor, respostas) {
  if (situacaoDoSetor(setor) === 'nao_visitado') {
    const motivo = (setor.justificativa_nao_inspecionado || '').trim()
    return motivo ? `Não foi possível visitar o setor. Motivo: ${motivo}` : 'Não foi possível visitar o setor.'
  }
  if (situacaoDoSetor(setor) === 'nao_avaliado') {
    return 'Setor previsto no roteiro do dia, mas ainda sem avaliação registrada.'
  }

  const respondidas = (respostas || []).filter((r) => r.resposta && r.resposta !== 'nao_inspecionado')
  if (!respondidas.length) {
    return 'Setor visitado, mas nenhum dos cinco pontos pôde ser julgado.'
  }

  const comRessalva = respondidas.filter((r) => ['parcial', 'nao_conforme'].includes(r.resposta))
  if (!comRessalva.length) {
    return `Os cinco pontos do 5S foram considerados conformes. Nota ${fmtNota(setor.nota)} — ${labelDaNota5s(setor.nota)}.`
  }

  const partes = comRessalva.map((r) => {
    const titulo = ITENS_5S.find((i) => i.item === r.item)?.titulo || r.item
    const grau = M_RESPOSTA_5S[r.resposta]?.label?.toLowerCase() || r.resposta
    const problema = (r.descricao_problema || '').trim()
    const onde = (r.quadrante || '').trim()
    return `${titulo} (${grau})${onde ? `, no quadrante ${onde}` : ''}${problema ? `: ${problema}` : ''}`
  })

  const plural = comRessalva.length > 1 ? 'ressalvas' : 'ressalva'
  return `Nota ${fmtNota(setor.nota)} — ${labelDaNota5s(setor.nota)}. ${comRessalva.length} ${plural}: ${partes.join('; ')}.`
}

const fmtNota = (n) => (n == null ? '—' : Number(n).toFixed(1).replace('.', ','))

/** O que foi sugerido fazer, juntado numa linha só. */
export function sugestoesDoSetor(respostas) {
  const sugestoes = (respostas || [])
    .filter((r) => ['parcial', 'nao_conforme'].includes(r.resposta) && (r.sugestao || '').trim())
    .map((r) => r.sugestao.trim())
  return sugestoes.length ? sugestoes.join('; ') : null
}

/**
 * Quantas fotos cada setor pode levar, pra caber no teto de páginas.
 *
 * O pedido é "no máximo três páginas". Foto é o que estoura isso: cada
 * par lado a lado come mais ou menos um quarto de página. Em vez de
 * cortar no susto e deixar o documento mentir por omissão, a divisão é
 * feita aqui — proporcional a quem tem foto, no mínimo uma pra cada
 * enquanto couber — e o que não coube é declarado no texto.
 */
export function orcamentoDeFotos(setoresComFotos, { total = 8, porSetor = 2 } = {}) {
  const comFoto = (setoresComFotos || []).filter((s) => s.fotos > 0)
  if (!comFoto.length) return {}

  const cota = {}
  let restante = total

  // Primeira passada: uma foto pra cada setor que tem, enquanto der.
  for (const s of comFoto) {
    if (restante <= 0) break
    cota[s.id] = 1
    restante -= 1
  }
  // Segunda passada: quem tem mais foto ganha a sobra, até o teto.
  const porMais = [...comFoto].sort((a, b) => b.fotos - a.fotos)
  let mexeu = true
  while (restante > 0 && mexeu) {
    mexeu = false
    for (const s of porMais) {
      if (restante <= 0) break
      const atual = cota[s.id] || 0
      if (atual < Math.min(porSetor, s.fotos)) {
        cota[s.id] = atual + 1
        restante -= 1
        mexeu = true
      }
    }
  }
  return cota
}

/** Os números que abrem o documento. */
export function numerosDoDia(setores, respostasPorSetor) {
  const lista = setores || []
  const avaliados = lista.filter((s) => situacaoDoSetor(s) === 'avaliado')
  const naoVisitados = lista.filter((s) => situacaoDoSetor(s) === 'nao_visitado')
  const notas = avaliados.map((s) => Number(s.nota)).filter((n) => Number.isFinite(n))

  let ressalvas = 0
  for (const s of avaliados) {
    ressalvas += (respostasPorSetor?.[s.id] || []).filter(
      (r) => ['parcial', 'nao_conforme'].includes(r.resposta)
    ).length
  }

  return {
    previstos: lista.length,
    avaliados: avaliados.length,
    naoVisitados: naoVisitados.length,
    semRegistro: lista.length - avaliados.length - naoVisitados.length,
    notaMedia: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null,
    ressalvas,
  }
}

/* ------------------------------------------------------------- redação */

/**
 * As frases do resumo, escritas com concordância de verdade.
 *
 * "1 não puderam ser visitados" num relatório que vai pra reunião
 * estraga a impressão do documento inteiro — e o caso de um setor só é
 * comum, não excepcional.
 */
export function fraseDoResumo(n) {
  const cabeca = n.previstos === 1
    ? 'Do único setor previsto no roteiro'
    : `Dos ${n.previstos} setores previstos no roteiro`

  const partes = [
    `${cabeca}, ${n.avaliados === 1 ? '1 foi avaliado' : `${n.avaliados} foram avaliados`}`,
  ]
  if (n.naoVisitados) {
    partes.push(n.naoVisitados === 1 ? '1 não pôde ser visitado' : `${n.naoVisitados} não puderam ser visitados`)
  }
  if (n.semRegistro) {
    partes.push(n.semRegistro === 1 ? '1 ficou sem registro' : `${n.semRegistro} ficaram sem registro`)
  }
  return `${partes.join(', ')}.`
}

export function fraseDaNotaMedia(notaMedia) {
  return notaMedia == null
    ? 'Sem nota média: nenhum setor chegou a ser avaliado.'
    : `Nota média: ${notaMedia.toFixed(1).replace('.', ',')} de 5.`
}

export function fraseDasRessalvas(quantas) {
  if (!quantas) return 'Nenhuma ressalva foi apontada nos pontos avaliados do 5S.'
  return quantas === 1
    ? 'Foi apontada 1 ressalva nos pontos do 5S. O detalhe de cada setor vem a seguir.'
    : `Foram apontadas ${quantas} ressalvas nos pontos do 5S. O detalhe de cada setor vem a seguir.`
}

/** O aviso do que não coube — nunca sumir com foto calado. */
export function fraseFotosRestantes(quantas, mostrouAlguma) {
  if (quantas <= 0) return null
  const fotos = quantas === 1 ? '1 foto' : `${quantas} fotos`
  const verbo = quantas === 1 ? 'está' : 'estão'
  return mostrouAlguma
    ? `Mais ${fotos} deste setor ${verbo} no sistema.`
    : `${fotos} deste setor ${verbo} no sistema — não ${quantas === 1 ? 'coube' : 'couberam'} nesta página.`
}
