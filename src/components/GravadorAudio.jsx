import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Trash2, Play, Pause } from 'lucide-react'
import { supabase } from '../lib/supabase'

const LIMITE_SEGUNDOS = 120

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/** Extensão que o navegador conseguiu gravar — Safari entrega mp4, Chrome webm. */
const extensao = (mime) => (mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm')

/**
 * Gravador de recado em áudio.
 *
 * Existe porque parte da produção não escreve. Falar no celular é uma coisa que
 * a pessoa já sabe fazer — o botão é grande, redondo e vermelho de propósito.
 *
 * Avisa o pai por `aoMudar({ url, segundos })`, ou `aoMudar(null)` quando apaga.
 */
export default function GravadorAudio({ aoMudar, desabilitado = false }) {
  const [estado, setEstado] = useState('parado') // parado | gravando | pronto | enviando
  const [segundos, setSegundos] = useState(0)
  const [previa, setPrevia] = useState(null)
  const [tocando, setTocando] = useState(false)
  const [erro, setErro] = useState(null)

  const gravador = useRef(null)
  const pedacos = useRef([])
  const relogio = useRef(null)
  const audio = useRef(null)
  // o onstop do MediaRecorder enxerga o estado congelado do início da gravação,
  // então a duração precisa viver num ref para chegar certa no banco
  const duracao = useRef(0)

  useEffect(
    () => () => {
      clearInterval(relogio.current)
      gravador.current?.stream?.getTracks().forEach((t) => t.stop())
      if (previa) URL.revokeObjectURL(previa)
    },
    [previa]
  )

  const suportado =
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  const comecar = async () => {
    setErro(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = [
        'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus',
      ].find((m) => MediaRecorder.isTypeSupported(m))

      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      pedacos.current = []
      mr.ondataavailable = (e) => e.data.size > 0 && pedacos.current.push(e.data)
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(pedacos.current, { type: mr.mimeType || 'audio/webm' })
        setPrevia(URL.createObjectURL(blob))
        enviar(blob, mr.mimeType || 'audio/webm')
      }

      mr.start()
      gravador.current = mr
      setEstado('gravando')
      setSegundos(0)
      duracao.current = 0
      relogio.current = setInterval(() => {
        duracao.current += 1
        setSegundos(duracao.current)
        if (duracao.current >= LIMITE_SEGUNDOS) parar()
      }, 1000)
    } catch {
      setErro('Não consegui usar o microfone. Permita o acesso e tente de novo.')
    }
  }

  const parar = () => {
    clearInterval(relogio.current)
    if (gravador.current?.state === 'recording') gravador.current.stop()
  }

  const enviar = async (blob, mime) => {
    setEstado('enviando')
    const nome = `${crypto.randomUUID()}.${extensao(mime)}`
    const { error } = await supabase.storage
      .from('audios')
      .upload(nome, blob, { contentType: mime, upsert: false })

    if (error) {
      setErro('O áudio não subiu. Confira a internet e grave de novo.')
      setEstado('parado')
      return
    }
    const { data } = supabase.storage.from('audios').getPublicUrl(nome)
    setEstado('pronto')
    aoMudar({ url: data.publicUrl, segundos: duracao.current })
  }

  const apagar = () => {
    if (previa) URL.revokeObjectURL(previa)
    setPrevia(null)
    setSegundos(0)
    duracao.current = 0
    setTocando(false)
    setEstado('parado')
    aoMudar(null)
  }

  const alternarPrevia = () => {
    if (!audio.current) return
    if (tocando) audio.current.pause()
    else audio.current.play()
  }

  if (!suportado) return null

  return (
    <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200 ring-inset">
      {estado === 'parado' && (
        <div className="text-center">
          <button
            type="button"
            onClick={comecar}
            disabled={desabilitado}
            className="mx-auto flex size-20 items-center justify-center rounded-full bg-red-600
              text-white shadow-sm transition active:scale-95 disabled:opacity-50"
            aria-label="Gravar recado em áudio"
          >
            <Mic size={34} />
          </button>
          <p className="mt-3 text-sm font-medium text-slate-700">Toque para falar</p>
          <p className="text-xs text-slate-500">Se preferir, conte o problema falando</p>
        </div>
      )}

      {estado === 'gravando' && (
        <div className="text-center">
          <button
            type="button"
            onClick={parar}
            className="mx-auto flex size-20 animate-pulse items-center justify-center rounded-full
              bg-red-600 text-white shadow-lg ring-4 ring-red-200 transition active:scale-95"
            aria-label="Parar de gravar"
          >
            <Square size={30} fill="currentColor" />
          </button>
          <p className="mt-3 font-mono text-lg font-bold text-red-700">{mmss(segundos)}</p>
          <p className="text-sm font-medium text-slate-700">Gravando… toque para parar</p>
        </div>
      )}

      {estado === 'enviando' && (
        <div className="py-4 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-3 border-slate-200 border-t-sky-600" />
          <p className="mt-3 text-sm text-slate-600">Guardando seu recado…</p>
        </div>
      )}

      {estado === 'pronto' && (
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={alternarPrevia}
              className="flex size-12 shrink-0 items-center justify-center rounded-full
                bg-sky-600 text-white transition active:scale-95"
              aria-label={tocando ? 'Pausar' : 'Ouvir o que gravou'}
            >
              {tocando ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-700">Recado gravado</p>
              <p className="text-xs text-slate-500">{mmss(segundos)} · toque para ouvir</p>
            </div>
            <button
              type="button"
              onClick={apagar}
              className="flex size-10 shrink-0 items-center justify-center rounded-full
                text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label="Apagar e gravar de novo"
            >
              <Trash2 size={18} />
            </button>
          </div>
          <audio
            ref={audio}
            src={previa}
            onPlay={() => setTocando(true)}
            onPause={() => setTocando(false)}
            onEnded={() => setTocando(false)}
            className="hidden"
          />
        </div>
      )}

      {erro && <p className="mt-3 text-center text-sm text-red-600">{erro}</p>}
    </div>
  )
}
