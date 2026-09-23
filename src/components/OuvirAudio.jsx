import { useRef, useState } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/** Toca o recado que a produção gravou. Compacto, para caber na linha do aviso. */
export default function OuvirAudio({ url, segundos, className = '' }) {
  const audio = useRef(null)
  const [tocando, setTocando] = useState(false)

  if (!url) return null

  const alternar = (e) => {
    e.stopPropagation()
    if (tocando) audio.current?.pause()
    else audio.current?.play()
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-sky-50 py-1 pr-3 pl-1
        ring-1 ring-sky-200 ring-inset ${className}`}
    >
      <button
        type="button"
        onClick={alternar}
        className="flex size-7 shrink-0 items-center justify-center rounded-full
          bg-sky-600 text-white transition active:scale-95"
        aria-label={tocando ? 'Pausar recado' : 'Ouvir recado'}
      >
        {tocando ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
      </button>
      <Volume2 size={13} className="text-sky-600" />
      <span className="text-xs font-medium text-sky-800">
        Recado{segundos ? ` · ${mmss(segundos)}` : ''}
      </span>
      <audio
        ref={audio}
        src={url}
        preload="none"
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => setTocando(false)}
        className="hidden"
      />
    </span>
  )
}
