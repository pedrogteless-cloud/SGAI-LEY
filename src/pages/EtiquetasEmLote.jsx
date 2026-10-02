import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowLeft, Printer, QrCode } from 'lucide-react'
import { useTabela, useSetores, useUnidades } from '../hooks/useDados'
import { FolhaEtiqueta, AjustePosicao, FORMATOS, CHAVE, lerSalvo } from '../components/EtiquetaQR'
import { linkDoQR, origemPublica, enderecoTemporario } from '../lib/urlPublica'
import { Botao, Cartao, Campo, Entrada, Selecao, Carregando, Vazio, Erro } from '../components/ui'

/**
 * Todas as etiquetas de uma vez. Usa a mesma medida e o mesmo ajuste de
 * posição já calibrados na etiqueta avulsa (ficam guardados no navegador),
 * então quem já acertou a impressora uma vez só escolhe as máquinas e
 * manda imprimir. Cada etiqueta sai numa página do tamanho do adesivo —
 * igual à avulsa, que é o que a impressora de etiqueta espera.
 */
export default function EtiquetasEmLote() {
  const [unidade, setUnidade] = useState('')
  const [setor, setSetor] = useState('')
  const [busca, setBusca] = useState('')
  // Guarda as DESMARCADAS: assim, ao trocar o filtro, tudo que aparece
  // já vem marcado — o caso comum é imprimir tudo.
  const [desmarcados, setDesmarcados] = useState(() => new Set())

  const salvo = useMemo(() => lerSalvo() || {}, [])
  const [formato, setFormato] = useState(salvo.formato || '6082')
  const [larg, setLarg] = useState(salvo.larg || 101.6)
  const [alt, setAlt] = useState(salvo.alt || 33.9)
  const [deslocX, setDeslocX] = useState(salvo.deslocX ?? 0)
  const [deslocY, setDeslocY] = useState(salvo.deslocY ?? 0)
  // Etiqueta que já saiu no teste: se saiu certa, não precisa sair de novo.
  const [testeId, setTesteId] = useState(null)
  const [pularTeste, setPularTeste] = useState(true)
  const [qrExemplo, setQrExemplo] = useState(null)

  const [lote, setLote] = useState(null)
  const [preparando, setPreparando] = useState(false)
  const [erro, setErro] = useState(null)

  const unidades = useUnidades()
  const setores = useSetores(unidade || undefined)
  const ativos = useTabela('ativos', {
    select: 'id, codigo, nome, qr_token, setor:setores(nome), unidade:unidades(nome)',
    filtros: [
      ['ativo', 'eq', true],
      ...(unidade ? [['unidade_id', 'eq', unidade]] : []),
      ...(setor ? [['setor_id', 'eq', setor]] : []),
    ],
    ordem: { coluna: 'codigo' },
  })

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const todos = (ativos.data || []).filter((a) => a.qr_token)
    if (!termo) return todos
    return todos.filter((a) => [a.codigo, a.nome].filter(Boolean).some((c) => c.toLowerCase().includes(termo)))
  }, [ativos.data, busca])

  const marcados = lista.filter((a) => !desmarcados.has(a.id))

  const alternar = (id) =>
    setDesmarcados((d) => {
      const novo = new Set(d)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  const marcarTodos = () => setDesmarcados(new Set())
  const desmarcarTodos = () => setDesmarcados(new Set(lista.map((a) => a.id)))

  const trocarFormato = (id) => {
    setFormato(id)
    const f = FORMATOS.find((x) => x.id === id)
    if (f && id !== 'livre') {
      setLarg(f.l)
      setAlt(f.a)
    }
  }

  // Medida e ajuste ficam no mesmo lugar da etiqueta avulsa: calibrou
  // num lugar, vale no outro e na próxima vez.
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ formato, larg, alt, deslocX, deslocY }))
    } catch { /* navegador sem armazenamento: só não lembra da próxima */ }
  }, [formato, larg, alt, deslocX, deslocY])

  let hostDoQR = ''
  try { hostDoQR = new URL(origemPublica()).host } catch { /* sem endereço */ }
  const temporario = enderecoTemporario(hostDoQR)

  const exemplo = marcados[0]

  // QR de verdade na prévia: é por ela que se confere se cabe no adesivo.
  useEffect(() => {
    if (!exemplo) return
    let vivo = true
    QRCode.toString(linkDoQR(exemplo.qr_token), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
      .then((svg) => vivo && setQrExemplo(svg))
      .catch(() => vivo && setQrExemplo(null))
    return () => { vivo = false }
  }, [exemplo?.qr_token]) // eslint-disable-line react-hooks/exhaustive-deps

  const pulando = testeId && pularTeste && marcados.some((a) => a.id === testeId)
  const paraImprimir = pulando ? marcados.filter((a) => a.id !== testeId) : marcados

  const imprimirTeste = () => {
    if (!exemplo) return
    setTesteId(exemplo.id)
    setPularTeste(true)
    gerar([exemplo])
  }

  const imprimir = () => gerar(paraImprimir)

  const gerar = async (escolhidos) => {
    setErro(null)
    setPreparando(true)
    try {
      const itens = []
      for (const a of escolhidos) {
        const svg = await QRCode.toString(linkDoQR(a.qr_token), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
        itens.push({ ativo: a, svg })
      }
      setLote(itens)
    } catch (e) {
      setErro(new Error(`Não consegui gerar os QR: ${e.message}`))
      setPreparando(false)
    }
  }

  // Imprime depois que as etiquetas estão na página; limpa ao terminar.
  useEffect(() => {
    if (!lote) return
    const aoTerminar = () => {
      setLote(null)
      setPreparando(false)
    }
    window.addEventListener('afterprint', aoTerminar, { once: true })
    const id = setTimeout(() => window.print(), 100)
    return () => {
      clearTimeout(id)
      window.removeEventListener('afterprint', aoTerminar)
    }
  }, [lote])


  return (
    <div className="entra space-y-5">
      <div className="flex items-start gap-3">
        <Link to="/ativos">
          <Botao variante="fantasma" tamanho="sm"><ArrowLeft size={16} /></Botao>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Imprimir etiquetas</h1>
          <p className="text-sm text-slate-500">Escolha as máquinas e imprima todas de uma vez</p>
        </div>
      </div>

      {temporario && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <strong>Não imprima ainda.</strong> O QR iria apontar para um endereço temporário
          ({hostDoQR}), que a Vercel apaga com o tempo. Abra o sistema pelo endereço oficial e
          imprima de lá.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <Cartao className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {(unidades.data || []).length > 1 && (
              <Selecao value={unidade} onChange={(e) => { setUnidade(e.target.value); setSetor('') }}>
                <option value="">Todas as unidades</option>
                {(unidades.data || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </Selecao>
            )}
            <Selecao value={setor} onChange={(e) => setSetor(e.target.value)}>
              <option value="">Todos os setores</option>
              {(setores.data || []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Selecao>
            <Entrada placeholder="Buscar código ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              {marcados.length} de {lista.length} marcadas
            </span>
            <span className="flex gap-3">
              <button type="button" onClick={marcarTodos} className="font-medium text-sky-600 hover:text-sky-700">Marcar todas</button>
              <button type="button" onClick={desmarcarTodos} className="font-medium text-slate-500 hover:text-slate-700">Desmarcar todas</button>
            </span>
          </div>

          {ativos.isLoading ? (
            <Carregando />
          ) : lista.length === 0 ? (
            <Vazio icone={QrCode} titulo="Nenhuma máquina com esse filtro" />
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {lista.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-sky-600"
                      checked={!desmarcados.has(a.id)}
                      onChange={() => alternar(a.id)}
                    />
                    <span className="font-mono text-xs text-slate-500">{a.codigo}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{a.nome}</span>
                    <span className="hidden truncate text-xs text-slate-400 sm:block">{a.setor?.nome}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {/* No celular os passos vêm antes da lista: com dezenas de
            máquinas, eles ficariam perdidos lá no fim da página. */}
        <div className="order-first space-y-4 lg:order-none">
          <Cartao className="space-y-3 p-4">
            <Passo numero={1} titulo="Escolha o tamanho do adesivo" />
            <Selecao value={formato} onChange={(e) => trocarFormato(e.target.value)}>
              {FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Selecao>
            {formato === 'livre' && (
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Largura (mm)">
                  <Entrada type="number" step="0.1" min="20" value={larg} onChange={(e) => setLarg(Number(e.target.value) || 0)} />
                </Campo>
                <Campo rotulo="Altura (mm)">
                  <Entrada type="number" step="0.1" min="15" value={alt} onChange={(e) => setAlt(Number(e.target.value) || 0)} />
                </Campo>
              </div>
            )}
          </Cartao>

          <Cartao className="space-y-3 p-4">
            <Passo numero={2} titulo="Imprima uma de teste e acerte a posição" />
            <p className="text-sm text-slate-600">
              Coloque <strong>um adesivo</strong> na impressora e imprima uma só. Se o QR ou o
              texto sair torto ou cortado, ajuste com as setas e teste de novo até ficar certinho.
            </p>
            {exemplo && (
              <div className="rounded-lg bg-slate-100 p-3">
                <CaberNaLargura larguraMm={larg} alturaMm={alt}>
                  <div className="ring-1 ring-slate-300 ring-inset">
                    <FolhaEtiqueta ativo={exemplo} qrSvg={qrExemplo} larg={larg} alt={alt} deslocX={deslocX} deslocY={deslocY} />
                  </div>
                </CaberNaLargura>
              </div>
            )}
            <Botao variante="secundario" className="w-full" onClick={imprimirTeste} carregando={preparando} disabled={!exemplo}>
              <Printer size={15} /> Imprimir 1 de teste{exemplo ? ` (${exemplo.codigo})` : ''}
            </Botao>
            <AjustePosicao
              deslocX={deslocX}
              deslocY={deslocY}
              titulo="Saiu torta? Mova para o lado que falta"
              aoMudar={(x, y) => {
                setDeslocX(x)
                setDeslocY(y)
              }}
            />
          </Cartao>

          <Cartao className="space-y-3 p-4">
            <Passo numero={3} titulo="Ficou certa? Imprima todas" />
            {testeId && marcados.some((a) => a.id === testeId) && (
              <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-sky-600"
                  checked={pularTeste}
                  onChange={(e) => setPularTeste(e.target.checked)}
                />
                <span>Não imprimir de novo a {marcados.find((a) => a.id === testeId)?.codigo} — a do teste saiu boa</span>
              </label>
            )}
            <Botao className="w-full" onClick={imprimir} carregando={preparando} disabled={!paraImprimir.length}>
              <Printer size={15} /> Imprimir {paraImprimir.length} {paraImprimir.length === 1 ? 'etiqueta' : 'etiquetas'}
            </Botao>
            <Erro erro={erro} />
            <p className="text-xs text-slate-500">
              Na janela da impressora, deixe a escala em <strong>100%</strong> e desmarque
              &ldquo;ajustar à página&rdquo;. O tamanho e o ajuste ficam guardados neste
              aparelho para a próxima vez.
            </p>
          </Cartao>
        </div>
      </div>

      {lote &&
        createPortal(
          <div className="so-impressao etiquetas-lote">
            <style>{`@page { size: ${larg}mm ${alt}mm; margin: 0; }`}</style>
            {lote.map(({ ativo, svg }) => (
              <div key={ativo.id} className="etiqueta-pagina">
                <FolhaEtiqueta ativo={ativo} qrSvg={svg} larg={larg} alt={alt} deslocX={deslocX} deslocY={deslocY} />
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

function Passo({ numero, titulo }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <span className="flex size-6 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
        {numero}
      </span>
      {titulo}
    </p>
  )
}

const PX_POR_MM = 96 / 25.4

/**
 * Encolhe a prévia quando a etiqueta é mais larga que a coluna (no
 * celular, sempre). Só a prévia: a impressão continua no tamanho real.
 */
function CaberNaLargura({ larguraMm, alturaMm, children }) {
  const caixa = useRef(null)
  const [disponivel, setDisponivel] = useState(null)

  useEffect(() => {
    const el = caixa.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(([e]) => setDisponivel(e.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const natural = larguraMm * PX_POR_MM
  const escala = disponivel ? Math.min(1, disponivel / natural) : 1
  return (
    <div ref={caixa} className="w-full">
      <div className="mx-auto" style={{ width: natural * escala, height: alturaMm * PX_POR_MM * escala }}>
        <div style={{ width: natural, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
