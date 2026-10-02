/**
 * Endereço que vai gravado no QR da etiqueta. A etiqueta é física e fica
 * anos colada na máquina, então o link precisa de um endereço que não
 * muda. Usar o endereço da página aberta no momento (o que se fazia antes)
 * grava o de um deploy da Vercel — e esses são apagados pela política de
 * retenção, deixando o QR em "410 GONE".
 *
 * `VITE_URL_PUBLICA` (ex.: https://sgai-ley.vercel.app) fixa o endereço;
 * sem ela, cai no endereço atual.
 */
export function origemPublica(env = import.meta.env, local = globalThis.location) {
  const fixa = String(env?.VITE_URL_PUBLICA || '').trim().replace(/\/+$/, '')
  return fixa || local?.origin || ''
}

export function linkDoQR(token, env, local) {
  return token ? `${origemPublica(env, local)}/reportar/${token}` : ''
}

/**
 * O endereço é de um deploy que a Vercel apaga? Dois formatos:
 * - deploy avulso: `projeto-<hash de 9>-<time>.vercel.app`
 * - deploy de branch: `projeto-git-<branch>-<time>.vercel.app` (some
 *   quando o branch é apagado)
 */
export function enderecoTemporario(host) {
  if (!host || !host.endsWith('.vercel.app')) return false
  const nome = host.slice(0, -'.vercel.app'.length)
  if (nome.includes('-git-')) return true
  return nome.split('-').some((parte) => /^(?=[a-z]*\d)(?=\d*[a-z])[a-z0-9]{9}$/.test(parte))
}
