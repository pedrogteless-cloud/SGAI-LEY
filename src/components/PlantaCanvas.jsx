import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { caixa, cor, encaixar, prender } from '../lib/planta'

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
}) {
  const svgRef = useRef(null)
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 })
  const [arrastando, setArrastando] = useState(null)
  const [sobMouse, setSobMouse] = useState(null)

  const ponteiros = useRef(new Map())
  const gesto = useRef(null)

  const comp = Number(planta.comprimento_m)
  const larg = Number(planta.largura_m)

  const encaixarNaTela = useCallback(() => setVista({ x: 0, y: 0, k: 1 }), [])
  useImperativeHandle(refCamera, () => ({
    encaixar: encaixarNaTela,
    aproximar: () => setVista((v) => ({ ...v, k: limitar(v.k * 1.3, MIN_K, MAX_K) })),
    afastar: () => setVista((v) => ({ ...v, k: limitar(v.k / 1.3, MIN_K, MAX_K) })),
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

  const aoApertar = (e, maquina = null) => {
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

    if (maquina && modoEditar) {
      const p = paraMetros(e)
      const c = caixa(maquina)
      gesto.current = { tipo: 'maquina', id: maquina.ativo_id, dx: p.x - c.x, dy: p.y - c.y }
      setArrastando(maquina.ativo_id)
      return
    }

    gesto.current = { tipo: 'navegar', ultimo: paraSvg(e) }
  }

  const aoMexer = (e) => {
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

    if (gesto.current.tipo === 'maquina') {
      const p = paraMetros(e)
      const m = maquinas.find((x) => x.ativo_id === gesto.current.id)
      if (!m) return
      const c = caixa(m)
      const preso = prender(
        encaixar(p.x - gesto.current.dx),
        encaixar(p.y - gesto.current.dy),
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
    if (ponteiros.current.size === 0) {
      gesto.current = null
      setArrastando(null)
    } else if (gesto.current?.tipo === 'pinca') {
      gesto.current = null
    }
  }

  // Grade a cada 5 m, que é a leitura natural de quem anda no galpão
  const linhasV = []
  for (let x = 5; x < comp; x += 5) linhasV.push(x)
  const linhasH = []
  for (let y = 5; y < larg; y += 5) linhasH.push(y)

  const fonteCota = Math.max(comp, larg) / 45

  return (
    <svg
      ref={svgRef}
      data-planta="1"
      viewBox={`${-FOLGA} ${-FOLGA} ${comp + FOLGA * 2} ${larg + FOLGA * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full touch-none select-none"
      style={{ cursor: arrastando ? 'grabbing' : modoEditar ? 'default' : 'grab' }}
      onPointerDown={(e) => {
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
      }}
    >
      <defs>
        <pattern id="hachura" width="1.4" height="1.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="1.4" stroke="#cbd5e1" strokeWidth="0.35" />
        </pattern>
      </defs>

      <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
        {/* piso */}
        <rect data-fundo="1" x={0} y={0} width={comp} height={larg} fill="#ffffff" />

        {/* grade de 5 m */}
        <g stroke="#e2e8f0" strokeWidth={0.06}>
          {linhasV.map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={larg} />
          ))}
          {linhasH.map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={comp} y2={y} />
          ))}
        </g>

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
      </g>
    </svg>
  )
}
