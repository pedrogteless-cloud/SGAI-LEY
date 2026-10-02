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

/**
 * Cópia reduzida de uma foto, só pra impressão. A foto do iPhone chega
 * com 12 MP: aberta na memória são ~48 MB cada, e o Safari do iPhone
 * imprime FOLHAS EM BRANCO quando a página passa do limite de memória
 * dele. Na folha a foto ocupa uns 6 cm — 1000 px sobram.
 * Em qualquer falha devolve a URL original: pior imprimir pesado do que
 * imprimir sem a foto.
 */
export async function reduzirFoto(url, maxLado = 1000, qualidade = 0.8) {
  try {
    const resposta = await fetch(url)
    if (!resposta.ok) return url
    const bitmap = await createImageBitmap(await resposta.blob(), { imageOrientation: 'from-image' })
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    const tela = document.createElement('canvas')
    tela.width = Math.round(bitmap.width * escala)
    tela.height = Math.round(bitmap.height * escala)
    tela.getContext('2d').drawImage(bitmap, 0, 0, tela.width, tela.height)
    bitmap.close?.()
    const menor = await new Promise((resolver) => tela.toBlob(resolver, 'image/jpeg', qualidade))
    // Solta o buffer do canvas já: no iPhone ele conta no mesmo limite.
    tela.width = 0
    tela.height = 0
    return menor ? URL.createObjectURL(menor) : url
  } catch {
    return url
  }
}

/** Reduz várias de uma vez e devolve { urlOriginal: urlReduzida }. */
export async function reduzirFotos(urls, opcoes) {
  const unicas = [...new Set(urls.filter(Boolean))]
  const reduzidas = []
  // Uma de cada vez: decodificar 8 fotos de 12 MP em paralelo é
  // justamente o pico de memória que se quer evitar.
  for (const url of unicas) reduzidas.push(await reduzirFoto(url, opcoes?.maxLado, opcoes?.qualidade))
  return Object.fromEntries(unicas.map((u, i) => [u, reduzidas[i]]))
}

/** Libera as cópias criadas por reduzirFotos. */
export function liberarFotos(mapa) {
  for (const url of Object.values(mapa || {})) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  }
}
