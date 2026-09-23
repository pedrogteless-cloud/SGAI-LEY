import { campoDe } from './painelFontes'
import { dataISOEm } from './tempo'

/**
 * As contas do construtor de painéis: filtrar, agrupar e agregar.
 *
 * Fica separado da tela porque é o pedaço que, se errar, erra calado — um
 * gráfico bonito com o número errado é pior do que gráfico nenhum, porque
 * alguém decide em cima dele. Tudo aqui é função pura, testada em
 * painelDados.test.js.
 *
 * A regra mais importante do arquivo: nunca somar grandeza de unidade
 * diferente. No módulo de resíduos o mesmo material aparece em kg, em m³ e
 * em unidade — somar os três dá um total que não existe. Por isso
 * `validarBloco` recusa a conta antes de ela acontecer, em vez de devolver
 * um número plausível e errado.
 */

export const OPERACOES = [
  { valor: 'contar', rotulo: 'Contar linhas', precisaCampo: false, precisaMesmaUnidade: false, vazio: 0 },
  { valor: 'contar_distintos', rotulo: 'Contar valores diferentes', precisaCampo: true, precisaMesmaUnidade: false, vazio: 0 },
  { valor: 'somar', rotulo: 'Somar', precisaCampo: true, precisaMesmaUnidade: true, vazio: 0 },
  { valor: 'media', rotulo: 'Média', precisaCampo: true, precisaMesmaUnidade: true, vazio: null },
  { valor: 'minimo', rotulo: 'Menor valor', precisaCampo: true, precisaMesmaUnidade: true, vazio: null },
  { valor: 'maximo', rotulo: 'Maior valor', precisaCampo: true, precisaMesmaUnidade: true, vazio: null },
]

export const M_OPERACAO = Object.fromEntries(OPERACOES.map((o) => [o.valor, o]))

export const COMPARADORES = [
  { valor: 'igual', rotulo: 'é igual a', precisaValor: true },
  { valor: 'diferente', rotulo: 'é diferente de', precisaValor: true },
  { valor: 'contem', rotulo: 'contém', precisaValor: true, sóTexto: true },
  { valor: 'maior', rotulo: 'é maior que', precisaValor: true },
  { valor: 'maior_igual', rotulo: 'é maior ou igual a', precisaValor: true },
  { valor: 'menor', rotulo: 'é menor que', precisaValor: true },
  { valor: 'menor_igual', rotulo: 'é menor ou igual a', precisaValor: true },
  { valor: 'preenchido', rotulo: 'está preenchido', precisaValor: false },
  { valor: 'vazio', rotulo: 'está vazio', precisaValor: false },
]

export const M_COMPARADOR = Object.fromEntries(COMPARADORES.map((c) => [c.valor, c]))

export const GRANULARIDADES = [
  { valor: 'dia', rotulo: 'Por dia' },
  { valor: 'semana', rotulo: 'Por semana' },
  { valor: 'mes', rotulo: 'Por mês' },
  { valor: 'ano', rotulo: 'Por ano' },
]

const SEM_VALOR = '—'

const RE_DATA_PURA = /^\d{4}-\d{2}-\d{2}$/

/**
 * O dia (YYYY-MM-DD) de um valor do banco.
 *
 * Data pura passa direto: mandar "2026-09-13" pro `new Date` faria o
 * navegador ler como meia-noite UTC e, em Fortaleza, mostrar o dia 12.
 * Só o que tem hora é convertido, e sempre pro fuso da fábrica.
 */
export function diaDe(valor) {
  if (valor == null || valor === '') return null
  if (typeof valor === 'string' && RE_DATA_PURA.test(valor)) return valor
  return dataISOEm(valor)
}

const numeroDe = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const textoDe = (v) => {
  if (v == null || v === '') return SEM_VALOR
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  return String(v)
}

/* ------------------------------------------------------------- filtros */

export function passaNoFiltro(linha, filtro) {
  const { campo, comparador, valor } = filtro
  const atual = linha?.[campo]
  const vazio = atual == null || atual === ''

  if (comparador === 'vazio') return vazio
  if (comparador === 'preenchido') return !vazio
  // Linha sem o valor nunca casa com uma comparação de conteúdo: "custo
  // maior que 100" não pode incluir a OS que ainda não tem custo nenhum.
  if (vazio) return false

  const alvoNumero = numeroDe(valor)
  const atualNumero = numeroDe(atual)
  const dáPraComparar = alvoNumero != null && atualNumero != null

  switch (comparador) {
    case 'igual':
      return dáPraComparar ? atualNumero === alvoNumero : textoDe(atual) === textoDe(valor)
    case 'diferente':
      return dáPraComparar ? atualNumero !== alvoNumero : textoDe(atual) !== textoDe(valor)
    case 'contem':
      return textoDe(atual).toLowerCase().includes(String(valor).toLowerCase())
    // Datas comparam como texto ISO de propósito: "2026-09-13" > "2026-09-02"
    // dá o mesmo resultado que comparar as datas, sem criar Date nenhum.
    case 'maior':
      return dáPraComparar ? atualNumero > alvoNumero : String(atual) > String(valor)
    case 'maior_igual':
      return dáPraComparar ? atualNumero >= alvoNumero : String(atual) >= String(valor)
    case 'menor':
      return dáPraComparar ? atualNumero < alvoNumero : String(atual) < String(valor)
    case 'menor_igual':
      return dáPraComparar ? atualNumero <= alvoNumero : String(atual) <= String(valor)
    default:
      return true
  }
}

export function aplicarFiltros(linhas, filtros) {
  const ativos = (filtros || []).filter(
    (f) => f?.campo && f?.comparador && (!M_COMPARADOR[f.comparador]?.precisaValor || f.valor !== '')
  )
  if (!ativos.length) return linhas || []
  return (linhas || []).filter((l) => ativos.every((f) => passaNoFiltro(l, f)))
}

/* ----------------------------------------------------------- agregação */

export function agregar(linhas, operacao, campo) {
  const lista = linhas || []
  if (operacao === 'contar') return lista.length

  if (operacao === 'contar_distintos') {
    const vistos = new Set()
    for (const l of lista) {
      const v = l?.[campo]
      if (v != null && v !== '') vistos.add(String(v))
    }
    return vistos.size
  }

  const numeros = lista.map((l) => numeroDe(l?.[campo])).filter((v) => v != null)
  // Sem nenhum número não existe soma zero nem média zero: existe "não
  // tem dado". Devolver 0 aqui viraria um gráfico afirmando que o custo
  // foi zero num mês em que ninguém lançou nada.
  if (!numeros.length) return operacao === 'somar' ? 0 : null

  switch (operacao) {
    case 'somar': return numeros.reduce((s, v) => s + v, 0)
    case 'media': return numeros.reduce((s, v) => s + v, 0) / numeros.length
    case 'minimo': return Math.min(...numeros)
    case 'maximo': return Math.max(...numeros)
    default: return null
  }
}

/* ------------------------------------------------------------ agrupar */

export function agruparPorCampo(linhas, campoGrupo, operacao, campoValor, { limite = 12, ordem = 'valor' } = {}) {
  const grupos = new Map()
  for (const l of linhas || []) {
    const chave = textoDe(l?.[campoGrupo])
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(l)
  }

  let itens = [...grupos.entries()].map(([rotulo, linhasDoGrupo]) => ({
    rotulo,
    valor: agregar(linhasDoGrupo, operacao, campoValor),
    linhas: linhasDoGrupo.length,
  }))

  if (ordem === 'rotulo') itens.sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
  else itens.sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity))

  if (limite && itens.length > limite) {
    const mostrados = itens.slice(0, limite)
    const resto = itens.slice(limite)
    // O resto vira uma fatia "outros" em vez de sumir: um gráfico que
    // esconde metade dos dados sem avisar mente sobre o total.
    const valorResto = operacao === 'somar' || operacao === 'contar' || operacao === 'contar_distintos'
      ? resto.reduce((s, i) => s + (i.valor || 0), 0)
      : null
    mostrados.push({
      rotulo: `Outros (${resto.length})`,
      valor: valorResto,
      linhas: resto.reduce((s, i) => s + i.linhas, 0),
      resto: true,
    })
    itens = mostrados
  }

  return itens
}

/* ------------------------------------------------------- série no tempo */

const DIA_MS = 86400000
const paraUTC = (iso) => {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}
const deUTC = (ms) => new Date(ms).toISOString().slice(0, 10)

/** O início do balde a que um dia pertence. Semana começa no domingo. */
export function inicioDoBalde(iso, granularidade) {
  if (!iso) return null
  const [ano, mes] = iso.split('-').map(Number)
  if (granularidade === 'ano') return `${String(ano).padStart(4, '0')}-01-01`
  if (granularidade === 'mes') return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-01`
  if (granularidade === 'semana') {
    const ms = paraUTC(iso)
    return deUTC(ms - new Date(ms).getUTCDay() * DIA_MS)
  }
  return iso
}

const proximoBalde = (iso, granularidade) => {
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (granularidade === 'ano') return `${String(ano + 1).padStart(4, '0')}-01-01`
  if (granularidade === 'mes') {
    const m = mes === 12 ? 1 : mes + 1
    const a = mes === 12 ? ano + 1 : ano
    return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
  }
  return deUTC(Date.UTC(ano, mes - 1, dia) + (granularidade === 'semana' ? 7 : 1) * DIA_MS)
}

/** Quantos baldes no máximo a série preenche — um dia por pixel já é demais. */
const TETO_BALDES = 400

export function serieNoTempo(linhas, campoData, granularidade, operacao, campoValor) {
  const porBalde = new Map()
  for (const l of linhas || []) {
    const dia = diaDe(l?.[campoData])
    if (!dia) continue
    const balde = inicioDoBalde(dia, granularidade)
    if (!porBalde.has(balde)) porBalde.set(balde, [])
    porBalde.get(balde).push(l)
  }
  if (!porBalde.size) return []

  const chaves = [...porBalde.keys()].sort()
  const vazio = M_OPERACAO[operacao]?.vazio ?? null

  // Preenche os buracos entre o primeiro e o último balde. Sem isso, uma
  // semana sem serviço vira uma reta ligando os dois lados, como se o
  // valor tivesse caído devagar — quando na verdade não houve nada.
  // O que entra no buraco depende da conta: soma e contagem viram zero
  // (não houve mesmo), média e mínimo viram vazio (não dá pra afirmar).
  const serie = []
  let atual = chaves[0]
  const ultimo = chaves[chaves.length - 1]
  let voltas = 0
  while (atual <= ultimo && voltas < TETO_BALDES) {
    const doBalde = porBalde.get(atual)
    serie.push({
      periodo: atual,
      valor: doBalde ? agregar(doBalde, operacao, campoValor) : vazio,
      linhas: doBalde ? doBalde.length : 0,
    })
    atual = proximoBalde(atual, granularidade)
    voltas += 1
  }

  // Estourou o teto: em vez de cortar o fim em silêncio, devolve só os
  // baldes que têm dado mesmo, na ordem.
  if (voltas >= TETO_BALDES && atual <= ultimo) {
    return chaves.map((k) => ({
      periodo: k,
      valor: agregar(porBalde.get(k), operacao, campoValor),
      linhas: porBalde.get(k).length,
    }))
  }

  return serie
}

/* ----------------------------------------------------------- validação */

/**
 * O bloco dá pra calcular?
 *
 * Roda antes de consultar qualquer coisa — é o que impede o painel de
 * mostrar um número que não significa nada, e o que explica pro usuário o
 * porquê em vez de só desabilitar o botão.
 */
export function validarBloco(bloco) {
  if (!bloco) return { ok: false, erro: 'Bloco vazio.' }
  if (bloco.tipo === 'texto') return { ok: true }
  if (!bloco.fonte) return { ok: false, erro: 'Escolha de onde vêm os dados.' }

  const op = M_OPERACAO[bloco.operacao]
  if (bloco.tipo !== 'lista') {
    if (!op) return { ok: false, erro: 'Escolha a conta a ser feita.' }
    if (op.precisaCampo && !bloco.campoValor) {
      return { ok: false, erro: `Escolha sobre qual campo fazer "${op.rotulo.toLowerCase()}".` }
    }
  }

  if (['barras', 'pizza'].includes(bloco.tipo) && !bloco.agruparPor) {
    return { ok: false, erro: 'Escolha por qual campo agrupar.' }
  }
  if (bloco.tipo === 'linha' && !bloco.campoData) {
    return { ok: false, erro: 'Escolha a data que vai no eixo do tempo.' }
  }
  if (bloco.tipo === 'lista' && !(bloco.colunas || []).length) {
    return { ok: false, erro: 'Escolha pelo menos uma coluna.' }
  }

  // A trava das unidades de medida.
  if (op?.precisaMesmaUnidade && bloco.campoValor) {
    const campo = campoDe(bloco.fonte, bloco.campoValor)
    const exigido = campo?.exigeAgrupamento
    if (exigido) {
      const agrupaPorEle = bloco.agruparPor === exigido
      const fixadoNoFiltro = (bloco.filtros || []).some(
        (f) => f.campo === exigido && f.comparador === 'igual' && f.valor !== ''
      )
      if (!agrupaPorEle && !fixadoNoFiltro) {
        const rotulo = campoDe(bloco.fonte, exigido)?.rotulo || exigido
        return {
          ok: false,
          erro: `"${campo.rotulo}" vem em unidades diferentes (kg, m³, unidade). Agrupe por "${rotulo}" ou filtre uma unidade só — somar tudo junto daria um número que não existe.`,
        }
      }
    }
  }

  return { ok: true }
}

/** Todos os campos que o bloco precisa trazer do banco. */
export function camposDoBloco(bloco) {
  if (!bloco || bloco.tipo === 'texto') return []
  const usados = [
    bloco.campoValor,
    bloco.agruparPor,
    bloco.campoData,
    ...(bloco.colunas || []),
    ...(bloco.filtros || []).map((f) => f.campo),
  ]
  return [...new Set(usados.filter(Boolean))]
}
