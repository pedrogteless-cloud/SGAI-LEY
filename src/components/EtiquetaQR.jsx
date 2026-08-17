import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { Printer } from 'lucide-react'
import { Botao, Campo, Entrada, Selecao, Modal } from './ui'

/**
 * Etiqueta de QR para colar na máquina.
 *
 * O adesivo é físico e cada fábrica usa o seu, então a medida é escolhida aqui e
 * fica guardada no navegador — na segunda vez já abre no formato certo e é só
 * mandar imprimir. A prévia aparece no tamanho real (mm de CSS), e a folha sai
 * com `@page` do tamanho exato do adesivo, sem margem, para o conteúdo não
 * escorregar de posição.
 */

const CHAVE = 'sgai:etiqueta'

// Medidas de adesivo comuns no Brasil (Pimaco e equivalentes)
const FORMATOS = [
  { id: '6180', nome: 'Pimaco 6180 · 101,6 × 25,4 mm', l: 101.6, a: 25.4 },
  { id: '6082', nome: 'Pimaco 6082 · 101,6 × 33,9 mm', l: 101.6, a: 33.9 },
  { id: '6087', nome: 'Pimaco 6087 · 101,6 × 50,8 mm', l: 101.6, a: 50.8 },
  { id: '8163', nome: 'Etiqueta grande · 101,6 × 63,5 mm', l: 101.6, a: 63.5 },
  { id: 'q60', nome: 'Quadrada · 60 × 60 mm', l: 60, a: 60 },
  { id: 'livre', nome: 'Outro tamanho (digitar)', l: 90, a: 40 },
]

const lerSalvo = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || null
  } catch {
    return null
  }
}

export default function EtiquetaQR({ aberto, aoFechar, ativo, link }) {
  const salvo = useMemo(lerSalvo, [aberto])
  const [formato, setFormato] = useState(salvo?.formato || '6082')
  const [larg, setLarg] = useState(salvo?.larg || 101.6)
  const [alt, setAlt] = useState(salvo?.alt || 33.9)
  const [qr, setQr] = useState(null)

  useEffect(() => {
    if (!aberto || !link) return
    // margin 0: quem dá a folga é o layout da etiqueta, não o PNG
    QRCode.toDataURL(link, { margin: 0, width: 600, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null))
  }, [aberto, link])

  // guarda a medida assim que ela muda: na próxima vez é só mandar imprimir
  useEffect(() => {
    if (!aberto) return
    localStorage.setItem(CHAVE, JSON.stringify({ formato, larg, alt }))
  }, [aberto, formato, larg, alt])

  const trocarFormato = (id) => {
    setFormato(id)
    const f = FORMATOS.find((x) => x.id === id)
    if (f && id !== 'livre') {
      setLarg(f.l)
      setAlt(f.a)
    }
  }

  const imprimir = () => window.print()

  if (!ativo) return null

  // Adesivo em faixa comporta o QR ao lado do texto. Quadrado ou em pé não:
  // sobraria uma tira de poucos milímetros para escrever. Nesses, QR em cima.
  const deitada = larg / alt >= 1.8
  // Abaixo de ~30 mm de altura o setor não cabe e as fontes encolhem.
  const apertada = alt < 30

  const ladoQR = deitada
    ? Math.min(alt - 6, 46)
    : Math.min(larg - 6, (alt - 6) * 0.62)
  const sobra = deitada ? larg - ladoQR - 9 : larg - 6

  const etiqueta = (
    <div
      className={`etiqueta-folha flex overflow-hidden bg-white p-[3mm] ${
        deitada ? 'items-center gap-[3mm]' : 'flex-col items-center gap-[1.5mm]'
      }`}
      style={{ width: `${larg}mm`, height: `${alt}mm` }}
    >
      {qr && (
        <img
          src={qr}
          alt=""
          className="shrink-0"
          style={{ width: `${ladoQR}mm`, height: `${ladoQR}mm` }}
        />
      )}
      <div
        className={`flex min-w-0 flex-col ${
          deitada ? 'h-full justify-between py-[0.5mm]' : 'flex-1 justify-between text-center'
        }`}
        style={{ width: `${sobra}mm` }}
      >
        <div className="min-w-0">
          <p
            className="font-bold text-black uppercase"
            style={{
              fontSize: apertada ? '2.7mm' : '3.4mm',
              lineHeight: 1.1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {ativo.nome}
          </p>
          <p
            className="font-mono font-semibold text-black"
            style={{ fontSize: apertada ? '2.3mm' : '2.9mm', lineHeight: 1.35 }}
          >
            {ativo.codigo}
          </p>
          {!apertada && (ativo.setor?.nome || ativo.unidade?.nome) && (
            <p className="truncate text-black" style={{ fontSize: '2.2mm', lineHeight: 1.35 }}>
              {[ativo.setor?.nome, ativo.unidade?.nome].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <p
          className="font-bold text-black uppercase"
          style={{ fontSize: apertada ? '1.9mm' : '2.3mm', lineHeight: 1.15 }}
        >
          Problema? Aponte a câmera
        </p>
      </div>
    </div>
  )

  return (
    <>
      <Modal
        aberto={aberto}
        aoFechar={aoFechar}
        titulo="Etiqueta para colar na máquina"
        largura="max-w-lg"
        rodape={
          <>
            <Botao variante="secundario" onClick={aoFechar}>
              Fechar
            </Botao>
            <Botao onClick={imprimir} disabled={!qr}>
              <Printer size={15} /> Imprimir
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Tamanho do seu adesivo">
            <Selecao value={formato} onChange={(e) => trocarFormato(e.target.value)}>
              {FORMATOS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          {formato === 'livre' && (
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Largura (mm)">
                <Entrada
                  type="number"
                  step="0.1"
                  min="30"
                  value={larg}
                  onChange={(e) => setLarg(Number(e.target.value) || 0)}
                />
              </Campo>
              <Campo rotulo="Altura (mm)">
                <Entrada
                  type="number"
                  step="0.1"
                  min="20"
                  value={alt}
                  onChange={(e) => setAlt(Number(e.target.value) || 0)}
                />
              </Campo>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">
              Prévia no tamanho real — {larg.toFixed(1)} × {alt.toFixed(1)} mm
            </p>
            <div className="flex justify-center rounded-lg bg-slate-100 p-4">
              <div className="ring-1 ring-slate-300 ring-inset">{etiqueta}</div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Na hora de imprimir, deixe a escala em <strong>100%</strong> e desmarque
            &ldquo;ajustar à página&rdquo; — senão a impressora encolhe e sai fora da medida.
            O tamanho escolhido fica guardado para a próxima.
          </p>
        </div>
      </Modal>

      {/* Vai para fora do #root de propósito: o CSS de impressão esconde os
          filhos diretos do body, e a etiqueta precisa ser um deles para sobrar. */}
      {aberto &&
        createPortal(
          <div className="so-impressao">
            <style>{`@page { size: ${larg}mm ${alt}mm; margin: 0; }`}</style>
            {etiqueta}
          </div>,
          document.body
        )}
    </>
  )
}
