import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Maximize2, Plus, Minus, Move, Check, RotateCw, MapPin, X, ArrowRight, LayoutGrid,
  Workflow, Trash2, Link2,
} from 'lucide-react'
import {
  useTabela, useUnidades, useQuadros, useAtualizar, useInvalidar, useInserir, useRemover,
} from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import { moeda, data } from '../lib/format'
import { M_CRITICIDADE, M_SITUACAO } from '../lib/constants'
import {
  caixa, temPosicao, contexto, legenda, cor, CAMADAS, primeiroLugarLivre,
  enderecoDaMaquina, celula,
} from '../lib/planta'
import {
  Botao, Cartao, Etiqueta, Carregando, Vazio, Selecao, Entrada, Campo, useAviso,
} from '../components/ui'
import PlantaCanvas from '../components/PlantaCanvas'

const INVALIDAR = ['vw_planta_ativos', 'ativos']
const INVALIDAR_FLUXO = ['vw_etapas_processo', 'vw_fluxo_processo', 'etapas_processo', 'fluxo_etapas']

/** Linha de dado do cartão de detalhe. */
const Linha = ({ rotulo, children }) =>
  children ? (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-xs text-slate-500">{rotulo}</span>
      <span className="text-right text-sm font-medium text-slate-800">{children}</span>
    </div>
  ) : null

export default function Planta() {
  const { ehGestor } = useAuth()
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const camera = useRef(null)

  const [unidadeId, setUnidadeId] = useState('')
  const [camada, setCamada] = useState('situacao')
  const [editando, setEditando] = useState(false)
  const [selecionada, setSelecionada] = useState(null)
  const [sobMouse, setSobMouse] = useState(null)
  // posição enquanto o dedo/mouse ainda está arrastando: o banco só é tocado
  // quando solta, senão seria uma gravação por pixel percorrido
  const [rascunho, setRascunho] = useState({})
  const [mostrarFluxo, setMostrarFluxo] = useState(false)
  const [etapaSel, setEtapaSel] = useState(null)
  const [rascunhoEtapa, setRascunhoEtapa] = useState({})
  const [novaEtapa, setNovaEtapa] = useState('')
  const [ligarA, setLigarA] = useState('')
  const [ligarTipo, setLigarTipo] = useState('principal')

  const unidades = useUnidades()
  const unidadeAtual = unidadeId || unidades.data?.[0]?.id || ''
  const quadros = useQuadros(unidadeAtual || undefined)

  const plantas = useTabela('plantas', {
    filtros: [
      ['ativo', 'eq', true],
      ...(unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : []),
    ],
    ordem: { coluna: 'nome' },
  })
  const planta = plantas.data?.[0]

  const todas = useTabela('vw_planta_ativos', { ordem: { coluna: 'nome' } })
  const atualizar = useAtualizar('ativos', INVALIDAR)

  const etapasBanco = useTabela('vw_etapas_processo', { ordem: { coluna: 'ordem' } })
  const ligacoes = useTabela('vw_fluxo_processo')
  const criarEtapa = useInserir('etapas_processo', INVALIDAR_FLUXO)
  const atualizarEtapa = useAtualizar('etapas_processo', INVALIDAR_FLUXO)
  const removerEtapa = useRemover('etapas_processo', INVALIDAR_FLUXO)
  const criarLigacao = useInserir('fluxo_etapas', INVALIDAR_FLUXO)
  const removerLigacao = useRemover('fluxo_etapas', INVALIDAR_FLUXO)

  const etapas = useMemo(
    () =>
      (etapasBanco.data || [])
        .filter((e) => !unidadeAtual || e.unidade_id === unidadeAtual)
        .map((e) => (rascunhoEtapa[e.etapa_id] ? { ...e, ...rascunhoEtapa[e.etapa_id] } : e)),
    [etapasBanco.data, unidadeAtual, rascunhoEtapa]
  )
  const ligacoesDaUnidade = useMemo(
    () => (ligacoes.data || []).filter((l) => !unidadeAtual || l.unidade_id === unidadeAtual),
    [ligacoes.data, unidadeAtual]
  )
  const etapaAberta = etapas.find((e) => e.etapa_id === etapaSel) || null

  const daUnidade = useMemo(
    () => (todas.data || []).filter((m) => !unidadeAtual || m.unidade === unidades.data?.find((u) => u.id === unidadeAtual)?.nome),
    [todas.data, unidadeAtual, unidades.data]
  )

  const noChao = useMemo(
    () =>
      daUnidade
        .filter((m) => temPosicao(m) && m.planta_id === planta?.id)
        .map((m) => (rascunho[m.ativo_id] ? { ...m, ...rascunho[m.ativo_id] } : m)),
    [daUnidade, planta?.id, rascunho]
  )

  const foraDaPlanta = useMemo(
    () => daUnidade.filter((m) => !temPosicao(m) || m.planta_id !== planta?.id),
    [daUnidade, planta?.id]
  )

  const ctx = useMemo(() => contexto(noChao, quadros.data || []), [noChao, quadros.data])
  const itensLegenda = useMemo(() => legenda(camada, noChao, ctx), [camada, noChao, ctx])

  const detalhe = selecionada
    ? noChao.find((m) => m.ativo_id === selecionada) || foraDaPlanta.find((m) => m.ativo_id === selecionada)
    : sobMouse

  // ------------------------------------------------------------- ações

  const mover = (id, x, y) => setRascunho((r) => ({ ...r, [id]: { pos_x_m: x, pos_y_m: y } }))

  const gravarPosicao = async (id) => {
    const pos = rascunho[id]
    if (!pos) return
    try {
      await atualizar.mutateAsync({ id, ...pos })
      setRascunho((r) => {
        const { [id]: _, ...resto } = r
        return resto
      })
    } catch (e) {
      avisar(`Não consegui salvar a posição: ${e.message}`)
    }
  }

  const colocarNaPlanta = async (m) => {
    const c = caixa(m)
    const lugar = primeiroLugarLivre(c.w, c.h, noChao.map(caixa), planta)
    try {
      await atualizar.mutateAsync({
        id: m.ativo_id,
        planta_id: planta.id,
        pos_x_m: lugar.x,
        pos_y_m: lugar.y,
      })
      invalidar(...INVALIDAR)
      setSelecionada(m.ativo_id)
      avisar(`${m.nome} entrou na planta. Arraste para o lugar certo.`)
    } catch (e) {
      avisar(`Não consegui colocar na planta: ${e.message}`)
    }
  }

  const tirarDaPlanta = async (m) => {
    await atualizar.mutateAsync({ id: m.ativo_id, planta_id: null, pos_x_m: null, pos_y_m: null })
    invalidar(...INVALIDAR)
    setSelecionada(null)
  }

  const girar = async (m) => {
    const novo = ((m.rotacao || 0) + 90) % 360
    await atualizar.mutateAsync({ id: m.ativo_id, rotacao: novo })
    invalidar(...INVALIDAR)
  }

  const medir = async (m, campo, valor) => {
    const n = Number(String(valor).replace(',', '.'))
    if (!(n > 0)) return
    await atualizar.mutateAsync({ id: m.ativo_id, [campo]: n })
    invalidar(...INVALIDAR)
  }

  const moverEtapa = (id, x, y) =>
    setRascunhoEtapa((r) => ({ ...r, [id]: { pos_x_m: x, pos_y_m: y } }))

  const gravarEtapa = async (id) => {
    const pos = rascunhoEtapa[id]
    if (!pos) return
    try {
      await atualizarEtapa.mutateAsync({ id, ...pos })
      setRascunhoEtapa((r) => {
        const { [id]: _, ...resto } = r
        return resto
      })
    } catch (e) {
      avisar(`Não consegui salvar a etapa: ${e.message}`)
    }
  }

  const adicionarEtapa = async () => {
    const nome = novaEtapa.trim()
    if (!nome) return
    try {
      const e = await criarEtapa.mutateAsync({
        unidade_id: unidadeAtual,
        planta_id: planta.id,
        nome,
        pos_x_m: Number(planta.comprimento_m) / 2,
        pos_y_m: Number(planta.largura_m) / 2,
        ordem: etapas.length + 1,
      })
      invalidar(...INVALIDAR_FLUXO)
      setNovaEtapa('')
      setEtapaSel(e.id)
      avisar(`Etapa "${nome}" criada. Arraste para o lugar dela.`)
    } catch (err) {
      avisar(`Não consegui criar: ${err.message}`)
    }
  }

  const ligar = async () => {
    if (!etapaAberta || !ligarA) return
    try {
      await criarLigacao.mutateAsync({
        de_id: etapaAberta.etapa_id,
        para_id: ligarA,
        tipo: ligarTipo,
      })
      invalidar(...INVALIDAR_FLUXO)
      setLigarA('')
      avisar('Ligação criada.')
    } catch (e) {
      // a única violação provável aqui é ligar duas vezes o mesmo par
      avisar(
        /duplicate|unique/i.test(e.message)
          ? 'Essas duas etapas já estão ligadas.'
          : `Não consegui ligar: ${e.message}`
      )
    }
  }

  // ------------------------------------------------------------- telas

  if (plantas.isLoading || todas.isLoading) return <Carregando />

  if (!planta) {
    return (
      <Vazio
        icone={LayoutGrid}
        titulo="Nenhuma planta cadastrada nesta unidade"
        descricao="A planta guarda a medida do galpão e a posição de cada máquina no chão."
      />
    )
  }

  const area = Math.round(Number(planta.comprimento_m) * Number(planta.largura_m))
  const paradas = noChao.filter((m) => m.situacao === 'parado').length

  const cartaoDetalhe = detalhe && (
    <Cartao className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{detalhe.nome}</p>
          <p className="font-mono text-xs text-slate-500">{detalhe.codigo}</p>
          {enderecoDaMaquina(detalhe, planta) && (
            <p className="mt-1 inline-flex items-baseline gap-1.5 rounded-md bg-slate-900
              px-2 py-0.5 text-xs font-semibold text-white">
              <span className="font-mono">{enderecoDaMaquina(detalhe, planta).curto}</span>
              <span className="font-normal text-slate-300">
                {enderecoDaMaquina(detalhe, planta).completo}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setSelecionada(null)
            setSobMouse(null)
          }}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Etiqueta cor={M_SITUACAO[detalhe.situacao]?.cor}>
          {M_SITUACAO[detalhe.situacao]?.label}
        </Etiqueta>
        <Etiqueta cor={M_CRITICIDADE[detalhe.criticidade]?.cor}>
          Importância {detalhe.criticidade}
        </Etiqueta>
        {Number(detalhe.os_abertas) > 0 && (
          <Etiqueta cor="bg-slate-900 text-white ring-slate-900">
            {detalhe.os_abertas} serviço{Number(detalhe.os_abertas) > 1 ? 's' : ''} em aberto
          </Etiqueta>
        )}
      </div>

      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-1">
        <Linha rotulo="Setor">{detalhe.setor}</Linha>
        <Linha rotulo="Categoria">{detalhe.categoria}</Linha>
        <Linha rotulo="Gasto no último ano">{moeda(detalhe.custo_12m)}</Linha>
        <Linha rotulo="Última manutenção">
          {detalhe.ultima_manutencao ? data(detalhe.ultima_manutencao) : null}
        </Linha>
        <Linha rotulo="Quadro que alimenta">{detalhe.quadro}</Linha>
        <Linha rotulo="Ocupa no chão">
          {detalhe.comp_m && detalhe.larg_m
            ? `${detalhe.comp_m} × ${detalhe.larg_m} m`
            : 'medida não informada'}
        </Linha>
      </div>

      {editando && ehGestor && temPosicao(detalhe) && (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Comprimento (m)">
              <Entrada
                type="number"
                step="0.1"
                min="0.1"
                defaultValue={detalhe.comp_m ?? ''}
                onBlur={(e) => medir(detalhe, 'comp_m', e.target.value)}
              />
            </Campo>
            <Campo rotulo="Largura (m)">
              <Entrada
                type="number"
                step="0.1"
                min="0.1"
                defaultValue={detalhe.larg_m ?? ''}
                onBlur={(e) => medir(detalhe, 'larg_m', e.target.value)}
              />
            </Campo>
          </div>
          <div className="flex gap-2">
            <Botao variante="secundario" tamanho="sm" onClick={() => girar(detalhe)}>
              <RotateCw size={14} /> Girar
            </Botao>
            <Botao variante="secundario" tamanho="sm" onClick={() => tirarDaPlanta(detalhe)}>
              <X size={14} /> Tirar da planta
            </Botao>
          </div>
        </div>
      )}

      <Link to={`/ativos/${detalhe.ativo_id}`} className="mt-3 block">
        <Botao variante="secundario" className="w-full">
          Abrir a máquina <ArrowRight size={14} />
        </Botao>
      </Link>
    </Cartao>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Planta do galpão</h1>
          <p className="text-sm text-slate-500">
            {planta.comprimento_m} × {planta.largura_m} m · {area.toLocaleString('pt-BR')} m²
            {planta.vao_pilar_m ? ` · vão de ${planta.vao_pilar_m} m entre pilares` : ''} ·{' '}
            {noChao.length} de {daUnidade.length} máquinas posicionadas
            {paradas > 0 && <span className="font-medium text-red-600"> · {paradas} parada(s)</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(unidades.data || []).length > 1 && (
            <Selecao
              value={unidadeAtual}
              onChange={(e) => {
                setUnidadeId(e.target.value)
                setSelecionada(null)
              }}
              className="w-auto max-w-44"
            >
              {(unidades.data || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Selecao>
          )}
          <Botao
            variante={mostrarFluxo ? 'primario' : 'secundario'}
            onClick={() => {
              setMostrarFluxo((v) => !v)
              setEtapaSel(null)
            }}
          >
            <Workflow size={15} /> Fluxo do processo
          </Botao>
          {ehGestor && (
            <Botao
              variante={editando ? 'sucesso' : 'secundario'}
              onClick={() => {
                setEditando((v) => !v)
                setSelecionada(null)
              }}
            >
              {editando ? <Check size={15} /> : <Move size={15} />}
              {editando ? 'Pronto' : 'Posicionar máquinas'}
            </Botao>
          )}
        </div>
      </div>

      {/* camada + legenda */}
      <Cartao className="p-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Selecao value={camada} onChange={(e) => setCamada(e.target.value)} className="w-auto">
            {CAMADAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {itensLegenda.map((l) => (
              <span key={l.chave} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="size-3 shrink-0 rounded-sm ring-1"
                  style={{ background: l.cor.fundo, borderColor: l.cor.borda, boxShadow: `inset 0 0 0 1px ${l.cor.borda}` }}
                />
                {l.rotulo}
                {l.n != null && <span className="font-semibold text-slate-500">({l.n})</span>}
              </span>
            ))}
          </div>
        </div>
      </Cartao>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="relative">
          {/* No celular vale a altura fixa e a largura da tela. No computador a
              proporção da planta manda, para não sobrar faixa branca em cima e
              embaixo.

              Cuidado ao mexer aqui: aspect-ratio junto com QUALQUER altura
              definida (h, min-h) faz o navegador calcular a LARGURA a partir
              dela. Numa planta de 86 x 30, isso estica o cartão para mais de
              700px e estoura a tela do celular inteira. Por isso a proporção
              só entra a partir de lg, onde a altura é auto. */}
          <Cartao
            className="h-[38vh] overflow-hidden lg:h-auto lg:aspect-[var(--proporcao)]"
            style={{ '--proporcao': `${Number(planta.comprimento_m) + 12} / ${Number(planta.largura_m) + 12}` }}
          >
            {noChao.length === 0 && !editando ? (
              <Vazio
                icone={MapPin}
                titulo="Nenhuma máquina posicionada ainda"
                descricao={
                  ehGestor
                    ? 'Clique em "Posicionar máquinas" e arraste cada uma para o lugar dela no galpão.'
                    : 'Quando o gestor posicionar as máquinas, o mapa aparece aqui.'
                }
              />
            ) : (
              <PlantaCanvas
                planta={planta}
                maquinas={noChao}
                camada={camada}
                ctx={ctx}
                selecionada={selecionada}
                aoSelecionar={(m) => setSelecionada(m?.ativo_id ?? null)}
                aoPassarMouse={setSobMouse}
                modoEditar={editando && ehGestor}
                aoMover={mover}
                aoTerminarArraste={gravarPosicao}
                refCamera={camera}
                etapas={etapas}
                ligacoes={ligacoesDaUnidade}
                mostrarFluxo={mostrarFluxo}
                etapaSelecionada={etapaSel}
                aoSelecionarEtapa={(e) => setEtapaSel(e?.etapa_id ?? null)}
                aoMoverEtapa={moverEtapa}
                aoTerminarArrasteEtapa={gravarEtapa}
              />
            )}
          </Cartao>

          <div className="nao-imprimir absolute top-3 right-3 z-10 flex flex-col gap-1 rounded-lg
            bg-white/95 p-1 shadow ring-1 ring-slate-200 lg:top-auto lg:bottom-3">
            <button
              onClick={() => camera.current?.aproximar()}
              className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Aproximar"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => camera.current?.afastar()}
              className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Afastar"
            >
              <Minus size={16} />
            </button>
            <button
              onClick={() => camera.current?.encaixar()}
              className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Encaixar na tela"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {mostrarFluxo && (
            <Cartao className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">Fluxo do processo</p>
                <span className="text-xs text-slate-500">{etapas.length} etapas</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-5 bg-indigo-700" /> caminho principal
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-0.5 w-5"
                    style={{ backgroundImage: 'repeating-linear-gradient(90deg,#7c3aed 0 3px,transparent 3px 6px)' }}
                  />
                  às vezes acontece
                </span>
              </div>

              {ehGestor && editando && (
                <div className="mt-3 flex gap-2">
                  <Entrada
                    value={novaEtapa}
                    onChange={(e) => setNovaEtapa(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && adicionarEtapa()}
                    placeholder="Nova etapa (ex.: Costura)"
                  />
                  <Botao onClick={adicionarEtapa} disabled={!novaEtapa.trim()}>
                    <Plus size={15} />
                  </Botao>
                </div>
              )}

              <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
                {etapas.map((e) => {
                  const saidas = ligacoesDaUnidade.filter((l) => l.de_id === e.etapa_id)
                  return (
                    <button
                      key={e.etapa_id}
                      onClick={() => setEtapaSel(e.etapa_id === etapaSel ? null : e.etapa_id)}
                      className={`w-full rounded-lg px-2 py-1.5 text-left transition ${
                        etapaSel === e.etapa_id ? 'bg-indigo-50 ring-1 ring-indigo-300' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                          {e.nome}
                        </span>
                        {Number(e.maquinas_paradas) > 0 && (
                          <span className="shrink-0 rounded bg-red-100 px-1.5 text-[11px] font-semibold text-red-700">
                            {e.maquinas_paradas} parada
                          </span>
                        )}
                        {e.pos_x_m == null && (
                          <span className="shrink-0 text-[11px] text-slate-400">fora do galpão</span>
                        )}
                      </span>
                      {saidas.length > 0 && (
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          → {saidas.map((l) => l.para_nome).join(', ')}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {etapaAberta && ehGestor && editando && (
                <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-600">
                    De <strong>{etapaAberta.nome}</strong>, o material vai para:
                  </p>
                  <Selecao value={ligarA} onChange={(ev) => setLigarA(ev.target.value)}>
                    <option value="">Escolha a etapa seguinte…</option>
                    {etapas
                      .filter((e) => e.etapa_id !== etapaAberta.etapa_id)
                      .map((e) => (
                        <option key={e.etapa_id} value={e.etapa_id}>
                          {e.nome}
                          {e.pos_x_m == null ? ' (outro galpão)' : ''}
                        </option>
                      ))}
                  </Selecao>
                  <Selecao value={ligarTipo} onChange={(ev) => setLigarTipo(ev.target.value)}>
                    <option value="principal">Sempre passa por aqui</option>
                    <option value="alternativa">Só às vezes</option>
                  </Selecao>
                  <Botao onClick={ligar} disabled={!ligarA} className="w-full">
                    <Link2 size={14} /> Ligar
                  </Botao>

                  {ligacoesDaUnidade
                    .filter((l) => l.de_id === etapaAberta.etapa_id)
                    .map((l) => (
                      <div
                        key={l.ligacao_id}
                        className="flex items-center gap-2 rounded bg-white px-2 py-1 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate text-slate-600">
                          → {l.para_nome}
                          {l.tipo === 'alternativa' && (
                            <span className="text-violet-600"> · só às vezes</span>
                          )}
                        </span>
                        <button
                          onClick={async () => {
                            await removerLigacao.mutateAsync(l.ligacao_id)
                            invalidar(...INVALIDAR_FLUXO)
                          }}
                          className="shrink-0 text-slate-400 hover:text-red-600"
                          aria-label="Apagar ligação"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}

                  <button
                    onClick={async () => {
                      await removerEtapa.mutateAsync(etapaAberta.etapa_id)
                      invalidar(...INVALIDAR_FLUXO)
                      setEtapaSel(null)
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={13} /> Apagar a etapa {etapaAberta.nome}
                  </button>
                </div>
              )}
            </Cartao>
          )}

          <div className="hidden lg:block">{cartaoDetalhe}</div>

          {editando && ehGestor && (
            <Cartao className="p-4">
              <p className="text-sm font-semibold text-slate-800">
                Ainda fora da planta ({foraDaPlanta.length})
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Toque para colocar no galpão, depois arraste até o lugar.
              </p>
              {foraDaPlanta.length === 0 ? (
                <p className="mt-3 text-sm text-emerald-700">Todas as máquinas já estão na planta.</p>
              ) : (
                <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
                  {foraDaPlanta.map((m) => (
                    <button
                      key={m.ativo_id}
                      onClick={() => colocarNaPlanta(m)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left
                        transition hover:bg-sky-50"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ background: cor('situacao', m).borda }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-700">{m.nome}</span>
                        <span className="block font-mono text-[11px] text-slate-400">{m.codigo}</span>
                      </span>
                      <Plus size={14} className="shrink-0 text-sky-600" />
                    </button>
                  ))}
                </div>
              )}
            </Cartao>
          )}

          {!detalhe && !editando && (
            <Cartao className="hidden p-4 lg:block">
              <p className="text-sm text-slate-500">
                Cada quadrado de {celula(planta)} × {celula(planta)} m tem endereço: o número
                do vão (que você conta pelos pilares) cruzado com a letra da faixa. O canto de
                entrada é o <span className="font-mono font-semibold">1A</span>.
                <span className="mt-2 block">
                  Passe o mouse pelo galpão que o endereço aparece embaixo, ao vivo.
                </span>
              </p>
            </Cartao>
          )}
        </div>
      </div>

      {/* No celular não existe passar o mouse: o toque abre esta folha, que fica
          presa embaixo para não obrigar ninguém a rolar a tela atrás dela. */}
      {selecionada && detalhe && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[48vh] overflow-y-auto
          border-t border-slate-200 bg-slate-50 p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.12)] lg:hidden">
          {cartaoDetalhe}
        </div>
      )}
    </div>
  )
}
