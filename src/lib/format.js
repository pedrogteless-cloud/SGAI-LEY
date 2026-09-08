export const moeda = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  })

export const numero = (v, casas = 0) =>
  (Number(v) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })

// Data pura do banco ("YYYY-MM-DD", sem hora) não pode virar Date: o
// construtor entende esse formato como meia-noite EM UTC, e mostrar isso
// no fuso local (Fortaleza é UTC-3) exibe o dia anterior. Formata a
// string direto, sem passar por Date — só timestamp de verdade (com hora)
// usa Date, porque aí é um instante real, sem ambiguidade de fuso.
const RE_DATA_PURA = /^\d{4}-\d{2}-\d{2}$/

export const data = (v) => {
  if (!v) return '—'
  if (RE_DATA_PURA.test(v)) {
    const [ano, mes, dia] = v.split('-')
    return `${dia}/${mes}/${ano}`
  }
  return new Date(v).toLocaleDateString('pt-BR')
}

export const dataHora = (v) =>
  v
    ? new Date(v).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

export const duracao = (minutos) => {
  const m = Math.max(0, Math.round(Number(minutos) || 0))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const resto = m % 60
  if (h < 24) return resto ? `${h}h ${resto}min` : `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export const mesLabel = (iso) => {
  if (!iso) return '—'
  const [ano, mes] = iso.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`
}
