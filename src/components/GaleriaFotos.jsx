import { useRef, useState } from 'react'
import { Camera, Images, Trash2, X } from 'lucide-react'
import { enviarFoto, descartarFotos } from '../lib/fotos'

/**
 * Várias fotos no mesmo lugar — mesma mecânica de upload do FotoCaptura
 * (bucket `fotos`, já existente), só que em lista em vez de uma só. Usado
 * onde o pedido explicitamente quer "uma ou mais fotos" (desperdício,
 * reaproveitamento, avaliação de setor).
 *
 * `valor`: array de { url, storage_path, legenda }. Avisa o pai por
 * `aoMudar(novoArray)` — sempre com a lista inteira, nunca só a última.
 *
 * `aoRemover(foto, indice)`: opcional. Quando a galeria mostra fotos que
 * já estão salvas no banco, quem manda apagar é o pai (ele tem que tirar
 * a linha do banco também). Sem isso, a galeria cuida sozinha: tira da
 * lista e apaga do bucket a foto que ela mesma acabou de subir, pra não
 * deixar arquivo órfão quando a pessoa muda de ideia.
 *
 * `maximo`: quantas cabem. Existe pro caso em que o banco guarda uma só
 * (a evidência de conclusão da ação): deixar escolher cinco e gravar a
 * primeira seria perder quatro sem avisar.
 *
 * Tirar e escolher são dois botões, não um. O `capture` do HTML abre a
 * câmera DIRETO e pula a galeria — então, com um botão só, quem já tinha
 * a foto no celular (tirou antes, recebeu no zap) simplesmente não
 * conseguia anexar. No computador só aparece "Escolher": lá `capture` não
 * quer dizer nada e um botão de câmera que abre seletor de arquivo seria
 * mentira.
 */
// Celular/tablet: tem câmera pra apontar pro problema. Num desktop o
// `capture` é ignorado pelo navegador, então nem oferecemos.
const temCamera = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches

export default function GaleriaFotos({ valor = [], aoMudar, aoRemover, maximo, desabilitado = false }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [ampliada, setAmpliada] = useState(null)
  const [naCamera] = useState(temCamera)
  const arquivo = useRef(null)
  const camera = useRef(null)
  // Só as que subiram nesta sessão da galeria podem ser apagadas do
  // bucket na remoção: as que vieram prontas do banco são do pai.
  const subidasAqui = useRef(new Set())

  const lotado = maximo != null && valor.length >= maximo
  const escolher = () => arquivo.current?.click()
  const fotografar = () => camera.current?.click()

  const aoSelecionar = async (e) => {
    const arquivos = Array.from(e.target.files || [])
    e.target.value = ''
    if (arquivos.length === 0) return
    setErro(null)
    setEnviando(true)

    const vagas = maximo != null ? Math.max(0, maximo - valor.length) : arquivos.length
    const enviadas = []
    const falhas = []
    if (arquivos.length > vagas) {
      falhas.push(maximo === 1 ? 'Aqui cabe só uma foto.' : `Aqui cabem ${maximo} foto(s).`)
    }
    for (const file of arquivos.slice(0, vagas)) {
      const { foto, erro: falha } = await enviarFoto(file)
      if (falha) { falhas.push(falha); continue }
      subidasAqui.current.add(foto.storage_path)
      enviadas.push(foto)
    }
    setEnviando(false)

    // Uma mensagem por motivo, não uma por arquivo: mandar 5 fotos e
    // levar 5 avisos iguais não ajuda ninguém a entender o que houve.
    if (falhas.length) setErro([...new Set(falhas)].join(' '))
    // Uma chamada só, com a lista inteira — o pai sempre recebe todas as
    // fotos novas de uma vez.
    if (enviadas.length) aoMudar([...valor, ...enviadas])
  }

  const remover = async (i) => {
    const foto = valor[i]
    if (aoRemover) { await aoRemover(foto, i); return }
    aoMudar(valor.filter((_, idx) => idx !== i))
    if (foto?.storage_path && subidasAqui.current.has(foto.storage_path)) {
      subidasAqui.current.delete(foto.storage_path)
      descartarFotos([foto])
    }
  }

  return (
    <div className="space-y-2">
      {/* Dois inputs, não um: o de cima abre a galeria (sem `capture`), o
          de baixo abre a câmera. O mesmo input não faz as duas coisas. */}
      <input
        ref={arquivo}
        type="file"
        accept="image/*"
        multiple={maximo !== 1}
        onChange={aoSelecionar}
        className="hidden"
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={aoSelecionar}
        className="hidden"
      />

      <div className="flex flex-wrap gap-2">
        {valor.map((f, i) => (
          <div key={f.storage_path || f.url} className="group relative size-20 shrink-0">
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

        {!desabilitado && !lotado && (
          <>
            {naCamera && (
              <BotaoFoto icone={Camera} rotulo="Tirar" onClick={fotografar} enviando={enviando} />
            )}
            <BotaoFoto
              icone={Images}
              rotulo={naCamera ? 'Escolher' : 'Foto'}
              onClick={escolher}
              enviando={enviando}
            />
          </>
        )}
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {/* Só na primeira vez: quem já anexou uma foto entendeu a diferença,
          e duas linhas cinzas empilhadas viram ruído. */}
      {naCamera && !desabilitado && !lotado && valor.length === 0 && (
        <p className="text-[11px] text-slate-400">
          Tirar abre a câmera; escolher pega uma foto que já está no celular.
        </p>
      )}

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

function BotaoFoto({ icone: Icone, rotulo, onClick, enviando }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={enviando}
      className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg
        border-2 border-dashed border-slate-300 text-slate-400 transition
        hover:border-sky-400 hover:text-sky-600 disabled:opacity-50"
    >
      <Icone size={20} />
      <span className="text-[10px] font-medium">{enviando ? 'Enviando…' : rotulo}</span>
    </button>
  )
}
