import { createContext, useContext, useEffect, useState } from 'react'
import { Loader2, X, Inbox, AlertTriangle, CheckCircle2 } from 'lucide-react'

/* ---------------------------------------------------------------- Botão */

const VARIANTES = {
  primario: 'bg-sky-600 text-white hover:bg-sky-700 focus-visible:outline-sky-600',
  secundario:
    'bg-white text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 focus-visible:outline-slate-400',
  perigo: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600',
  fantasma: 'text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400',
}

const TAMANHOS = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
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
      className={`inline-flex items-center justify-center rounded-lg font-medium transition
        focus-visible:outline-2 focus-visible:outline-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${className}`}
      {...props}
    >
      {carregando && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- Cartão */

export function Cartao({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-xs ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CartaoTitulo({ children, acao }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-800">{children}</h3>
      {acao}
    </div>
  )
}

/* -------------------------------------------------------------- Etiqueta */

export function Etiqueta({ cor = 'bg-slate-100 text-slate-600 ring-slate-200', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
        whitespace-nowrap ring-1 ring-inset ${cor}`}
    >
      {children}
    </span>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={aoFechar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[92vh] w-full ${largura} flex-col rounded-t-2xl
          bg-white shadow-xl sm:rounded-xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-800">{titulo}</h2>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{rodape}</div>
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

export function Vazio({ icone: Icone = Inbox, titulo, descricao, acao }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
        <Icone size={22} />
      </div>
      <p className="text-sm font-medium text-slate-700">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-slate-400">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
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
    className={`border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-left text-xs
      font-semibold tracking-wide text-slate-500 uppercase whitespace-nowrap ${className}`}
  >
    {children}
  </th>
)

export const Td = ({ children, className = '' }) => (
  <td className={`border-b border-slate-100 px-4 py-2.5 align-middle ${className}`}>{children}</td>
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
      <div className="nao-imprimir pointer-events-none fixed right-4 bottom-4 z-100 flex flex-col gap-2">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg px-4 py-3
              text-sm shadow-lg ring-1 ring-inset ${
                a.tipo === 'erro'
                  ? 'bg-red-50 text-red-800 ring-red-200'
                  : 'bg-emerald-50 text-emerald-800 ring-emerald-200'
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
