import { CloudOff, RefreshCw } from 'lucide-react'
import { useConexao } from '../hooks/useConexao'

/**
 * A faixa que aparece no topo quando tem algo que a pessoa precisa saber
 * antes de continuar mexendo: o sinal caiu, ou saiu versão nova.
 *
 * Ficar em cima e ocupar espaço é de propósito. O jeito antigo — o
 * formulário simplesmente não salvar e a pessoa achar que salvou — é o
 * que não pode acontecer com alguém de pé no meio do galpão.
 */
export default function BarraDeCampo({ atualizacao }) {
  const online = useConexao()
  if (online && !atualizacao) return null

  if (!online) {
    return (
      <div
        role="status"
        className="nao-imprimir flex items-center justify-center gap-2 bg-amber-500 px-4 py-2
          text-center text-xs font-semibold text-white"
      >
        <CloudOff size={14} className="shrink-0" />
        Sem internet. Dá pra olhar o que já está na tela, mas nada que você salvar agora vai
        chegar no sistema.
      </div>
    )
  }

  return (
    <button
      onClick={atualizacao}
      className="nao-imprimir flex w-full items-center justify-center gap-2 bg-sky-600 px-4 py-2
        text-center text-xs font-semibold text-white transition-colors hover:bg-sky-700"
    >
      <RefreshCw size={14} className="shrink-0" />
      Tem uma versão nova do SGAI. Toque para atualizar.
    </button>
  )
}
