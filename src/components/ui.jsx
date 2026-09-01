import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Loader2, X, Inbox, AlertTriangle, CheckCircle2 } from 'lucide-react'

/* ---------------------------------------------------------------- Botão */

/* O botão cheio leva um fio de luz na borda de cima (o `inset` claro):
   é o que faz a peça parecer levemente abaulada em vez de um adesivo
   chapado. A sombra colorida embaixo vem da própria cor do botão, não
   um cinza genérico — é assim que a luz se comporta de verdade. */
const VARIANTES = {
  primario:
    'bg-sky-600 text-white hover:bg-sky-500 shadow-[0_1px_2px_rgb(2_132_199/0.3),0_4px_12px_-2px_rgb(2_132_199/0.35),inset_0_1px_0_rgb(255_255_255/0.18)] hover:shadow-[0_2px_4px_rgb(2_132_199/0.3),0_8px_20px_-4px_rgb(2_132_199/0.45),inset_0_1px_0_rgb(255_255_255/0.18)]',
  secundario:
    'bg-white text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 shadow-[var(--alt-1)]',
  perigo:
    'bg-red-600 text-white hover:bg-red-500 shadow-[0_1px_2px_rgb(220_38_38/0.3),0_4px_12px_-2px_rgb(220_38_38/0.35),inset_0_1px_0_rgb(255_255_255/0.18)]',
  sucesso:
    'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_1px_2px_rgb(5_150_105/0.3),0_4px_12px_-2px_rgb(5_150_105/0.35),inset_0_1px_0_rgb(255_255_255/0.18)]',
  fantasma: 'text-slate-600 hover:bg-slate-100',
}

const TAMANHOS = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-3.5 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-sm gap-2 rounded-xl',
}

export function Botao({
  variante = 'primario',
  tamanho = 'md',
  carregando = false,
  className = '',
  children,
  disabled,
  ...props
}) {
  return (
    <button
      disabled={disabled || carregando}
      style={{ transitionTimingFunction: 'var(--ease-mola)' }}
      className={`inline-flex items-center justify-center font-medium
        transition-all duration-200 active:scale-[0.97] active:duration-75
        disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100
        disabled:shadow-none
        ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${className}`}
      {...props}
    >
      {carregando && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- Cartão */

/* `elevacao` escolhe a altura da peça e `flutua` liga o levantar no
   passar do mouse — usado nos cartões que são clicáveis, pra dizer com
   movimento aquilo que uma borda azul diria com enfeite. */
export function Cartao({ className = '', elevacao = 1, flutua = false, style, children, ...props }) {
  return (
    <div
      // O style de quem chama entra POR CIMA do nosso, não no lugar dele —
      // espalhar `props` cru aqui apagaria fundo e sombra de todo cartão
      // que precisa de uma variável própria (a planta passa a proporção).
      style={{
        boxShadow: `var(--alt-${elevacao}), 0 0 0 1px var(--traco)`,
        backgroundColor: 'var(--sup-cartao)',
        transitionTimingFunction: 'var(--ease-mola)',
        ...style,
      }}
      className={`rounded-xl transition-all duration-300 ${
        flutua ? 'hover:-translate-y-0.5 hover:shadow-[var(--alt-3),0_0_0_1px_var(--traco)]' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CartaoTitulo({ children, acao }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3.5"
      style={{ borderBottom: '1px solid var(--traco)' }}
    >
      <h3 className="text-sm font-semibold text-slate-800">{children}</h3>
      {acao}
    </div>
  )
}

/* -------------------------------------------------------------- Etiqueta */

export function Etiqueta({ cor = 'bg-slate-100 text-slate-600 ring-slate-200', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold
        whitespace-nowrap ring-1 ring-inset ${cor}`}
    >
      {children}
    </span>
  )
}

/* ---------------------------------------------------------- Segmentado */

/**
 * Controle de segmento: as opções ficam todas à vista e o indicador
 * escorrega até a escolhida. Melhor que um menu suspenso quando são
 * poucas opções — mostra o que existe sem precisar abrir, e o dedo
 * acerta de primeira no celular.
 */
export function Segmentado({ valor, aoMudar, opcoes, className = '' }) {
  const i = Math.max(0, opcoes.findIndex((o) => o.valor === valor))
  return (
    <div
      className={`relative inline-flex rounded-xl p-1 ${className}`}
      style={{ backgroundColor: 'var(--sup-suave)', boxShadow: 'inset 0 0 0 1px var(--traco)' }}
      role="tablist"
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-lg transition-transform duration-300"
        style={{
          width: `calc((100% - 0.5rem) / ${opcoes.length})`,
          transform: `translateX(${i * 100}%)`,
          transitionTimingFunction: 'var(--ease-mola)',
          backgroundColor: 'var(--sup-cartao)',
          boxShadow: 'var(--alt-2)',
        }}
      />
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={o.valor === valor}
          onClick={() => aoMudar(o.valor)}
          className={`relative z-10 flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-semibold
            whitespace-nowrap transition-colors duration-200 ${
              o.valor === valor ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ Formulário */

export function Campo({ rotulo, erro, dica, children, className = '' }) {
  return (
    <div className={className}>
      {rotulo && <label className="rotulo">{rotulo}</label>}
      {children}
      {dica && !erro && <p className="mt-1 text-xs text-slate-400">{dica}</p>}
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
    </div>
  )
}

export const Entrada = (props) => <input {...props} className={`campo ${props.className || ''}`} />
export const Area = (props) => <textarea {...props} className={`campo ${props.className || ''}`} />
export const Selecao = (props) => <select {...props} className={`campo ${props.className || ''}`} />

/* ------------------------------------------------------------------ Modal */

export function Modal({ aberto, aoFechar, titulo, largura = 'max-w-lg', children, rodape }) {
  useEffect(() => {
    if (!aberto) return
    const fecharComEsc = (e) => e.key === 'Escape' && aoFechar?.()
    document.addEventListener('keydown', fecharComEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', fecharComEsc)
      document.body.style.overflow = ''
    }
  }, [aberto, aoFechar])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      {/* O fundo desfocado é o que separa a janela do resto: em vez de
          jogar uma cortina preta por cima, empurra a tela pra trás. */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[3px]"
        style={{ animation: 'sgai-entra 0.2s ease-out both' }}
        onClick={aoFechar}
        aria-hidden
      />
      {/* No celular sobe de baixo como folha (com a alcinha de arrastar);
          no computador surge no meio. Cada formato no seu lugar. */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          backgroundColor: 'var(--sup-alto)',
          boxShadow: 'var(--alt-4), 0 0 0 1px var(--traco)',
        }}
        className={`relative flex max-h-[92vh] w-full ${largura} flex-col rounded-t-2xl
          sobe sm:surge sm:rounded-2xl`}
      >
        <div className="shrink-0 pt-2 pb-0 sm:hidden">
          <div className="mx-auto h-1 w-9 rounded-full bg-slate-300" />
        </div>
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--traco)' }}
        >
          <h2 className="text-base font-semibold text-slate-800">{titulo}</h2>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && (
          <div
            className="flex justify-end gap-2 px-5 py-3"
            style={{ borderTop: '1px solid var(--traco)' }}
          >
            {rodape}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- Estados */

export function Carregando({ texto = 'Carregando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
      <Loader2 size={16} className="animate-spin" />
      {texto}
    </div>
  )
}

/** Placeholder do formato do que está vindo — some sensação de "travou", não só de "carregando". */
export function Esqueleto({ className = '' }) {
  return <div className={`esqueleto ${className}`} />
}

/** Grade de cartões de indicador no formato final, para trocar pelo conteúdo real assim que chegar. */
export function EsqueletoIndicadores({ n = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <Cartao key={i} className="p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <Esqueleto className="h-3 w-20" />
              <Esqueleto className="h-6 w-14" />
              <Esqueleto className="h-3 w-24" />
            </div>
            <Esqueleto className="size-5 shrink-0 rounded-full" />
          </div>
        </Cartao>
      ))}
    </div>
  )
}

/**
 * Número que sobe até o valor final em vez de aparecer pronto — o
 * primeiro segundo de uma tela de KPI é quando ela mais parece viva.
 * Só anima em mudanças de valor; a primeira aparição já entra no valor certo
 * se a pessoa pediu menos movimento.
 */
export function NumeroAnimado({ valor, formatar = (v) => v, duracaoMs = 600 }) {
  const [exibido, setExibido] = useState(valor)
  const anterior = useRef(valor)
  const reduzMovimento = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const de = anterior.current
    const para = Number(valor) || 0
    anterior.current = para
    if (reduzMovimento.current || de === para || Number.isNaN(de)) {
      setExibido(para)
      return
    }
    const t0 = performance.now()
    let quadro
    const passo = (agora) => {
      const p = Math.min(1, (agora - t0) / duracaoMs)
      const suave = 1 - (1 - p) * (1 - p) // ease-out
      setExibido(de + (para - de) * suave)
      if (p < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [valor, duracaoMs])

  return formatar(exibido)
}

export function Vazio({ icone: Icone = Inbox, titulo, descricao, acao }) {
  return (
    <div className="entra flex flex-col items-center justify-center px-6 py-14 text-center">
      {/* Halo em volta do ícone: dá um centro visual pro vazio, em vez de
          deixar a área parecendo que faltou carregar alguma coisa. */}
      <div
        className="mb-4 rounded-2xl p-3.5 text-slate-400"
        style={{
          backgroundColor: 'var(--sup-suave)',
          boxShadow: 'inset 0 0 0 1px var(--traco)',
        }}
      >
        <Icone size={22} strokeWidth={1.75} />
      </div>
      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
      {descricao && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-400">{descricao}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  )
}

export function Erro({ erro }) {
  if (!erro) return null
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-200 ring-inset">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{erro.message || String(erro)}</span>
    </div>
  )
}

/* -------------------------------------------------------------- Tabela */

export function Tabela({ children, className = '' }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-full text-sm ${className}`}>{children}</table>
    </div>
  )
}

export const Th = ({ children, className = '' }) => (
  <th
    className={`bg-slate-50/70 px-4 py-2.5 text-left text-[11px]
      font-semibold tracking-[0.06em] text-slate-500 uppercase whitespace-nowrap ${className}`}
    style={{ borderBottom: '1px solid var(--traco)' }}
  >
    {children}
  </th>
)

export const Td = ({ children, className = '' }) => (
  <td
    className={`px-4 py-3 align-middle ${className}`}
    style={{ borderBottom: '1px solid var(--traco)' }}
  >
    {children}
  </td>
)

/* --------------------------------------------------------------- Avisos */

const AvisoCtx = createContext(null)
export const useAviso = () => useContext(AvisoCtx)

export function ProvedorAviso({ children }) {
  const [avisos, setAvisos] = useState([])

  const avisar = (mensagem, tipo = 'ok') => {
    const id = crypto.randomUUID()
    setAvisos((a) => [...a, { id, mensagem, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4500)
  }

  return (
    <AvisoCtx.Provider value={avisar}>
      {children}
      {/* No celular o aviso desce do topo (onde o polegar não tapa e não
          briga com o teclado); no computador fica no canto de baixo. */}
      <div
        className="nao-imprimir pointer-events-none fixed inset-x-4 top-4 z-100 flex flex-col gap-2
          sm:inset-x-auto sm:top-auto sm:right-5 sm:bottom-5 sm:items-end"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            style={{
              boxShadow: 'var(--alt-4)',
              animation: 'sgai-entra-conteudo 0.3s var(--ease-mola) both',
            }}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 overflow-hidden
              rounded-xl px-4 py-3 text-sm font-medium ring-1 ring-inset backdrop-blur-xl ${
                a.tipo === 'erro'
                  ? 'bg-red-50/95 text-red-800 ring-red-200'
                  : 'bg-emerald-50/95 text-emerald-800 ring-emerald-200'
              }`}
          >
            {a.tipo === 'erro' ? (
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            )}
            {a.mensagem}
          </div>
        ))}
      </div>
    </AvisoCtx.Provider>
  )
}
