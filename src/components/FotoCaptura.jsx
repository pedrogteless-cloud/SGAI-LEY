import { useRef, useState } from 'react'
import { Camera, Trash2, ImagePlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

const extensao = (mime) => (mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg')

/**
 * Foto do problema, tirada na hora com a câmera do celular.
 *
 * Existe pelo mesmo motivo do áudio: quem não escreve bem, ainda assim
 * consegue apontar a câmera pro defeito e apertar um botão só. `capture`
 * abre direto a câmera no celular, sem passar pela galeria.
 *
 * Avisa o pai por `aoMudar(url)`, ou `aoMudar(null)` quando apaga.
 */
export default function FotoCaptura({ aoMudar, desabilitado = false }) {
  const [estado, setEstado] = useState('vazio') // vazio | enviando | pronto
  const [previa, setPrevia] = useState(null)
  const [erro, setErro] = useState(null)
  const arquivo = useRef(null)

  const escolher = () => arquivo.current?.click()

  const aoSelecionar = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErro(null)
    setEstado('enviando')
    setPrevia(URL.createObjectURL(file))

    const nome = `${crypto.randomUUID()}.${extensao(file.type || 'image/jpeg')}`
    const { error } = await supabase.storage
      .from('fotos')
      .upload(nome, file, { contentType: file.type || 'image/jpeg', upsert: false })

    if (error) {
      setErro('A foto não subiu. Confira a internet e tire de novo.')
      setEstado('vazio')
      setPrevia(null)
      return
    }
    const { data } = supabase.storage.from('fotos').getPublicUrl(nome)
    setEstado('pronto')
    aoMudar(data.publicUrl)
  }

  const apagar = () => {
    if (previa) URL.revokeObjectURL(previa)
    setPrevia(null)
    setEstado('vazio')
    aoMudar(null)
  }

  return (
    <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200 ring-inset">
      <input
        ref={arquivo}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={aoSelecionar}
        className="hidden"
      />

      {estado === 'vazio' && (
        <div className="text-center">
          <button
            type="button"
            onClick={escolher}
            disabled={desabilitado}
            className="mx-auto flex size-20 items-center justify-center rounded-full bg-sky-600
              text-white shadow-sm transition active:scale-95 disabled:opacity-50"
            aria-label="Tirar foto do problema"
          >
            <Camera size={34} />
          </button>
          <p className="mt-3 text-sm font-medium text-slate-700">Toque para fotografar</p>
          <p className="text-xs text-slate-500">Mostre onde está o problema</p>
        </div>
      )}

      {estado === 'enviando' && (
        <div className="text-center">
          {previa && (
            <img src={previa} alt="" className="mx-auto mb-3 h-32 w-full rounded-lg object-cover opacity-60" />
          )}
          <div className="mx-auto size-8 animate-spin rounded-full border-3 border-slate-200 border-t-sky-600" />
          <p className="mt-3 text-sm text-slate-600">Guardando a foto…</p>
        </div>
      )}

      {estado === 'pronto' && (
        <div className="flex items-center gap-3">
          <img src={previa} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-700">Foto tirada</p>
            <button
              type="button"
              onClick={escolher}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              <ImagePlus size={13} /> tirar outra
            </button>
          </div>
          <button
            type="button"
            onClick={apagar}
            className="flex size-10 shrink-0 items-center justify-center rounded-full
              text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            aria-label="Apagar foto"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}

      {erro && <p className="mt-3 text-center text-sm text-red-600">{erro}</p>}
    </div>
  )
}
