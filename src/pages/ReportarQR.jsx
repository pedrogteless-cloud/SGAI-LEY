import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Package, Octagon, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Botao, Campo, Entrada, Area, Erro, Carregando } from '../components/ui'
import GravadorAudio from '../components/GravadorAudio'
import FotoCaptura from '../components/FotoCaptura'

/**
 * Tela pública: o operador escaneia o QR da máquina e reporta o problema.
 * Sem login. Usa apenas os RPCs liberados para o papel anônimo.
 *
 * Pensada pra quem não é acostumado com tela: foto e áudio são os
 * caminhos principais (apontar e apertar, sem escrever nada), o texto é
 * só um extra pra quem prefere digitar. "Parou ou não" é um toque em
 * botão grande, não uma caixinha pra marcar e ler a letra miúda.
 */
export default function ReportarQR() {
  const { token } = useParams()
  const [ativo, setAtivo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const [descricao, setDescricao] = useState('')
  const [nome, setNome] = useState('')
  const [parada, setParada] = useState(null) // null = ainda não escolheu
  const [audio, setAudio] = useState(null)
  const [foto, setFoto] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [protocolo, setProtocolo] = useState(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase.rpc('ativo_por_qr', { p_token: token })
      if (!vivo) return
      if (error) setErro(new Error(error.message))
      else if (!data || data.length === 0)
        setErro(new Error('Não achei essa máquina. Veja se a etiqueta está rasgada ou suja.'))
      else setAtivo(data[0])
      setCarregando(false)
    })()
    return () => {
      vivo = false
    }
  }, [token])

  const podeEnviar = parada != null && (Boolean(audio) || Boolean(foto) || descricao.trim().length >= 5)

  const enviar = async (e) => {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { data, error } = await supabase.rpc('abrir_solicitacao_qr', {
      p_token: token,
      p_descricao: descricao.trim() || null,
      p_solicitante: nome || null,
      p_maquina_parada: Boolean(parada),
      p_foto_url: foto,
      p_audio_url: audio?.url ?? null,
      p_audio_segundos: audio?.segundos ?? null,
    })
    if (error) setErro(new Error(error.message))
    else setProtocolo(data?.[0]?.numero ?? 'registrado')
    setEnviando(false)
  }

  if (carregando)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Carregando texto="Só um instante…" />
      </div>
    )

  if (!ativo)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center">
          <AlertTriangle size={28} className="mx-auto mb-3 text-amber-500" />
          <p className="font-semibold text-slate-800">Não deu certo</p>
          <p className="mt-1 text-sm text-slate-500">{erro?.message}</p>
        </div>
      </div>
    )

  if (protocolo)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center">
          <CheckCircle2 size={52} className="mx-auto mb-4 text-emerald-500" />
          <p className="text-xl font-bold text-slate-800">Avisado!</p>
          <p className="mt-2 text-base text-slate-500">A manutenção já recebeu.</p>
          <p className="mt-4 rounded-lg bg-slate-100 py-3 font-mono text-2xl font-bold text-slate-900">
            {protocolo}
          </p>
          <p className="mt-5 text-sm text-slate-500">
            {ativo.nome}
            <br />
            <span className="font-mono text-xs">{ativo.codigo}</span>
          </p>
          <Botao
            variante="secundario"
            tamanho="lg"
            className="mt-6 w-full"
            onClick={() => {
              setProtocolo(null)
              setDescricao('')
              setParada(null)
              setAudio(null)
              setFoto(null)
            }}
          >
            Avisar outro problema
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
              <p className="truncate text-lg font-semibold text-slate-900">{ativo.nome}</p>
              <p className="font-mono text-xs text-slate-500">{ativo.codigo}</p>
              <p className="truncate text-xs text-slate-400">
                {[ativo.setor, ativo.unidade].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={enviar} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Avisar um problema</h1>
            <p className="text-sm text-slate-500">Tire uma foto ou fale o que está acontecendo.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FotoCaptura aoMudar={setFoto} />
            <GravadorAudio aoMudar={setAudio} />
          </div>

          <div>
            <p className="text-center text-sm font-semibold text-slate-700">A máquina parou de trabalhar?</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setParada(true)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 transition ${
                  parada === true
                    ? 'border-red-500 bg-red-50'
                    : 'border-slate-200 bg-white hover:border-red-200'
                }`}
              >
                <Octagon
                  size={30}
                  className={parada === true ? 'text-red-600' : 'text-slate-400'}
                  fill={parada === true ? '#fecaca' : 'none'}
                />
                <span className={`text-sm font-bold ${parada === true ? 'text-red-700' : 'text-slate-600'}`}>
                  Parou
                </span>
              </button>
              <button
                type="button"
                onClick={() => setParada(false)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 transition ${
                  parada === false
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-slate-200 bg-white hover:border-amber-200'
                }`}
              >
                <Info
                  size={30}
                  className={parada === false ? 'text-amber-600' : 'text-slate-400'}
                />
                <span className={`text-sm font-bold ${parada === false ? 'text-amber-700' : 'text-slate-600'}`}>
                  Só avisando
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-slate-400">quer escrever também?</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <Campo rotulo="O que está acontecendo?">
            <Area
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: está fazendo barulho e esquentando muito"
            />
          </Campo>

          <Campo rotulo="Seu nome" dica="Não é obrigatório, mas ajuda a manutenção a te achar">
            <Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Se quiser colocar" />
          </Campo>

          <Erro erro={erro} />

          <Botao
            type="submit"
            tamanho="lg"
            className="w-full text-base"
            carregando={enviando}
            disabled={!podeEnviar}
          >
            Avisar a manutenção
          </Botao>
          {parada == null && (
            <p className="-mt-3 text-center text-xs text-slate-400">Toque em "Parou" ou "Só avisando" ali em cima</p>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">SGAI · Ley Colchões</p>
      </div>
    </div>
  )
}
