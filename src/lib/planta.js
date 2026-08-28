/**
 * Contas da planta do galpão.
 *
 * Tudo em metros. O desenho usa 1 unidade de SVG = 1 metro, então não existe
 * conversão de escala espalhada pelo código: o que está aqui é medida real.
 *
 * Sem React de propósito — dá para conferir estas contas isoladamente.
 */

/** Quando ninguém informou a medida, desenha um quadrado de 2 m e avisa. */
export const MEDIDA_PADRAO = 2

/** Encaixe do arrasto, em metros. Meio metro mantém a planta arrumada. */
export const PASSO = 0.5

/**
 * Retângulo que a máquina ocupa no chão, já considerando o giro.
 * Girada em 90°, o comprimento passa a ocupar o eixo vertical.
 */
export function caixa(m) {
  const comp = Number(m.comp_m) || MEDIDA_PADRAO
  const larg = Number(m.larg_m) || MEDIDA_PADRAO
  const deitada = m.rotacao === 90 || m.rotacao === 270
  return {
    x: Number(m.pos_x_m) || 0,
    y: Number(m.pos_y_m) || 0,
    w: deitada ? larg : comp,
    h: deitada ? comp : larg,
    estimada: !m.comp_m || !m.larg_m,
  }
}

export const temPosicao = (m) =>
  m.planta_id != null && m.pos_x_m != null && m.pos_y_m != null

export const encaixar = (v, passo = PASSO) => Math.round(v / passo) * passo

/** Não deixa a máquina sair do galpão, nem meio corpo para fora. */
export function prender(x, y, w, h, planta) {
  const maxX = Number(planta.comprimento_m) - w
  const maxY = Number(planta.largura_m) - h
  return {
    x: Math.min(Math.max(x, 0), Math.max(maxX, 0)),
    y: Math.min(Math.max(y, 0), Math.max(maxY, 0)),
  }
}

/** Duas máquinas ocupando o mesmo chão. */
export function encostam(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/**
 * Primeiro lugar vago para uma máquina que está entrando na planta, varrendo
 * da esquerda para a direita. Evita que ela nasça empilhada em cima de outra,
 * que é o que acontece quando se joga tudo no mesmo ponto de partida.
 * Se o galpão estiver lotado, devolve o canto — dá para arrastar de lá.
 */
export function primeiroLugarLivre(w, h, ocupadas, planta, folga = 1) {
  const maxX = Number(planta.comprimento_m) - w
  const maxY = Number(planta.largura_m) - h
  for (let y = folga; y <= maxY; y += 1) {
    for (let x = folga; x <= maxX; x += 1) {
      const tentativa = { x, y, w: w + folga, h: h + folga }
      if (!ocupadas.some((o) => encostam(tentativa, o))) return { x, y }
    }
  }
  return { x: Math.min(folga, Math.max(maxX, 0)), y: Math.min(folga, Math.max(maxY, 0)) }
}

// ------------------------------------------------------------- endereço

/**
 * Tamanho da célula do endereço. Usa o vão entre pilares porque essa é a
 * referência que já existe fisicamente: a pessoa olha os pilares e sabe onde
 * está, sem medir nada. Sem pilar cadastrado, cai para 5 m.
 */
export const celula = (planta) => Number(planta?.vao_pilar_m) || 5

/** Letras das faixas na largura: A, B, C… e AA depois do Z, se um dia precisar. */
export function letraFaixa(i) {
  let n = i
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

/**
 * Endereço de um ponto do galpão: vão no comprimento, faixa na largura.
 * "Vão 7 · Faixa C" para falar, "7C" para escrever na etiqueta e na lista.
 */
export function endereco(x, y, planta) {
  if (x == null || y == null || !planta) return null
  const c = celula(planta)
  const comp = Number(planta.comprimento_m)
  const larg = Number(planta.largura_m)

  // Arredonda no centímetro antes de dividir. Sem isso, um cursor em
  // 35,9999 m cai no vão 6 enquanto a tela escreve "36,0 m" — o endereço e o
  // número ao lado dele se contradizem, e parece defeito.
  const cx = Math.round(x * 100) / 100
  const cy = Math.round(y * 100) / 100

  // um ponto exatamente na parede do fim pertence ao último vão, não a um a mais
  const vao = Math.min(Math.floor(cx / c) + 1, Math.max(1, Math.ceil(comp / c)))
  const iFaixa = Math.min(Math.floor(cy / c), Math.max(0, Math.ceil(larg / c) - 1))
  const faixa = letraFaixa(iFaixa)

  return { vao, faixa, curto: `${vao}${faixa}`, completo: `Vão ${vao} · Faixa ${faixa}` }
}

/** Endereço que a máquina ocupa — pelo centro dela, não pelo canto. */
export function enderecoDaMaquina(m, planta) {
  if (!temPosicao(m) || !planta) return null
  const c = caixa(m)
  return endereco(c.x + c.w / 2, c.y + c.h / 2, planta)
}

/** Divisões do endereço, para desenhar a grade e as réguas. */
export function divisoes(planta) {
  const c = celula(planta)
  const comp = Number(planta.comprimento_m)
  const larg = Number(planta.largura_m)
  const vaos = []
  for (let x = 0; x < comp - 0.01; x += c) vaos.push(Number(x.toFixed(2)))
  vaos.push(comp)
  const faixas = []
  for (let y = 0; y < larg - 0.01; y += c) faixas.push(Number(y.toFixed(2)))
  faixas.push(larg)
  return { celula: c, vaos, faixas }
}

// ---------------------------------------------------------------- cores

const CINZA = { fundo: '#f1f5f9', borda: '#94a3b8', texto: '#334155' }

const POR_SITUACAO = {
  operando:      { fundo: '#d1fae5', borda: '#10b981', texto: '#065f46' },
  parado:        { fundo: '#fee2e2', borda: '#ef4444', texto: '#991b1b' },
  em_manutencao: { fundo: '#fef3c7', borda: '#f59e0b', texto: '#92400e' },
  reserva:       { fundo: '#e0f2fe', borda: '#0ea5e9', texto: '#075985' },
  baixado:       CINZA,
}

const POR_CRITICIDADE = {
  A: { fundo: '#fee2e2', borda: '#ef4444', texto: '#991b1b' },
  B: { fundo: '#fef3c7', borda: '#f59e0b', texto: '#92400e' },
  C: CINZA,
}

/** Escala de calor do gasto: quanto mais escuro, mais dinheiro foi embora. */
const CALOR = [
  { fundo: '#f8fafc', borda: '#cbd5e1', texto: '#475569' },
  { fundo: '#fef3c7', borda: '#fbbf24', texto: '#92400e' },
  { fundo: '#fed7aa', borda: '#f97316', texto: '#9a3412' },
  { fundo: '#fecaca', borda: '#ef4444', texto: '#991b1b' },
  { fundo: '#fca5a5', borda: '#dc2626', texto: '#7f1d1d' },
]

/** Cores distinguíveis para separar quadros elétricos. */
const QUADROS = [
  { fundo: '#dbeafe', borda: '#3b82f6', texto: '#1e40af' },
  { fundo: '#e9d5ff', borda: '#a855f7', texto: '#6b21a8' },
  { fundo: '#ccfbf1', borda: '#14b8a6', texto: '#115e59' },
  { fundo: '#fce7f3', borda: '#ec4899', texto: '#9d174d' },
  { fundo: '#fef08a', borda: '#eab308', texto: '#854d0e' },
  { fundo: '#ddd6fe', borda: '#8b5cf6', texto: '#5b21b6' },
  { fundo: '#bbf7d0', borda: '#22c55e', texto: '#166534' },
  { fundo: '#fed7aa', borda: '#f97316', texto: '#9a3412' },
]

export const CAMADAS = [
  { id: 'situacao', nome: 'Como está agora' },
  { id: 'criticidade', nome: 'Importância' },
  { id: 'gasto', nome: 'Onde o dinheiro foi' },
  { id: 'quadro', nome: 'Se o quadro cair' },
]

/**
 * Cor da máquina na camada escolhida.
 * `ctx` traz o que depende do conjunto todo: maior gasto e ordem dos quadros.
 */
export function cor(camada, m, ctx = {}) {
  if (camada === 'criticidade') return POR_CRITICIDADE[m.criticidade] || CINZA

  if (camada === 'gasto') {
    const teto = ctx.maiorGasto || 0
    const v = Number(m.custo_12m) || 0
    if (teto <= 0 || v <= 0) return CALOR[0]
    // raiz quadrada abre a diferença na parte de baixo da escala, senão uma
    // máquina muito cara achata todas as outras num tom só
    const faixa = Math.min(CALOR.length - 1, Math.ceil(Math.sqrt(v / teto) * (CALOR.length - 1)))
    return CALOR[faixa]
  }

  if (camada === 'quadro') {
    if (!m.quadro_id) return CINZA
    const i = (ctx.ordemQuadros || []).indexOf(m.quadro_id)
    return QUADROS[(i < 0 ? 0 : i) % QUADROS.length]
  }

  return POR_SITUACAO[m.situacao] || CINZA
}

/** Legenda da camada, já com a contagem de máquinas de cada cor. */
export function legenda(camada, maquinas, ctx = {}) {
  const conta = (fn) => maquinas.filter(fn).length

  if (camada === 'criticidade') {
    return [
      { chave: 'A', rotulo: 'A — para a produção', cor: POR_CRITICIDADE.A, n: conta((m) => m.criticidade === 'A') },
      { chave: 'B', rotulo: 'B — atrapalha', cor: POR_CRITICIDADE.B, n: conta((m) => m.criticidade === 'B') },
      { chave: 'C', rotulo: 'C — dá pra esperar', cor: POR_CRITICIDADE.C, n: conta((m) => m.criticidade === 'C') },
    ]
  }

  if (camada === 'gasto') {
    const teto = ctx.maiorGasto || 0
    return [
      { chave: 'frio', rotulo: 'Pouco ou nenhum gasto', cor: CALOR[0] },
      { chave: 'medio', rotulo: 'Gasto intermediário', cor: CALOR[2] },
      { chave: 'quente', rotulo: teto > 0 ? 'Perto do maior gasto' : 'Maior gasto', cor: CALOR[4] },
    ]
  }

  if (camada === 'quadro') {
    return (ctx.quadros || []).map((q, i) => ({
      chave: q.id,
      rotulo: q.nome,
      cor: QUADROS[i % QUADROS.length],
      n: conta((m) => m.quadro_id === q.id),
    })).concat(
      conta((m) => !m.quadro_id) > 0
        ? [{ chave: 'sem', rotulo: 'Sem quadro informado', cor: CINZA, n: conta((m) => !m.quadro_id) }]
        : []
    )
  }

  return [
    { chave: 'operando', rotulo: 'Funcionando', cor: POR_SITUACAO.operando, n: conta((m) => m.situacao === 'operando') },
    { chave: 'parado', rotulo: 'Parada', cor: POR_SITUACAO.parado, n: conta((m) => m.situacao === 'parado') },
    { chave: 'em_manutencao', rotulo: 'Em conserto', cor: POR_SITUACAO.em_manutencao, n: conta((m) => m.situacao === 'em_manutencao') },
    { chave: 'reserva', rotulo: 'De reserva', cor: POR_SITUACAO.reserva, n: conta((m) => m.situacao === 'reserva') },
    { chave: 'baixado', rotulo: 'Fora de uso', cor: POR_SITUACAO.baixado, n: conta((m) => m.situacao === 'baixado') },
  ].filter((l) => l.n > 0)
}

/** Contexto que as cores precisam, calculado uma vez para o conjunto. */
export function contexto(maquinas, quadros = []) {
  const usados = quadros.filter((q) => maquinas.some((m) => m.quadro_id === q.id))
  return {
    maiorGasto: Math.max(0, ...maquinas.map((m) => Number(m.custo_12m) || 0)),
    quadros: usados,
    ordemQuadros: usados.map((q) => q.id),
  }
}
