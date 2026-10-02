/**
 * A geometria da grade onde os blocos são arrastados.
 *
 * Sem biblioteca de grade: o app já arrasta máquina na planta com pointer
 * events crus, e trazer uma dependência nova pra isso custaria mais em
 * tamanho de bundle (que o pessoal baixa no 4G do galpão) do que as ~80
 * linhas daqui. Tudo é função pura, então dá pra testar o comportamento
 * chato — sobreposição, empurrão, limite de borda — sem abrir navegador.
 *
 * Coordenadas em unidades de grade, nunca em pixel: `x` de 0 a 11 (12
 * colunas), `y` em linhas, `w`/`h` em quantas células ocupa. Pixel é
 * problema da tela, e muda com o tamanho do celular.
 */

export const COLUNAS = 12

/** Tamanho inicial de cada tipo de bloco, escolhido pra caber bem já de cara. */
export const TAMANHO_PADRAO = {
  numero: { w: 3, h: 2 },
  barras: { w: 6, h: 4 },
  linha: { w: 8, h: 4 },
  pizza: { w: 4, h: 4 },
  lista: { w: 6, h: 5 },
  texto: { w: 12, h: 1 },
}

export const TAMANHO_MINIMO = {
  numero: { w: 2, h: 2 },
  barras: { w: 3, h: 3 },
  linha: { w: 3, h: 3 },
  pizza: { w: 3, h: 3 },
  lista: { w: 3, h: 3 },
  texto: { w: 2, h: 1 },
}

const limitar = (v, min, max) => Math.max(min, Math.min(max, v))

export const seCruzam = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** Mantém o bloco dentro das 12 colunas e fora das coordenadas negativas. */
export function prenderNaGrade(bloco) {
  const w = limitar(Math.round(bloco.w), 1, COLUNAS)
  const h = Math.max(1, Math.round(bloco.h))
  return {
    ...bloco,
    w,
    h,
    x: limitar(Math.round(bloco.x), 0, COLUNAS - w),
    y: Math.max(0, Math.round(bloco.y)),
  }
}

/**
 * Resolve sobreposição empurrando pra baixo, nunca pra cima.
 *
 * Empurrar pra baixo é previsível: quem você acabou de soltar fica onde
 * soltou, e o que estava ali desce. Empurrar pro lado faria o painel
 * inteiro se reorganizar sozinho a cada arrastar, que é a queixa clássica
 * de construtor de dashboard.
 *
 * `fixo` é o bloco recém-solto: ele não se mexe, os outros cedem.
 */
export function resolverSobreposicao(blocos, idFixo = null) {
  const ordenados = [...blocos].sort((a, b) => {
    if (a.id === idFixo) return -1
    if (b.id === idFixo) return 1
    return a.y - b.y || a.x - b.x
  })

  const postos = []
  for (const bloco of ordenados) {
    let atual = prenderNaGrade(bloco)
    // Desce uma linha por vez até achar altura livre. O limite de voltas é
    // defensivo: grade com 60 blocos no máximo nunca chega perto disso.
    let voltas = 0
    while (postos.some((p) => seCruzam(atual, p)) && voltas < 500) {
      atual = { ...atual, y: atual.y + 1 }
      voltas += 1
    }
    postos.push(atual)
  }

  return postos.sort((a, b) => a.y - b.y || a.x - b.x)
}

/**
 * Puxa tudo pra cima, tirando as faixas vazias que sobraram depois de
 * mover ou apagar um bloco. Sem isso o painel vai ganhando buracos e
 * ninguém entende por que precisa rolar a tela.
 */
export function compactar(blocos) {
  const ordenados = [...blocos].sort((a, b) => a.y - b.y || a.x - b.x)
  const postos = []
  for (const bloco of ordenados) {
    let atual = prenderNaGrade(bloco)
    while (atual.y > 0) {
      const acima = { ...atual, y: atual.y - 1 }
      if (postos.some((p) => seCruzam(acima, p))) break
      atual = acima
    }
    postos.push(atual)
  }
  return postos.sort((a, b) => a.y - b.y || a.x - b.x)
}

/** Quantas linhas a grade ocupa hoje. */
export const alturaDaGrade = (blocos) =>
  (blocos || []).reduce((max, b) => Math.max(max, b.y + b.h), 0)

/**
 * Onde cabe um bloco novo: na primeira linha livre depois de tudo.
 *
 * Tenta encaixar na mesma linha do último se sobrar largura — assim três
 * cartões de número seguidos ficam lado a lado em vez de empilhados, que é
 * como a pessoa desenharia no papel.
 */
export function vagaParaNovo(blocos, tamanho) {
  const w = limitar(tamanho.w, 1, COLUNAS)
  const h = Math.max(1, tamanho.h)
  const existentes = blocos || []
  if (!existentes.length) return { x: 0, y: 0, w, h }

  const ultimaLinha = alturaDaGrade(existentes)
  for (let y = 0; y <= ultimaLinha; y += 1) {
    for (let x = 0; x <= COLUNAS - w; x += 1) {
      const tentativa = { x, y, w, h }
      if (!existentes.some((b) => seCruzam(tentativa, b))) return tentativa
    }
  }
  return { x: 0, y: ultimaLinha, w, h }
}

/** Move um bloco e acomoda o resto. */
export function moverBloco(blocos, id, destino) {
  const movido = blocos.map((b) => (b.id === id ? prenderNaGrade({ ...b, ...destino }) : b))
  return compactar(resolverSobreposicao(movido, id))
}

/** Redimensiona respeitando o mínimo do tipo e a borda da grade. */
export function redimensionarBloco(blocos, id, tamanho) {
  const alvo = blocos.find((b) => b.id === id)
  if (!alvo) return blocos
  const min = TAMANHO_MINIMO[alvo.tipo] || { w: 2, h: 2 }
  const w = limitar(Math.round(tamanho.w), min.w, COLUNAS - alvo.x)
  const h = Math.max(min.h, Math.round(tamanho.h))
  const redimensionado = blocos.map((b) => (b.id === id ? { ...b, w, h } : b))
  return compactar(resolverSobreposicao(redimensionado, id))
}

/** Tira um bloco e fecha o buraco que ele deixou. */
export function removerBloco(blocos, id) {
  return compactar(blocos.filter((b) => b.id !== id))
}

/**
 * A grade achatada em uma coluna, pra tela de celular.
 *
 * No celular arrastar bloco não é o caso de uso — quem monta o painel
 * monta sentado, quem olha no galpão só olha. Então ali o painel vira uma
 * lista na ordem em que foi desenhado: de cima pra baixo, da esquerda pra
 * direita.
 */
export const ordemDeLeitura = (blocos) =>
  [...(blocos || [])].sort((a, b) => a.y - b.y || a.x - b.x)
