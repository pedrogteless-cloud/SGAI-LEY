/**
 * A fábrica sempre opera em Fortaleza, independente do fuso do aparelho
 * de quem está usando (ou de o navegador rodar em UTC, comum em CI/SSR).
 * `new Date().toISOString().slice(0, 10)` pega a data em UTC — depois
 * das 21h em Fortaleza (UTC-3) o UTC já virou o dia seguinte, então
 * "hoje" pulava pro dia de amanhã em relatório, filtro e lançamento.
 * Esse arquivo é o único lugar que decide "que dia é hoje" — todo o
 * resto do sistema usa essas funções em vez de reconstruir a conta.
 */

export const FUSO_HORARIO = 'America/Fortaleza'

const formatador = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_HORARIO })

/** Data de hoje em Fortaleza, como "YYYY-MM-DD" — nunca em UTC ou no fuso do aparelho. */
export function hojeISO() {
  return formatador.format(new Date())
}

/** Igual, mas para qualquer instante — converte um timestamptz do banco na data-calendário certa em Fortaleza. */
export function dataISOEm(instante) {
  if (!instante) return null
  return formatador.format(new Date(instante))
}
