/**
 * Espera as imagens de dentro de `raiz` terminarem de carregar (ou
 * falharem) antes de chamar a impressão. Sem isso o Safari do iPhone
 * abre a folha com as fotos ainda vazias: o print não espera a rede.
 * O teto existe pra uma foto travada não segurar a impressão pra sempre.
 */
export function esperarImagens(raiz, tetoMs = 10000) {
  const imagens = raiz ? [...raiz.querySelectorAll('img')] : []
  const pendentes = imagens
    .filter((img) => !img.complete)
    .map((img) => new Promise((resolver) => {
      img.addEventListener('load', resolver, { once: true })
      img.addEventListener('error', resolver, { once: true })
    }))
  if (!pendentes.length) return Promise.resolve()
  return Promise.race([
    Promise.all(pendentes),
    new Promise((resolver) => setTimeout(resolver, tetoMs)),
  ])
}
