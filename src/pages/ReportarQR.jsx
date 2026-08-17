import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Botao, Campo, Entrada, Area, Erro, Carregando } from '../components/ui'

/**
 * Tela pública: o operador escaneia o QR da máquina e reporta o problema.
 * Sem login. Usa apenas os RPCs liberados para o papel anônimo.
 */
export default function ReportarQR() {
  const { token } = useParams()
  const [ativo, setAtivo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const [descricao, setDescricao] = useState('')
  const [nome, setNome] = useState('')
  const [parada, setParada] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [protocolo, setProtocolo] = useState(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase.rpc('ativo_por_qr', { p_token: token })
      if (!vivo) return
      if (error) setErro(new Error(error.message))
      else if (!data || data.length === 0)
        setErro(new Error('QR code não encontrado. Confira se o adesivo está legível.'))
      else setAtivo(data[0])
      setCarregando(false)
    })()
    return () => {
      vivo = false
    }
  }, [token])

  const enviar = async (e) => {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { data, error } = await supabase.rpc('abrir_solicitacao_qr', {
      p_token: token,
      p_descricao: descricao,
      p_solicitante: nome || null,
      p_maquina_parada: parada,
    })
    if (error) setErro(new Error(error.message))
    else setProtocolo(data?.[0]?.numero ?? 'registrado')
    setEnviando(false)
  }

  if (carregando)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Carregando texto="Lendo o QR…" />
      </div>
    )

  if (!ativo)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center">
          <AlertTriangle size={28} className="mx-auto mb-3 text-amber-500" />
          <p className="font-semibold text-slate-800">Não foi possível abrir</p>
          <p className="mt-1 text-sm text-slate-500">{erro?.message}</p>
        </div>
      </div>
    )

  if (protocolo)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center">
          <CheckCircle2 size={40} className="mx-auto mb-4 text-emerald-500" />
          <p className="text-lg font-semibold text-slate-800">Problema registrado</p>
          <p className="mt-1 text-sm text-slate-500">
            A manutenção já foi avisada. Guarde o protocolo:
          </p>
          <p className="mt-3 font-mono text-base font-bold text-slate-900">{protocolo}</p>
          <p className="mt-5 text-sm text-slate-500">
            {ativo.nome}
            <br />
            <span className="font-mono text-xs">{ativo.codigo}</span>
          </p>
          <Botao
            variante="secundario"
            className="mt-6 w-full"
            onClick={() => {
              setProtocolo(null)
              setDescricao('')
              setParada(false)
            }}
          >
            Reportar outro problema
          </Botao>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            {ativo.foto_capa_url ? (
              <img
                src={ativo.foto_capa_url}
                alt=""
                className="size-14 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                <Package size={22} />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{ativo.nome}</p>
              <p className="font-mono text-xs text-slate-500">{ativo.codigo}</p>
              <p className="truncate text-xs text-slate-400">
                {[ativo.setor, ativo.unidade].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={enviar} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h1 className="text-base font-semibold text-slate-900">Reportar problema</h1>
            <p className="text-sm text-slate-500">Descreva o que está acontecendo.</p>
          </div>

          <Campo rotulo="O que está acontecendo? *">
            <Area
              rows={4}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              minLength={5}
              autoFocus
              placeholder="Ex.: está fazendo barulho no rolamento do lado direito e esquentando"
            />
          </Campo>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-red-50 p-3 ring-1 ring-red-200 ring-inset">
            <input
              type="checkbox"
              checked={parada}
              onChange={(e) => setParada(e.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm">
              <span className="font-medium text-red-800">A máquina está parada</span>
              <span className="block text-xs text-red-600">
                Marque só se a produção realmente parou — isso vira prioridade alta.
              </span>
            </span>
          </label>

          <Campo rotulo="Seu nome" dica="Opcional, ajuda a manutenção a te procurar">
            <Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Opcional" />
          </Campo>

          <Erro erro={erro} />

          <Botao
            type="submit"
            tamanho="lg"
            className="w-full"
            carregando={enviando}
            disabled={descricao.trim().length < 5}
          >
            Enviar para a manutenção
          </Botao>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">SGAI · Ley Colchões</p>
      </div>
    </div>
  )
}
