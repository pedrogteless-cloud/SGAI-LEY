import { useCallback, useEffect, useRef, useState } from 'react'
import { GripVertical, Pencil, Trash2, Copy } from 'lucide-react'
import {
  COLUNAS, moverBloco, redimensionarBloco, alturaDaGrade, ordemDeLeitura,
} from '../../lib/painelGrade'

/**
 * A grade onde os blocos ficam e são arrastados.
 *
 * Posição absoluta em cima de uma grade de 12 colunas, com a largura da
 * coluna medida do container — assim o mesmo painel cabe num notebook e
 * numa TV sem ninguém reconfigurar nada.
 *
 * No celular a grade vira uma coluna só, na ordem de leitura, e não
 * arrasta: quem monta o painel monta sentado; quem está no galpão só olha.
 * Fingir que dá pra arrastar num toque de 3 mm seria pior que não ter.
 */

const ALTURA_LINHA = 72
const ESPACO = 12
const LARGURA_MINIMA_PRA_ARRASTAR = 700

export default function GradePainel({ blocos, aoMudar, montando, aoEditar, aoRemover, aoDuplicar, renderizar }) {
  const containerRef = useRef(null)
  const [largura, setLargura] = useState(0)
  const [acao, setAcao] = useState(null)

  useEffect(() => {
    const alvo = containerRef.current
    if (!alvo) return
    const medir = () => setLargura(alvo.clientWidth)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(alvo)
    return () => observador.disconnect()
  }, [])

  const empilhado = largura > 0 && largura < LARGURA_MINIMA_PRA_ARRASTAR
  const larguraColuna = largura ? (largura - ESPACO * (COLUNAS - 1)) / COLUNAS : 0
  const podeArrastar = montando && !empilhado

  const aoMexer = useCallback(
    (evento) => {
      if (!acao) return
      const dx = evento.clientX - acao.px
      const dy = evento.clientY - acao.py
      const passoX = Math.round(dx / (larguraColuna + ESPACO))
      const passoY = Math.round(dy / (ALTURA_LINHA + ESPACO))
      if (passoX === acao.ultimoX && passoY === acao.ultimoY) return

      const original = acao.original
      const proximos = acao.modo === 'mover'
        ? moverBloco(blocos, acao.id, { x: original.x + passoX, y: original.y + passoY })
        : redimensionarBloco(blocos, acao.id, { w: original.w + passoX, h: original.h + passoY })

      setAcao((a) => (a ? { ...a, ultimoX: passoX, ultimoY: passoY } : a))
      aoMudar(proximos)
    },
    [acao, blocos, larguraColuna, aoMudar]
  )

  const aoSoltar = useCallback(() => setAcao(null), [])

  useEffect(() => {
    if (!acao) return
    window.addEventListener('pointermove', aoMexer)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('pointercancel', aoSoltar)
    return () => {
      window.removeEventListener('pointermove', aoMexer)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoSoltar)
    }
  }, [acao, aoMexer, aoSoltar])

  const começar = (evento, bloco, modo) => {
    if (!podeArrastar) return
    evento.preventDefault()
    setAcao({
      id: bloco.id,
      modo,
      px: evento.clientX,
      py: evento.clientY,
      original: { x: bloco.x, y: bloco.y, w: bloco.w, h: bloco.h },
      ultimoX: 0,
      ultimoY: 0,
    })
  }

  const lista = empilhado ? ordemDeLeitura(blocos) : blocos
  const alturaTotal = empilhado ? undefined : alturaDaGrade(blocos) * (ALTURA_LINHA + ESPACO)

  return (
    <div
      ref={containerRef}
      className={empilhado ? 'flex flex-col gap-3' : 'relative'}
      style={empilhado ? undefined : { height: Math.max(alturaTotal || 0, ALTURA_LINHA) }}
    >
      {lista.map((bloco) => {
        const posicao = empilhado
          ? undefined
          : {
              position: 'absolute',
              left: bloco.x * (larguraColuna + ESPACO),
              top: bloco.y * (ALTURA_LINHA + ESPACO),
              width: bloco.w * larguraColuna + (bloco.w - 1) * ESPACO,
              height: bloco.h * ALTURA_LINHA + (bloco.h - 1) * ESPACO,
            }
        const emAcao = acao?.id === bloco.id
        return (
          <div
            key={bloco.id}
            style={{
              ...posicao,
              // Sem transição enquanto arrasta: o bloco tem que grudar no
              // dedo. Os outros, que estão sendo empurrados, deslizam.
              transition: emAcao ? 'none' : 'left 0.15s, top 0.15s, width 0.15s, height 0.15s',
              backgroundColor: 'var(--sup-cartao)',
              border: '1px solid var(--traco)',
              boxShadow: emAcao ? 'var(--alt-4)' : undefined,
              minHeight: empilhado ? bloco.h * ALTURA_LINHA : undefined,
            }}
            className={`flex flex-col overflow-hidden rounded-xl ${emAcao ? 'z-20' : ''}`}
          >
            <div
              className={`flex shrink-0 items-center gap-1.5 px-3 py-2 ${podeArrastar ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ borderBottom: bloco.tipo === 'texto' ? 'none' : '1px solid var(--traco)' }}
              onPointerDown={(e) => começar(e, bloco, 'mover')}
            >
              {podeArrastar && <GripVertical size={13} className="shrink-0 text-slate-300" />}
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">
                {bloco.titulo || 'Sem título'}
              </p>
              {montando && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <BotaoBloco titulo="Editar" onClick={() => aoEditar(bloco)}><Pencil size={13} /></BotaoBloco>
                  <BotaoBloco titulo="Duplicar" onClick={() => aoDuplicar(bloco)}><Copy size={13} /></BotaoBloco>
                  <BotaoBloco titulo="Remover" perigo onClick={() => aoRemover(bloco)}><Trash2 size={13} /></BotaoBloco>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1">{renderizar(bloco)}</div>

            {podeArrastar && (
              <div
                onPointerDown={(e) => { e.stopPropagation(); começar(e, bloco, 'redimensionar') }}
                className="absolute right-0 bottom-0 size-4 cursor-nwse-resize"
                title="Arraste para redimensionar"
              >
                <span className="absolute right-1 bottom-1 size-2 rounded-sm border-r-2 border-b-2 border-slate-300" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function BotaoBloco({ titulo, perigo, onClick, children }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={`rounded p-1 transition-colors ${
        perigo ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}
