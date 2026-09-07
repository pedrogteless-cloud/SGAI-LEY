import { useRef, useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const extensao = (mime) => (mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg')

/**
 * Várias fotos no mesmo lugar — mesma mecânica de upload do FotoCaptura
 * (bucket `fotos`, já existente), só que em lista em vez de uma só. Usado
 * onde o pedido explicitamente quer "uma ou mais fotos" (desperdício,
 * reaproveitamento, avaliação de setor).
 *
 * `valor`: array de { url, legenda }. Avisa o pai por `aoMudar(novoArray)`.
 */
export default function GaleriaFotos({ valor = [], aoMudar, desabilitado = false }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [ampliada, setAmpliada] = useState(null)
  const arquivo = useRef(null)

  const escolher = () => arquivo.current?.click()

  const aoSelecionar = async (e) => {
    const arquivos = Array.from(e.target.files || [])
    e.target.value = ''
    if (arquivos.length === 0) return
    setErro(null)
    setEnviando(true)

    const enviadas = []
    for (const file of arquivos) {
      const nome = `${crypto.randomUUID()}.${extensao(file.type || 'image/jpeg')}`
      const { error } = await supabase.storage
        .from('fotos')
        .upload(nome, file, { contentType: file.type || 'image/jpeg', upsert: false })
      if (error) {
        setErro('Uma das fotos não subiu. Confira a internet e tente de novo.')
        continue
      }
      const { data } = supabase.storage.from('fotos').getPublicUrl(nome)
      enviadas.push({ url: data.publicUrl, legenda: '' })
    }
    setEnviando(false)
    if (enviadas.length) aoMudar([...valor, ...enviadas])
  }

  const remover = (i) => aoMudar(valor.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <input
        ref={arquivo}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={aoSelecionar}
        className="hidden"
      />

      <div className="flex flex-wrap gap-2">
        {valor.map((f, i) => (
          <div key={f.url} className="group relative size-20 shrink-0">
            <button
              type="button"
              onClick={() => setAmpliada(f.url)}
              className="size-full overflow-hidden rounded-lg ring-1 ring-slate-200"
            >
              <img src={f.url} alt="" className="size-full object-cover" />
            </button>
            {!desabilitado && (
              <button
                type="button"
                onClick={() => remover(i)}
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center
                  rounded-full bg-red-600 text-white shadow hover:bg-red-700"
                aria-label="Remover foto"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}

        {!desabilitado && (
          <button
            type="button"
            onClick={escolher}
            disabled={enviando}
            className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg
              border-2 border-dashed border-slate-300 text-slate-400 transition
              hover:border-sky-400 hover:text-sky-600 disabled:opacity-50"
          >
            <Camera size={20} />
            <span className="text-[10px] font-medium">{enviando ? 'Enviando…' : 'Foto'}</span>
          </button>
        )}
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {ampliada && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setAmpliada(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            aria-label="Fechar"
          >
            <X size={24} />
          </button>
          <img src={ampliada} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}
