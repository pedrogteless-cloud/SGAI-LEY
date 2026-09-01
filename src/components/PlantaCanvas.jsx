import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  caixa, cor, encaixar, prender, divisoes, endereco, letraFaixa,
  caixaEtapa, pontoNaBorda, saidaNaParede, ALTURA_ETAPA, PASSO,
  caixaQuadro, pontosCabo, caminhoSvg,
} from '../lib/planta'

/**
 * A planta desenhada.
 *
 * 1 unidade de SVG = 1 metro. Isso simplifica tudo: a máquina é um retângulo
 * com a medida real dela, o encaixe é em meio metro de verdade, e a cota que
 * aparece na borda é a medida do galpão — nada de escala inventada.
 *
 * O zoom e o arrasto ficam num `<g>` por fora, então o desenho inteiro é
 * sempre o mesmo e só a câmera se move.
 */

const MIN_K = 0.35
const MAX_K = 16
const FOLGA = 6 // metros de respiro em volta, onde as cotas são escritas

const limitar = (v, min, max) => Math.min(Math.max(v, min), max)
const indiceDaDivisao = (valor, divs) => {
  const ultimo = divs.length - 2
  if (ultimo < 0) return 0
  for (let i = 0; i < divs.length - 1; i += 1) {
    if (valor >= divs[i] && valor < divs[i + 1]) return i
  }
  return ultimo
}

export default function PlantaCanvas({
  planta,
  maquinas,
  camada = 'situacao',
  ctx = {},
  selecionada,
  aoSelecionar,
  aoPassarMouse,
  modoEditar = false,
  aoMover,
  aoTerminarArraste,
  refCamera,
  etapas = [],
  ligacoes = [],
  mostrarFluxo = false,
  corEsquema = '#4338ca',
  etapaSelecionada,
  aoSelecionarEtapa,
  aoMoverEtapa,
  aoTerminarArrasteEtapa,
  passoEncaixe = PASSO,
  // ------------------------------------------------------------ energia
  modoEnergia = false,
  quadros = [],
  quadroSelecionado,
  aoSelecionarQuadro,
  aoMoverQuadro,
  aoTerminarArrasteQuadro,
  aoLigarMaquina,
  aoClicarCabo,
  rotaEditando,
  aoCliqueVazioRota,
  aoRemoverPontoRota,
}) {
  const svgRef = useRef(null)
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 })
  const [arrastando, setArrastando] = useState(null)
  const [sobMouse, setSobMouse] = useState(null)
  // leitura do ponto sob o cursor. Fica aqui e não na página de propósito:
  // muda a cada movimento do mouse e redesenharia a tela toda se subisse.
  const [cursor, setCursor] = useState(null)
  const reduzMovimento = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ).current

  const ponteiros = useRef(new Map())
  const gesto = useRef(null)

  const comp = Number(planta.comprimento_m)
  const larg = Number(planta.largura_m)

  const encaixarNaTela = useCallback(() => setVista({ x: 0, y: 0, k: 1 }), [])
  useImperativeHandle(refCamera, () => ({
    encaixar: encaixarNaTela,
    aproximar: () => setVista((v) => ({ ...v, k: limitar(v.k * 1.3, MIN_K, MAX_K) })),
    afastar: () => setVista((v) => ({ ...v, k: limitar(v.k / 1.3, MIN_K, MAX_K) })),
    // centraliza a câmera num ponto do galpão (em metros), com um zoom
    // que dá pra ver a máquina sem precisar catar com o dedo — usado
    // pela busca por nome/código.
    centralizar: (mx, my, k = 2.4) => {
      const kk = limitar(k, MIN_K, MAX_K)
      setVista({ k: kk, x: comp / 2 - mx * kk, y: larg / 2 - my * kk })
    },
  }))

  /** Ponto do evento nas unidades do viewBox (antes do zoom/arrasto). */
  const paraSvg = (e) => {
    const svg = svgRef.current
    const p = svg.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    return p.matrixTransform(svg.getScreenCTM().inverse())
  }

  /** Ponto do evento em metros dentro do galpão. */
  const paraMetros = (e) => {
    const p = paraSvg(e)
    return { x: (p.x - vista.x) / vista.k, y: (p.y - vista.y) / vista.k }
  }

  const zoomEm = (pontoSvg, fator) =>
    setVista((v) => {
      const k = limitar(v.k * fator, MIN_K, MAX_K)
      if (k === v.k) return v
      // mantém sob o cursor o mesmo ponto do mundo que estava lá antes
      const mundoX = (pontoSvg.x - v.x) / v.k
      const mundoY = (pontoSvg.y - v.y) / v.k
      return { k, x: pontoSvg.x - mundoX * k, y: pontoSvg.y - mundoY * k }
    })

  const naRoda = (e) => {
    e.preventDefault()
    zoomEm(paraSvg(e), e.deltaY < 0 ? 1.12 : 1 / 1.12)
  }

  // A roda do mouse precisa de listener não-passivo para o preventDefault valer,
  // e o React registra os dele como passivos — daí o addEventListener na mão.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('wheel', naRoda, { passive: false })
    return () => svg.removeEventListener('wheel', naRoda)
  })

  const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const meio = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  const aoApertar = (e, maquina = null, quadro = null) => {
    // Prender o ponteiro mantém o arrasto vivo mesmo quando o dedo sai do
    // desenho. Falha em alguns casos de borda (ponteiro já solto, por exemplo)
    // e não pode derrubar o resto do gesto por causa disso.
    try {
      e.target.setPointerCapture?.(e.pointerId)
    } catch {
      /* segue sem prender */
    }
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (ponteiros.current.size === 2) {
      const [a, b] = [...ponteiros.current.values()]
      gesto.current = { tipo: 'pinca', dist: distancia(a, b) }
      setArrastando(null)
      return
    }

    if (quadro && modoEditar) {
      const p = paraMetros(e)
      gesto.current = {
        tipo: 'quadro',
        id: quadro.quadro_id,
        dx: p.x - Number(quadro.pos_x_m),
        dy: p.y - Number(quadro.pos_y_m),
      }
      setArrastando(`q-${quadro.quadro_id}`)
      return
    }

    if (maquina && modoEditar) {
      const p = paraMetros(e)
      if (maquina.etapa_id) {
        gesto.current = {
          tipo: 'etapa',
          id: maquina.etapa_id,
          dx: p.x - Number(maquina.pos_x_m),
          dy: p.y - Number(maquina.pos_y_m),
        }
        setArrastando(maquina.etapa_id)
        return
      }
      const c = caixa(maquina)
      gesto.current = { tipo: 'maquina', id: maquina.ativo_id, dx: p.x - c.x, dy: p.y - c.y }
      setArrastando(maquina.ativo_id)
      return
    }

    gesto.current = { tipo: 'navegar', ultimo: paraSvg(e) }
  }

  const aoMexer = (e) => {
    // No dedo não existe "passar por cima": a leitura só faz sentido com mouse.
    if (e.pointerType !== 'touch') {
      const p = paraMetros(e)
      const dentro = p.x >= 0 && p.x <= comp && p.y >= 0 && p.y <= larg
      setCursor(dentro ? p : null)
    }

    if (!gesto.current) return
    if (ponteiros.current.has(e.pointerId)) {
      ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    if (gesto.current.tipo === 'pinca' && ponteiros.current.size === 2) {
      const [a, b] = [...ponteiros.current.values()]
      const d = distancia(a, b)
      if (gesto.current.dist > 0) {
        const svg = svgRef.current
        const c = meio(a, b)
        const p = svg.createSVGPoint()
        p.x = c.x
        p.y = c.y
        zoomEm(p.matrixTransform(svg.getScreenCTM().inverse()), d / gesto.current.dist)
      }
      gesto.current.dist = d
      return
    }

    if (gesto.current.tipo === 'quadro') {
      const p = paraMetros(e)
      const preso = prender(
        encaixar(p.x - gesto.current.dx, passoEncaixe),
        encaixar(p.y - gesto.current.dy, passoEncaixe),
        0,
        0,
        planta
      )
      aoMoverQuadro?.(gesto.current.id, preso.x, preso.y)
      return
    }

    if (gesto.current.tipo === 'etapa') {
      const p = paraMetros(e)
      const x = Math.min(Math.max(encaixar(p.x - gesto.current.dx, passoEncaixe), 1), comp - 1)
      const y = Math.min(Math.max(encaixar(p.y - gesto.current.dy, passoEncaixe), 1), larg - 1)
      aoMoverEtapa?.(gesto.current.id, x, y)
      return
    }

    if (gesto.current.tipo === 'maquina') {
      const p = paraMetros(e)
      const m = maquinas.find((x) => x.ativo_id === gesto.current.id)
      if (!m) return
      const c = caixa(m)
      const preso = prender(
        encaixar(p.x - gesto.current.dx, passoEncaixe),
        encaixar(p.y - gesto.current.dy, passoEncaixe),
        c.w,
        c.h,
        planta
      )
      aoMover?.(gesto.current.id, preso.x, preso.y)
      return
    }

    if (gesto.current.tipo === 'navegar') {
      const agora = paraSvg(e)
      const dx = agora.x - gesto.current.ultimo.x
      const dy = agora.y - gesto.current.ultimo.y
      gesto.current.ultimo = agora
      setVista((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
    }
  }

  const aoSoltar = (e) => {
    ponteiros.current.delete(e.pointerId)
    if (gesto.current?.tipo === 'maquina') aoTerminarArraste?.(gesto.current.id)
    if (gesto.current?.tipo === 'etapa') aoTerminarArrasteEtapa?.(gesto.current.id)
    if (gesto.current?.tipo === 'quadro') aoTerminarArrasteQuadro?.(gesto.current.id)
    if (ponteiros.current.size === 0) {
      gesto.current = null
      setArrastando(null)
    } else if (gesto.current?.tipo === 'pinca') {
      gesto.current = null
    }
  }

  // A grade é o endereço: 6 m no comprimento por 5 m na largura, acompanhando
  // as juntas de dilatacao. Cruzando os dois eixos sai "7C".
  const { vaos, faixas } = divisoes(planta)
  const temPilar = Number(planta.vao_pilar_m) > 0
  const pilares = temPilar
    ? (() => {
        const passo = Number(planta.vao_pilar_m)
        const xs = []
        for (let x = 0; x < comp - 0.01; x += passo) xs.push(Number(x.toFixed(2)))
        xs.push(comp)
        return xs
      })()
    : []
  const quadrante = cursor
    ? (() => {
        const ix = indiceDaDivisao(cursor.x, vaos)
        const iy = indiceDaDivisao(cursor.y, faixas)
        return {
          x: vaos[ix],
          y: faixas[iy],
          w: vaos[ix + 1] - vaos[ix],
          h: faixas[iy + 1] - faixas[iy],
          endereco: endereco(cursor.x, cursor.y, planta),
        }
      })()
    : null

  const LADO_PILAR = 0.5
  const fonteRegua = Math.max(comp, larg) / 95

  const fonteCota = Math.max(comp, larg) / 45

  return (
    <svg
      ref={svgRef}
      data-planta="1"
      viewBox={`${-FOLGA} ${-FOLGA} ${comp + FOLGA * 2} ${larg + FOLGA * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full touch-none select-none"
      style={{
        cursor: rotaEditando ? 'crosshair' : arrastando ? 'grabbing' : modoEditar ? 'default' : 'grab',
      }}
      onPointerDown={(e) => {
        if (rotaEditando) {
          const p = paraMetros(e)
          aoCliqueVazioRota?.(p.x, p.y)
          return
        }
        if (e.target === svgRef.current || e.target.dataset.fundo) {
          aoSelecionar?.(null)
        }
        aoApertar(e)
      }}
      onPointerMove={aoMexer}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      onPointerLeave={(e) => {
        aoSoltar(e)
        aoPassarMouse?.(null)
        setCursor(null)
      }}
    >
      <defs>
        {/* Um marcador só: a cor vem do esquema selecionado, não é fixa —
            Produção, Energia e Bombeiros cada um desenha na cor dele. */}
        <marker id="ponta-esquema" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={corEsquema} />
        </marker>
        <pattern id="hachura" width="1.4" height="1.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="1.4" stroke="#cbd5e1" strokeWidth="0.35" />
        </pattern>
      </defs>

      <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
        {/* parede: faixa hachurada por fora, como em planta de verdade */}
        <rect
          x={-0.7}
          y={-0.7}
          width={comp + 1.4}
          height={larg + 1.4}
          fill="url(#hachura)"
          stroke="#334155"
          strokeWidth={0.18}
        />

        {/* piso */}
        <rect
          data-fundo="1"
          x={0}
          y={0}
          width={comp}
          height={larg}
          fill="#ffffff"
          stroke="#334155"
          strokeWidth={0.18}
        />

        {/* quadrante sob o mouse: acende enquanto o ponteiro está dentro do
            galpão e some assim que ele sai. */}
        {quadrante && (
          <g pointerEvents="none">
            <rect
              x={quadrante.x}
              y={quadrante.y}
              width={quadrante.w}
              height={quadrante.h}
              fill="#bae6fd"
              opacity={0.38}
              stroke="#0284c7"
              strokeWidth={0.16}
            />
            <rect
              x={quadrante.x + 0.35}
              y={quadrante.y + 0.35}
              width={Math.max(2.2, fonteRegua * 2.8)}
              height={Math.max(1.25, fonteRegua * 1.55)}
              rx={0.28}
              fill="#0f172a"
              opacity={0.88}
            />
            <text
              x={quadrante.x + 0.7}
              y={quadrante.y + 0.35 + Math.max(1.25, fonteRegua * 1.55) * 0.68}
              fontSize={Math.max(0.85, fonteRegua * 0.95)}
              fill="#ffffff"
              fontFamily="ui-monospace, monospace"
              fontWeight="700"
            >
              {quadrante.endereco.curto}
            </text>
          </g>
        )}

        {/* grade do endereço */}
        <g pointerEvents="none" stroke="#cbd5e1" strokeWidth={0.07} strokeDasharray="0.9 0.7">
          {vaos.slice(1, -1).map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={larg} />
          ))}
          {faixas.slice(1, -1).map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={comp} y2={y} />
          ))}
        </g>

        {/* pilares das duas laterais, plantados em cima da linha da parede */}
        {temPilar && (
          <g fill="#334155">
            {pilares.map((x) => (
              <g key={`pil${x}`}>
                <rect
                  x={x - LADO_PILAR / 2}
                  y={-LADO_PILAR / 2}
                  width={LADO_PILAR}
                  height={LADO_PILAR}
                />
                <rect
                  x={x - LADO_PILAR / 2}
                  y={larg - LADO_PILAR / 2}
                  width={LADO_PILAR}
                  height={LADO_PILAR}
                />
              </g>
            ))}
          </g>
        )}

        {/* letra da faixa na lateral: cruzando com o número do vão sai o
            endereço, do mesmo jeito que se lê um tabuleiro ou um mapa */}
        {faixas.slice(0, -1).map((y, i) => (
          <text
            key={`fx${i}`}
            x={-1.5}
            y={(y + faixas[i + 1]) / 2 + fonteRegua * 0.35}
            fontSize={fonteRegua}
            fill="#94a3b8"
            textAnchor="middle"
            pointerEvents="none"
          >
            {letraFaixa(i)}
          </text>
        ))}

        {/* número do vão, para poder dizer "está no vão 7" */}
        {vaos.slice(0, -1).map((x, i) => (
            <text
              key={`vao${i}`}
              x={(x + vaos[i + 1]) / 2}
              y={-0.9}
              fontSize={fonteRegua}
              fill="#94a3b8"
              textAnchor="middle"
              pointerEvents="none"
            >
            {i + 1}
          </text>
        ))}

        {/* cotas do galpão */}
        <g stroke="#94a3b8" strokeWidth={0.07} fill="#64748b">
          <line x1={0} y1={-2.4} x2={comp} y2={-2.4} />
          <line x1={0} y1={-3} x2={0} y2={-1.8} />
          <line x1={comp} y1={-3} x2={comp} y2={-1.8} />
          <text
            x={comp / 2}
            y={-3.2}
            fontSize={fonteCota}
            textAnchor="middle"
            stroke="none"
            fontWeight="600"
          >
            {comp} m
          </text>

          <line x1={-2.4} y1={0} x2={-2.4} y2={larg} />
          <line x1={-3} y1={0} x2={-1.8} y2={0} />
          <line x1={-3} y1={larg} x2={-1.8} y2={larg} />
          <text
            x={-3.2}
            y={larg / 2}
            fontSize={fonteCota}
            textAnchor="middle"
            stroke="none"
            fontWeight="600"
            transform={`rotate(-90 ${-3.2} ${larg / 2})`}
          >
            {larg} m
          </text>
        </g>

        {/* máquinas */}
        {maquinas.map((m) => {
          const c = caixa(m)
          const paleta = cor(camada, m, ctx)
          const escolhida = selecionada === m.ativo_id
          const realcada = sobMouse === m.ativo_id
          const movendo = arrastando === m.ativo_id
          const fs = Math.min(c.h * 0.28, c.w * 0.13, 1.1)
          const cabeNome = c.h >= 1.8 && c.w >= 4
          const cabeCodigo = c.h >= 1.1 && c.w >= 2.4
          const corte = Math.max(3, Math.floor(c.w / (fs * 0.58)))

          return (
            <g
              key={m.ativo_id}
              onPointerDown={(e) => {
                e.stopPropagation()
                if (rotaEditando) {
                  const p = paraMetros(e)
                  aoCliqueVazioRota?.(p.x, p.y)
                  return
                }
                if (modoEnergia && quadroSelecionado) {
                  aoLigarMaquina?.(m.ativo_id)
                  return
                }
                aoSelecionar?.(m)
                aoApertar(e, m)
              }}
              onPointerEnter={() => {
                if (arrastando) return
                setSobMouse(m.ativo_id)
                aoPassarMouse?.(m)
              }}
              onPointerLeave={() => {
                if (arrastando) return
                setSobMouse(null)
                aoPassarMouse?.(null)
              }}
              style={{ cursor: modoEditar ? 'move' : 'pointer' }}
              opacity={movendo ? 0.75 : 1}
            >
              <rect
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                rx={0.25}
                fill={paleta.fundo}
                stroke={escolhida || realcada ? '#0f172a' : paleta.borda}
                strokeWidth={escolhida ? 0.34 : realcada ? 0.24 : 0.16}
                strokeDasharray={c.estimada ? '0.6 0.4' : undefined}
              />

              {cabeNome && (
                <text
                  x={c.x + c.w / 2}
                  y={c.y + c.h / 2 - fs * 0.12}
                  fontSize={fs}
                  fill={paleta.texto}
                  textAnchor="middle"
                  fontWeight="700"
                  pointerEvents="none"
                >
                  {m.nome.length > corte ? `${m.nome.slice(0, corte - 1)}…` : m.nome}
                </text>
              )}
              {cabeCodigo && (
                <text
                  x={c.x + c.w / 2}
                  y={c.y + c.h / 2 + (cabeNome ? fs * 1.05 : fs * 0.35)}
                  fontSize={fs * (cabeNome ? 0.78 : 0.92)}
                  fill={paleta.texto}
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                  opacity={0.85}
                  pointerEvents="none"
                >
                  {m.codigo}
                </text>
              )}

              {/* nas outras camadas a cor não conta a situação, então ela volta
                  como um ponto no canto: saber se está rodando nunca se perde */}
              {camada !== 'situacao' && (
                <circle
                  cx={c.x + c.w - 0.55}
                  cy={c.y + 0.55}
                  r={0.34}
                  fill={cor('situacao', m).borda}
                  stroke="#ffffff"
                  strokeWidth={0.1}
                  pointerEvents="none"
                />
              )}

              {Number(m.os_abertas) > 0 && (
                <g pointerEvents="none">
                  <circle cx={c.x + 0.6} cy={c.y + 0.6} r={0.42} fill="#0f172a" />
                  <text
                    x={c.x + 0.6}
                    y={c.y + 0.83}
                    fontSize={0.62}
                    fill="#ffffff"
                    textAnchor="middle"
                    fontWeight="700"
                  >
                    {m.os_abertas}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* -------------------------------------------------------- energia
            Cabo do quadro até a máquina, clipado na borda das duas caixas
            (senão a linha entra por baixo do retângulo e a ponta some).
            Anima só quando a máquina está de fato operando — parada não
            "puxa corrente", é literalmente isso que se quer enxergar. */}
        {modoEnergia && (
          <g>
            <defs>
              {/* brilho da partícula de corrente — sem isso ela é só uma
                  bolinha correndo, com isso parece elétrica de verdade */}
              <filter id="brilho-energia" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="0.11" result="halo" />
                <feMerge>
                  <feMergeNode in="halo" />
                  <feMergeNode in="halo" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {quadros
              .filter((q) => q.pos_x_m != null)
              .map((q) => {
                const ligadas = maquinas.filter(
                  (m) => m.quadro_id === q.quadro_id && m.pos_x_m != null && m.pos_y_m != null
                )
                return ligadas.map((m) => {
                  const emEdicao = rotaEditando?.ativoId === m.ativo_id
                  const pontosMeio = emEdicao ? rotaEditando.pontos : m.cabo_pontos || []
                  const pts = pontosCabo(q, pontosMeio, m)
                  const d = caminhoSvg(pts)
                  const operando = m.situacao === 'operando'
                  return (
                    <g key={`cabo-${q.quadro_id}-${m.ativo_id}`}>
                      {/* o fio físico — sempre visível, apagado quando parada */}
                      <path
                        d={d}
                        fill="none"
                        stroke={corEsquema}
                        strokeWidth={emEdicao ? 0.24 : 0.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={operando ? undefined : '0.22 0.45'}
                        opacity={emEdicao ? 1 : operando ? 0.55 : 0.4}
                      />
                      {/* área de clique mais larga — o fio fino sozinho é
                          punheta de acertar no touch */}
                      {!rotaEditando && (
                        <path
                          d={d}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={1}
                          style={{ cursor: 'pointer' }}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            aoClicarCabo?.(m.ativo_id)
                          }}
                        />
                      )}
                      {/* partículas de corrente correndo pelo caminho real,
                          curvas incluídas — animateMotion segue o "d" certinho */}
                      {operando &&
                        !reduzMovimento &&
                        [0, 1, 2].map((i) => (
                          <circle key={i} r={0.16} fill="#fef9c3" filter="url(#brilho-energia)">
                            <animateMotion
                              dur="1.4s"
                              begin={`${i * 0.47}s`}
                              repeatCount="indefinite"
                              path={d}
                            />
                          </circle>
                        ))}
                      {emEdicao &&
                        pontosMeio.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={0.28}
                            fill="#ffffff"
                            stroke={corEsquema}
                            strokeWidth={0.14}
                            style={{ cursor: 'pointer' }}
                            onPointerDown={(e) => {
                              e.stopPropagation()
                              aoRemoverPontoRota?.(i)
                            }}
                          />
                        ))}
                    </g>
                  )
                })
              })}

            {quadros
              .filter((q) => q.pos_x_m != null)
              .map((q) => {
                const cQ = caixaQuadro(q)
                const armado = quadroSelecionado === q.quadro_id
                return (
                  <g
                    key={q.quadro_id}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      if (rotaEditando) {
                        const p = paraMetros(e)
                        aoCliqueVazioRota?.(p.x, p.y)
                        return
                      }
                      aoSelecionarQuadro?.(armado ? null : q)
                      aoApertar(e, null, q)
                    }}
                    style={{ cursor: rotaEditando ? 'crosshair' : modoEditar ? 'move' : 'pointer' }}
                  >
                    {armado && (
                      <circle cx={cQ.cx} cy={cQ.cy} r={cQ.w * 0.95} fill="none"
                        stroke={corEsquema} strokeWidth={0.14} strokeDasharray="0.3 0.3" opacity={0.7} />
                    )}
                    <rect
                      x={cQ.x}
                      y={cQ.y}
                      width={cQ.w}
                      height={cQ.h}
                      rx={0.2}
                      fill="#0f172a"
                      stroke={armado ? corEsquema : '#ffffff'}
                      strokeWidth={armado ? 0.24 : 0.14}
                      transform={`rotate(45 ${cQ.cx} ${cQ.cy})`}
                    />
                    <text
                      x={cQ.cx}
                      y={cQ.cy + 0.42}
                      fontSize={0.85}
                      fill="#ffffff"
                      textAnchor="middle"
                      fontWeight="700"
                      pointerEvents="none"
                    >
                      ⚡
                    </text>
                    <text
                      x={cQ.cx}
                      y={cQ.y - 0.35}
                      fontSize={1.05}
                      fill={corEsquema}
                      textAnchor="middle"
                      fontWeight="700"
                      pointerEvents="none"
                    >
                      {q.tag || q.nome}
                    </text>
                  </g>
                )
              })}
          </g>
        )}

        {/* ------------------------------------------------ fluxo do processo
            Desenhado por cima das máquinas de propósito: o caminho é a leitura
            principal quando está ligado, e some inteiro quando está desligado. */}
        {mostrarFluxo && (
          <g>
            {ligacoes.map((l) => {
              const de = etapas.find((e) => e.etapa_id === l.de_id)
              if (!de || de.pos_x_m == null) return null
              const cDe = caixaEtapa(de)
              const alt = l.tipo === 'alternativa'
              const traco = alt ? '1.4 1' : undefined
              const corLinha = corEsquema
              const opacidade = alt ? 0.72 : 1
              const ponta = 'url(#ponta-esquema)'

              const para = etapas.find((e) => e.etapa_id === l.para_id)
              const dentro = para && para.pos_x_m != null && para.planta_id === de.planta_id

              // destino em outro galpão: a seta aponta para a parede mais perto
              // e leva o nome do destino escrito do lado de fora
              if (!dentro) {
                const saida = saidaNaParede(cDe, planta)
                const ini = pontoNaBorda(cDe, saida.fora.x, saida.fora.y)
                return (
                  <g key={l.ligacao_id} pointerEvents="none" opacity={opacidade}>
                    <line
                      x1={ini.x}
                      y1={ini.y}
                      x2={saida.fora.x}
                      y2={saida.fora.y}
                      stroke={corLinha}
                      strokeWidth={0.34}
                      strokeDasharray={traco}
                      markerEnd={ponta}
                    />
                    <text
                      x={saida.fora.x + (saida.lado === 'dir' ? 1 : saida.lado === 'esq' ? -1 : 0)}
                      y={saida.fora.y + (saida.lado === 'baixo' ? 1.5 : saida.lado === 'cima' ? -0.7 : 0.5)}
                      fontSize={1.35}
                      fill={corLinha}
                      fontWeight="700"
                      textAnchor={saida.lado === 'esq' ? 'end' : saida.lado === 'dir' ? 'start' : 'middle'}
                    >
                      → {l.para_nome}
                    </text>
                  </g>
                )
              }

              const cPara = caixaEtapa(para)
              const a = pontoNaBorda(cDe, cPara.cx, cPara.cy)
              const b = pontoNaBorda(cPara, cDe.cx, cDe.cy)
              return (
                <g key={l.ligacao_id} pointerEvents="none" opacity={opacidade}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={corLinha}
                    strokeWidth={0.34}
                    strokeDasharray={traco}
                    markerEnd={ponta}
                  />
                  {l.rotulo && (
                    <text
                      x={(a.x + b.x) / 2}
                      y={(a.y + b.y) / 2 - 0.6}
                      fontSize={1.15}
                      fill={corLinha}
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {l.rotulo}
                    </text>
                  )}
                </g>
              )
            })}

            {etapas
              .filter((e) => e.pos_x_m != null && e.planta_id === planta.id)
              .map((e) => {
                const c = caixaEtapa(e)
                const escolhida = etapaSelecionada === e.etapa_id
                const temParada = Number(e.maquinas_paradas) > 0
                return (
                  <g
                    key={e.etapa_id}
                    onPointerDown={(ev) => {
                      ev.stopPropagation()
                      aoSelecionarEtapa?.(e)
                      aoApertar(ev, { etapa_id: e.etapa_id, pos_x_m: e.pos_x_m, pos_y_m: e.pos_y_m })
                    }}
                    style={{ cursor: modoEditar ? 'move' : 'pointer' }}
                  >
                    <rect
                      x={c.x}
                      y={c.y}
                      width={c.w}
                      height={c.h}
                      rx={c.h / 2}
                      fill="#ffffff"
                      opacity={0.96}
                      stroke={temParada ? '#dc2626' : escolhida ? '#0f172a' : corEsquema}
                      strokeWidth={escolhida || temParada ? 0.36 : 0.22}
                    />
                    <text
                      x={c.cx}
                      y={c.cy + 0.48}
                      fontSize={1.35}
                      fill={temParada ? '#991b1b' : corEsquema}
                      textAnchor="middle"
                      fontWeight="700"
                      pointerEvents="none"
                    >
                      {e.nome}
                    </text>
                    {temParada && (
                      <g pointerEvents="none">
                        <circle cx={c.x + c.w - 0.9} cy={c.y + 0.5} r={0.62} fill="#dc2626" />
                        <text
                          x={c.x + c.w - 0.9}
                          y={c.y + 0.85}
                          fontSize={0.85}
                          fill="#ffffff"
                          textAnchor="middle"
                          fontWeight="700"
                        >
                          {e.maquinas_paradas}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
          </g>
        )}
      </g>

      {/* Leitura do ponto sob o cursor. Fica FORA do grupo do zoom de
          propósito: é informação de tela, não desenho do galpão, então não
          pode crescer nem sumir quando se aproxima. */}
      {cursor &&
        (() => {
          // O endereço sai do MESMO número que aparece escrito ao lado dele.
          // Calcular um com a posição crua e escrever o outro arredondado faz a
          // leitura se contradizer perto das bordas: "x 36,0 m" no vão 6.
          const mx = Math.round(cursor.x * 10) / 10
          const my = Math.round(cursor.y * 10) / 10
          const e = endereco(mx, my, planta)
          const texto = `${e.completo}   ·   x ${mx.toFixed(1)} m   y ${my.toFixed(1)} m`
          const fs = fonteRegua * 1.15
          const largura = texto.length * fs * 0.62 + fs * 1.4
          return (
            <g pointerEvents="none">
              <rect
                x={-FOLGA + 0.6}
                y={larg + FOLGA - fs * 2.2}
                width={largura}
                height={fs * 1.8}
                rx={fs * 0.4}
                fill="#0f172a"
                opacity={0.88}
              />
              <text
                x={-FOLGA + 0.6 + fs * 0.5}
                y={larg + FOLGA - fs * 0.9}
                fontSize={fs}
                fill="#ffffff"
                fontFamily="ui-monospace, monospace"
              >
                {texto}
              </text>
            </g>
          )
        })()}
    </svg>
  )
}
