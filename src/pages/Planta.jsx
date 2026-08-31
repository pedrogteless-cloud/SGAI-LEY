import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Maximize2, Plus, Minus, Move, Check, RotateCw, MapPin, X, ArrowRight, ArrowLeft,
  ArrowUp, ArrowDown, LayoutGrid, Workflow, Zap, Flame, Layers, Trash2, Link2, Save,
  PlugZap, Cable,
} from 'lucide-react'
import {
  useTabela, useUnidades, useQuadros, useAtualizar, useInvalidar, useInserir, useRemover,
} from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { moeda, data } from '../lib/format'
import { M_CRITICIDADE, M_SITUACAO } from '../lib/constants'
import {
  caixa, temPosicao, contexto, legenda, cor, CAMADAS, primeiroLugarLivre,
  enderecoDaMaquina, CELULA_COMPRIMENTO, CELULA_LARGURA, encaixar, prender, PASSO,
} from '../lib/planta'
import {
  Botao, Cartao, Etiqueta, Carregando, Vazio, Selecao, Entrada, Campo, Modal, useAviso,
} from '../components/ui'
import PlantaCanvas from '../components/PlantaCanvas'

const TIPOS_INSTALACAO_CABO = [
  { valor: 'aparente', label: 'Aparente' },
  { valor: 'eletroduto', label: 'Eletroduto' },
  { valor: 'eletrocalha', label: 'Eletrocalha' },
  { valor: 'embutido', label: 'Embutido' },
  { valor: 'subterraneo', label: 'Subterrâneo' },
]
const CAMPO_CABO_VAZIO = {
  cabo_descricao: '', cabo_bitola_mm2: '', cabo_comprimento_m: '',
  cabo_tipo_instalacao: 'eletrocalha', disjuntor: '', circuito: '',
  ficha_tensao_v: '', corrente_nominal_a: '',
}

const INVALIDAR = ['vw_planta_ativos', 'ativos']
const INVALIDAR_FLUXO = ['vw_esquema_nos', 'vw_esquema_ligacoes', 'esquema_nos', 'esquema_ligacoes']
const INVALIDAR_ESQUEMAS = [...INVALIDAR_FLUXO, 'esquemas']

// Ícone e exemplo de item mudam com o nome do esquema — Produção, Energia e
// Bombeiros já vêm com uma cara própria; um esquema que o gestor inventar cai
// no genérico (Layers), sem precisar escolher ícone.
const ICONE_ESQUEMA = { Workflow, Zap, Flame }
const EXEMPLO_ITEM = { Produção: 'Costura', Energia: 'Gerador', Bombeiros: 'Hidrante' }
const CORES_ESQUEMA = ['#4338ca', '#d97706', '#dc2626', '#0891b2', '#16a34a', '#be185d']
const PASSOS_AJUSTE = [0.1, PASSO, 1]
const CAMPO_VAZIO = { id: null, comp_m: '', larg_m: '', pos_x_m: '', pos_y_m: '' }

const paraCampo = (valor) => (valor == null || valor === '' ? '' : String(valor))
const numeroCampo = (valor) => Number(String(valor).replace(',', '.'))

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
  const [passoAjuste, setPassoAjuste] = useState(PASSO)
  const [edicao, setEdicao] = useState(CAMPO_VAZIO)
  // posição enquanto o dedo/mouse ainda está arrastando: o banco só é tocado
  // quando solta, senão seria uma gravação por pixel percorrido
  const [rascunho, setRascunho] = useState({})
  // qual esquema está ligado — null é "nenhum", cada esquema (Produção,
  // Energia, Bombeiros…) é um mapa próprio sobre a mesma planta
  const [esquemaAtivoId, setEsquemaAtivoId] = useState(null)
  const [criandoEsquema, setCriandoEsquema] = useState(false)
  const [novoEsquemaNome, setNovoEsquemaNome] = useState('')
  const [novoEsquemaCor, setNovoEsquemaCor] = useState(CORES_ESQUEMA[0])
  const [etapaSel, setEtapaSel] = useState(null)
  const [rascunhoEtapa, setRascunhoEtapa] = useState({})
  const [novaEtapa, setNovaEtapa] = useState('')
  const [ligarA, setLigarA] = useState('')
  const [ligarTipo, setLigarTipo] = useState('principal')

  // -------------------------------------------------------------- energia
  const [quadroArmado, setQuadroArmado] = useState(null)
  const [novoQuadroNome, setNovoQuadroNome] = useState('')
  const [criandoQuadro, setCriandoQuadro] = useState(false)
  const [caboEditando, setCaboEditando] = useState(null) // ativo_id
  const [campoCabo, setCampoCabo] = useState(CAMPO_CABO_VAZIO)
  const [rascunhoQuadro, setRascunhoQuadro] = useState({})
  const [rotaEditando, setRotaEditando] = useState(null) // { ativoId, quadroId, pontos: [{x,y}] }

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

  const esquemasBanco = useTabela('esquemas', {
    filtros: [
      ['ativo', 'eq', true],
      ...(unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : []),
    ],
    ordem: { coluna: 'ordem' },
  })
  const criarEsquema = useInserir('esquemas', INVALIDAR_ESQUEMAS)

  const etapasBanco = useTabela('vw_esquema_nos', { ordem: { coluna: 'ordem' } })
  const ligacoes = useTabela('vw_esquema_ligacoes')
  const criarEtapa = useInserir('esquema_nos', INVALIDAR_FLUXO)
  const atualizarEtapa = useAtualizar('esquema_nos', INVALIDAR_FLUXO)
  const removerEtapa = useRemover('esquema_nos', INVALIDAR_FLUXO)
  const criarLigacao = useInserir('esquema_ligacoes', INVALIDAR_FLUXO)
  const removerLigacao = useRemover('esquema_ligacoes', INVALIDAR_FLUXO)

  // -------------------------------------------------------------- energia
  const quadrosBanco = useTabela('vw_planta_quadros', {
    filtros: [...(unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : [])],
    ordem: { coluna: 'nome' },
  })
  const criarQuadroDb = useInserir('quadros_eletricos', ['vw_planta_quadros', 'quadros_eletricos'])
  const cliente = useQueryClient()
  const invalidarEnergia = () => {
    cliente.invalidateQueries({ queryKey: ['vw_planta_quadros'] })
    cliente.invalidateQueries({ queryKey: ['vw_planta_ativos'] })
  }

  const moverQuadroDb = useMutation({
    mutationFn: async ({ id, pos_x_m, pos_y_m }) =>
      supabase.from('quadros_eletricos').update({ pos_x_m, pos_y_m }).eq('id', id)
        .then(({ error }) => { if (error) throw new Error(error.message) }),
    onSuccess: invalidarEnergia,
  })

  const ligarCaboDb = useMutation({
    mutationFn: async ({ ativoId, quadroId }) =>
      supabase.from('ativo_ficha_eletrica')
        .upsert({ ativo_id: ativoId, quadro_id: quadroId }, { onConflict: 'ativo_id' })
        .then(({ error }) => { if (error) throw new Error(error.message) }),
    onSuccess: invalidarEnergia,
  })

  const salvarCaboDb = useMutation({
    mutationFn: async ({ ativoId, campos }) =>
      supabase.from('ativo_ficha_eletrica')
        .upsert({ ativo_id: ativoId, ...campos }, { onConflict: 'ativo_id' })
        .then(({ error }) => { if (error) throw new Error(error.message) }),
    onSuccess: invalidarEnergia,
  })

  const quadrosEnergia = useMemo(
    () => (quadrosBanco.data || []).map((q) => (rascunhoQuadro[q.quadro_id] ? { ...q, ...rascunhoQuadro[q.quadro_id] } : q)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quadrosBanco.data]
  )

  const esquemas = esquemasBanco.data || []
  const esquemaAtivo = esquemas.find((e) => e.id === esquemaAtivoId) || null
  const corAtiva = esquemaAtivo?.cor || CORES_ESQUEMA[0]

  const etapas = useMemo(
    () =>
      (etapasBanco.data || [])
        .filter((e) => e.esquema_id === esquemaAtivoId)
        .map((e) => (rascunhoEtapa[e.etapa_id ?? e.no_id] ? { ...e, ...rascunhoEtapa[e.etapa_id ?? e.no_id] } : e))
        .map((e) => ({ ...e, etapa_id: e.no_id ?? e.etapa_id })),
    [etapasBanco.data, esquemaAtivoId, rascunhoEtapa]
  )
  const ligacoesDaUnidade = useMemo(
    () => (ligacoes.data || []).filter((l) => l.esquema_id === esquemaAtivoId),
    [ligacoes.data, esquemaAtivoId]
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

  const maquinaSelecionada = selecionada ? noChao.find((m) => m.ativo_id === selecionada) : null
  const detalhe = selecionada
    ? maquinaSelecionada || foraDaPlanta.find((m) => m.ativo_id === selecionada)
    : sobMouse

  useEffect(() => {
    if (!maquinaSelecionada || !editando || !ehGestor) {
      setEdicao(CAMPO_VAZIO)
      return
    }
    setEdicao({
      id: maquinaSelecionada.ativo_id,
      comp_m: paraCampo(maquinaSelecionada.comp_m),
      larg_m: paraCampo(maquinaSelecionada.larg_m),
      pos_x_m: paraCampo(maquinaSelecionada.pos_x_m),
      pos_y_m: paraCampo(maquinaSelecionada.pos_y_m),
    })
  }, [maquinaSelecionada?.ativo_id, editando, ehGestor])

  // ------------------------------------------------------------- ações

  const mover = (id, x, y) => {
    setRascunho((r) => ({ ...r, [id]: { pos_x_m: x, pos_y_m: y } }))
    setEdicao((e) =>
      e.id === id ? { ...e, pos_x_m: paraCampo(x), pos_y_m: paraCampo(y) } : e
    )
  }

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
    const c = caixa({ ...m, rotacao: novo })
    const pos = prender(c.x, c.y, c.w, c.h, planta)
    try {
      await atualizar.mutateAsync({
        id: m.ativo_id,
        rotacao: novo,
        pos_x_m: pos.x,
        pos_y_m: pos.y,
      })
      setEdicao((e) =>
        e.id === m.ativo_id ? { ...e, pos_x_m: paraCampo(pos.x), pos_y_m: paraCampo(pos.y) } : e
      )
      invalidar(...INVALIDAR)
    } catch (e) {
      avisar(`Não consegui girar: ${e.message}`, 'erro')
    }
  }

  const salvarMedida = async (m) => {
    const comp = numeroCampo(edicao.comp_m)
    const larg = numeroCampo(edicao.larg_m)
    if (!(comp > 0) || !(larg > 0)) {
      avisar('Informe comprimento e largura maiores que zero.', 'erro')
      return
    }
    const c = caixa({ ...m, comp_m: comp, larg_m: larg })
    const pos = prender(c.x, c.y, c.w, c.h, planta)
    try {
      await atualizar.mutateAsync({
        id: m.ativo_id,
        comp_m: comp,
        larg_m: larg,
        pos_x_m: pos.x,
        pos_y_m: pos.y,
      })
      setRascunho((r) => {
        const { [m.ativo_id]: _, ...resto } = r
        return resto
      })
      setEdicao((e) =>
        e.id === m.ativo_id
          ? {
              ...e,
              comp_m: paraCampo(comp),
              larg_m: paraCampo(larg),
              pos_x_m: paraCampo(pos.x),
              pos_y_m: paraCampo(pos.y),
            }
          : e
      )
      invalidar(...INVALIDAR)
      avisar('Medida salva.')
    } catch (e) {
      avisar(`Não consegui salvar a medida: ${e.message}`, 'erro')
    }
  }

  const salvarPosicao = async (m, xValor = edicao.pos_x_m, yValor = edicao.pos_y_m) => {
    const x = numeroCampo(xValor)
    const y = numeroCampo(yValor)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      avisar('Informe uma posição válida.', 'erro')
      return
    }
    const c = caixa({ ...m, pos_x_m: x, pos_y_m: y })
    const pos = prender(
      encaixar(x, passoAjuste),
      encaixar(y, passoAjuste),
      c.w,
      c.h,
      planta
    )
    setRascunho((r) => ({ ...r, [m.ativo_id]: { pos_x_m: pos.x, pos_y_m: pos.y } }))
    setEdicao((e) =>
      e.id === m.ativo_id ? { ...e, pos_x_m: paraCampo(pos.x), pos_y_m: paraCampo(pos.y) } : e
    )
    try {
      await atualizar.mutateAsync({ id: m.ativo_id, pos_x_m: pos.x, pos_y_m: pos.y })
      setRascunho((r) => {
        const { [m.ativo_id]: _, ...resto } = r
        return resto
      })
      invalidar(...INVALIDAR)
      avisar('Posição salva.')
    } catch (e) {
      avisar(`Não consegui salvar a posição: ${e.message}`, 'erro')
    }
  }

  const deslocar = (m, dx, dy) => {
    const x = numeroCampo(edicao.id === m.ativo_id ? edicao.pos_x_m : m.pos_x_m)
    const y = numeroCampo(edicao.id === m.ativo_id ? edicao.pos_y_m : m.pos_y_m)
    const c = caixa({ ...m, pos_x_m: x, pos_y_m: y })
    const pos = prender(
      encaixar((Number.isFinite(x) ? x : c.x) + dx, passoAjuste),
      encaixar((Number.isFinite(y) ? y : c.y) + dy, passoAjuste),
      c.w,
      c.h,
      planta
    )
    setRascunho((r) => ({ ...r, [m.ativo_id]: { pos_x_m: pos.x, pos_y_m: pos.y } }))
    setEdicao((e) =>
      e.id === m.ativo_id ? { ...e, pos_x_m: paraCampo(pos.x), pos_y_m: paraCampo(pos.y) } : e
    )
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
    if (!nome || !esquemaAtivoId) return
    try {
      const e = await criarEtapa.mutateAsync({
        unidade_id: unidadeAtual,
        esquema_id: esquemaAtivoId,
        planta_id: planta.id,
        nome,
        pos_x_m: Number(planta.comprimento_m) / 2,
        pos_y_m: Number(planta.largura_m) / 2,
        ordem: etapas.length + 1,
      })
      invalidar(...INVALIDAR_FLUXO)
      setNovaEtapa('')
      setEtapaSel(e.id)
      avisar(`"${nome}" criado. Arraste para o lugar dele.`)
    } catch (err) {
      avisar(
        /duplicate|unique/i.test(err.message)
          ? `Já existe um item chamado "${nome}" nesse esquema.`
          : `Não consegui criar: ${err.message}`
      )
    }
  }

  const adicionarEsquema = async () => {
    const nome = novoEsquemaNome.trim()
    if (!nome) return
    try {
      const es = await criarEsquema.mutateAsync({
        unidade_id: unidadeAtual,
        nome,
        cor: novoEsquemaCor,
        icone: 'Layers',
        ordem: esquemas.length + 1,
      })
      invalidar(...INVALIDAR_ESQUEMAS)
      setCriandoEsquema(false)
      setNovoEsquemaNome('')
      setEsquemaAtivoId(es.id)
      avisar(`Esquema "${nome}" criado.`)
    } catch (err) {
      avisar(
        /duplicate|unique/i.test(err.message)
          ? `Já existe um esquema chamado "${nome}".`
          : `Não consegui criar: ${err.message}`
      )
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

  const esquemaEnergiaAtivo = esquemaAtivo?.tipo === 'energia'

  const moverQuadro = (id, x, y) => setRascunhoQuadro((r) => ({ ...r, [id]: { pos_x_m: x, pos_y_m: y } }))

  const gravarQuadro = async (id) => {
    const pos = rascunhoQuadro[id]
    if (!pos) return
    try {
      await moverQuadroDb.mutateAsync({ id, ...pos })
      setRascunhoQuadro((r) => {
        const { [id]: _, ...resto } = r
        return resto
      })
    } catch (e) {
      avisar(`Não consegui salvar o quadro: ${e.message}`, 'erro')
    }
  }

  const colocarQuadroNaPlanta = async (q) => {
    try {
      await moverQuadroDb.mutateAsync({
        id: q.quadro_id,
        pos_x_m: Number(planta.comprimento_m) / 2,
        pos_y_m: Number(planta.largura_m) / 2,
      })
      await supabase.from('quadros_eletricos').update({ planta_id: planta.id }).eq('id', q.quadro_id)
      invalidarEnergia()
      setQuadroArmado(q.quadro_id)
      avisar(`${q.nome} entrou na planta. Arraste para o lugar certo.`)
    } catch (e) {
      avisar(`Não consegui colocar o quadro: ${e.message}`, 'erro')
    }
  }

  const criarQuadro = async () => {
    const nome = novoQuadroNome.trim()
    if (!nome || !unidadeAtual) return
    try {
      await criarQuadroDb.mutateAsync({ unidade_id: unidadeAtual, nome })
      setCriandoQuadro(false)
      setNovoQuadroNome('')
      avisar(`Quadro "${nome}" criado. Coloque na planta para puxar o cabo.`)
    } catch (err) {
      avisar(
        /duplicate|unique/i.test(err.message)
          ? `Já existe um quadro chamado "${nome}".`
          : `Não consegui criar: ${err.message}`
      )
    }
  }

  const aoClicarMaquinaEnergia = async (ativoId) => {
    if (!quadroArmado) return
    const m = noChao.find((x) => x.ativo_id === ativoId)
    const jaLigada = m?.quadro_id === quadroArmado
    try {
      await ligarCaboDb.mutateAsync({ ativoId, quadroId: jaLigada ? null : quadroArmado })
      avisar(jaLigada ? 'Cabo desligado.' : 'Cabo puxado. Clique nele para descrever a especificação.')
    } catch (e) {
      avisar(`Não consegui ligar o cabo: ${e.message}`, 'erro')
    }
  }

  const abrirEdicaoCabo = (ativoId) => {
    const m = noChao.find((x) => x.ativo_id === ativoId) || foraDaPlanta.find((x) => x.ativo_id === ativoId)
    if (!m) return
    setCampoCabo({
      cabo_descricao: m.cabo_descricao || '',
      cabo_bitola_mm2: paraCampo(m.cabo_bitola_mm2),
      cabo_comprimento_m: paraCampo(m.cabo_comprimento_m),
      cabo_tipo_instalacao: m.cabo_tipo_instalacao || 'eletrocalha',
      disjuntor: m.disjuntor || '',
      circuito: m.circuito || '',
      ficha_tensao_v: paraCampo(m.ficha_tensao_v),
      corrente_nominal_a: paraCampo(m.corrente_nominal_a),
    })
    setCaboEditando(ativoId)
  }

  const salvarCabo = async () => {
    try {
      await salvarCaboDb.mutateAsync({
        ativoId: caboEditando,
        campos: {
          cabo_descricao: campoCabo.cabo_descricao || null,
          cabo_bitola_mm2: campoCabo.cabo_bitola_mm2 === '' ? null : numeroCampo(campoCabo.cabo_bitola_mm2),
          cabo_comprimento_m: campoCabo.cabo_comprimento_m === '' ? null : numeroCampo(campoCabo.cabo_comprimento_m),
          cabo_tipo_instalacao: campoCabo.cabo_tipo_instalacao || null,
          disjuntor: campoCabo.disjuntor || null,
          circuito: campoCabo.circuito || null,
          tensao_v: campoCabo.ficha_tensao_v === '' ? null : numeroCampo(campoCabo.ficha_tensao_v),
          corrente_nominal_a: campoCabo.corrente_nominal_a === '' ? null : numeroCampo(campoCabo.corrente_nominal_a),
        },
      })
      avisar('Especificação do cabo salva.')
      setCaboEditando(null)
    } catch (e) {
      avisar(`Não consegui salvar: ${e.message}`, 'erro')
    }
  }

  // ---------------------------------------------------- rota do cabo (curvas)
  const iniciarRota = (ativoId, quadroId) => {
    const m = noChao.find((x) => x.ativo_id === ativoId)
    setCaboEditando(null)
    setRotaEditando({ ativoId, quadroId, pontos: Array.isArray(m?.cabo_pontos) ? [...m.cabo_pontos] : [] })
  }

  const adicionarPontoRota = (x, y) => {
    setRotaEditando((r) => {
      if (!r) return r
      const px = Math.round(encaixar(x, passoAjuste) * 100) / 100
      const py = Math.round(encaixar(y, passoAjuste) * 100) / 100
      return { ...r, pontos: [...r.pontos, { x: px, y: py }] }
    })
  }

  const removerPontoRota = (i) =>
    setRotaEditando((r) => (r ? { ...r, pontos: r.pontos.filter((_, j) => j !== i) } : r))

  const desfazerUltimoPontoRota = () =>
    setRotaEditando((r) => (r ? { ...r, pontos: r.pontos.slice(0, -1) } : r))

  const limparRota = () => setRotaEditando((r) => (r ? { ...r, pontos: [] } : r))

  const cancelarRota = () => setRotaEditando(null)

  const salvarRota = async () => {
    if (!rotaEditando) return
    try {
      await salvarCaboDb.mutateAsync({
        ativoId: rotaEditando.ativoId,
        campos: { cabo_pontos: rotaEditando.pontos },
      })
      avisar(rotaEditando.pontos.length ? 'Caminho do cabo salvo.' : 'Cabo voltou a ser reto.')
      setRotaEditando(null)
    } catch (e) {
      avisar(`Não consegui salvar o caminho: ${e.message}`, 'erro')
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

      {editando && ehGestor && temPosicao(detalhe) && selecionada === detalhe.ativo_id && (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">Medidas</p>
            <span className="text-xs text-slate-400">encaixe {String(passoAjuste).replace('.', ',')} m</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Comprimento (m)">
              <Entrada
                type="text"
                inputMode="decimal"
                value={edicao.comp_m}
                onChange={(e) => setEdicao((v) => ({ ...v, comp_m: e.target.value }))}
              />
            </Campo>
            <Campo rotulo="Largura (m)">
              <Entrada
                type="text"
                inputMode="decimal"
                value={edicao.larg_m}
                onChange={(e) => setEdicao((v) => ({ ...v, larg_m: e.target.value }))}
              />
            </Campo>
          </div>

          <Botao
            tamanho="sm"
            className="w-full"
            onClick={() => salvarMedida(detalhe)}
            carregando={atualizar.isPending}
          >
            <Save size={14} /> Salvar medida
          </Botao>

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold text-slate-700">Posição</p>
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="X (m)">
                <Entrada
                  type="text"
                  inputMode="decimal"
                  value={edicao.pos_x_m}
                  onChange={(e) => setEdicao((v) => ({ ...v, pos_x_m: e.target.value }))}
                />
              </Campo>
              <Campo rotulo="Y (m)">
                <Entrada
                  type="text"
                  inputMode="decimal"
                  value={edicao.pos_y_m}
                  onChange={(e) => setEdicao((v) => ({ ...v, pos_y_m: e.target.value }))}
                />
              </Campo>
            </div>

            <div className="grid grid-cols-[2.25rem_2.25rem_2.25rem] justify-center gap-1.5">
              <span />
              <button
                type="button"
                onClick={() => deslocar(detalhe, 0, -passoAjuste)}
                disabled={atualizar.isPending}
                className="flex size-9 items-center justify-center rounded-lg bg-white text-slate-600
                  ring-1 ring-slate-200 ring-inset hover:bg-slate-100 disabled:opacity-40"
                aria-label="Subir"
                title="Subir"
              >
                <ArrowUp size={15} />
              </button>
              <span />
              <button
                type="button"
                onClick={() => deslocar(detalhe, -passoAjuste, 0)}
                disabled={atualizar.isPending}
                className="flex size-9 items-center justify-center rounded-lg bg-white text-slate-600
                  ring-1 ring-slate-200 ring-inset hover:bg-slate-100 disabled:opacity-40"
                aria-label="Mover para a esquerda"
                title="Esquerda"
              >
                <ArrowLeft size={15} />
              </button>
              <Botao
                tamanho="sm"
                variante="secundario"
                onClick={() => salvarPosicao(detalhe)}
                carregando={atualizar.isPending}
                className="size-9 p-0"
                aria-label="Salvar posição"
                title="Salvar posição"
              >
                <Save size={14} />
              </Botao>
              <button
                type="button"
                onClick={() => deslocar(detalhe, passoAjuste, 0)}
                disabled={atualizar.isPending}
                className="flex size-9 items-center justify-center rounded-lg bg-white text-slate-600
                  ring-1 ring-slate-200 ring-inset hover:bg-slate-100 disabled:opacity-40"
                aria-label="Mover para a direita"
                title="Direita"
              >
                <ArrowRight size={15} />
              </button>
              <span />
              <button
                type="button"
                onClick={() => deslocar(detalhe, 0, passoAjuste)}
                disabled={atualizar.isPending}
                className="flex size-9 items-center justify-center rounded-lg bg-white text-slate-600
                  ring-1 ring-slate-200 ring-inset hover:bg-slate-100 disabled:opacity-40"
                aria-label="Descer"
                title="Descer"
              >
                <ArrowDown size={15} />
              </button>
              <span />
            </div>

            <Botao
              tamanho="sm"
              variante="secundario"
              onClick={() => salvarPosicao(detalhe)}
              carregando={atualizar.isPending}
              className="w-full"
            >
              <Save size={14} /> Salvar posição
            </Botao>
          </div>

          <div className="flex gap-2">
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => girar(detalhe)}
              disabled={atualizar.isPending}
            >
              <RotateCw size={14} /> Girar
            </Botao>
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => tirarDaPlanta(detalhe)}
              disabled={atualizar.isPending}
            >
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
          {editando && ehGestor && (
            <div className="flex items-center gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
              {PASSOS_AJUSTE.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPassoAjuste(p)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    passoAjuste === p
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {String(p).replace('.', ',')} m
                </button>
              ))}
            </div>
          )}
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
          {ehGestor && (
            <Botao
              variante={editando ? 'sucesso' : 'secundario'}
              onClick={() => {
                setEditando((v) => !v)
                setSelecionada(null)
                setRotaEditando(null)
              }}
            >
              {editando ? <Check size={15} /> : <Move size={15} />}
              {editando ? 'Pronto' : 'Posicionar máquinas'}
            </Botao>
          )}
        </div>
      </div>

      {/* esquemas: cada um é um mapa próprio (Produção, Energia, Bombeiros…)
          sobre a mesma planta. Um por vez, com a cor dele. */}
      <div className="flex flex-wrap items-center gap-2">
        {esquemas.map((es) => {
          const Icone = ICONE_ESQUEMA[es.icone] || Layers
          const ativo = esquemaAtivoId === es.id
          return (
            <button
              key={es.id}
              onClick={() => {
                setEsquemaAtivoId(ativo ? null : es.id)
                setEtapaSel(null)
                setCriandoEsquema(false)
                setQuadroArmado(null)
                setCriandoQuadro(false)
                setRotaEditando(null)
              }}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition"
              style={
                ativo
                  ? { background: es.cor, borderColor: es.cor, color: '#fff' }
                  : { background: '#fff', borderColor: '#e2e8f0', color: '#475569' }
              }
            >
              <Icone size={14} />
              {es.nome}
            </button>
          )
        })}

        {ehGestor && !criandoEsquema && (
          <button
            onClick={() => setCriandoEsquema(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300
              px-3 py-1.5 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
          >
            <Plus size={14} /> Esquema
          </button>
        )}

        {criandoEsquema && (
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-1.5 pl-3">
            <Entrada
              autoFocus
              value={novoEsquemaNome}
              onChange={(e) => setNovoEsquemaNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarEsquema()}
              placeholder="Nome (ex.: Segurança)"
              className="h-7 w-40 border-0 px-0 text-sm focus:ring-0"
            />
            <div className="flex gap-1">
              {CORES_ESQUEMA.map((c) => (
                <button
                  key={c}
                  onClick={() => setNovoEsquemaCor(c)}
                  aria-label={`Cor ${c}`}
                  className="size-4 shrink-0 rounded-full"
                  style={{
                    background: c,
                    outline: novoEsquemaCor === c ? '2px solid #0f172a' : 'none',
                    outlineOffset: 1,
                  }}
                />
              ))}
            </div>
            <button
              onClick={adicionarEsquema}
              disabled={!novoEsquemaNome.trim()}
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900
                text-white disabled:opacity-30"
              aria-label="Criar esquema"
            >
              <Check size={13} />
            </button>
            <button
              onClick={() => {
                setCriandoEsquema(false)
                setNovoEsquemaNome('')
              }}
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-600"
              aria-label="Cancelar"
            >
              <X size={13} />
            </button>
          </div>
        )}
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
                mostrarFluxo={Boolean(esquemaAtivoId) && !esquemaEnergiaAtivo}
                corEsquema={corAtiva}
                etapaSelecionada={etapaSel}
                aoSelecionarEtapa={(e) => setEtapaSel(e?.etapa_id ?? null)}
                aoMoverEtapa={moverEtapa}
                aoTerminarArrasteEtapa={gravarEtapa}
                passoEncaixe={passoAjuste}
                modoEnergia={esquemaEnergiaAtivo}
                quadros={quadrosEnergia.filter((q) => q.pos_x_m != null && q.planta_id === planta.id)}
                quadroSelecionado={quadroArmado}
                aoSelecionarQuadro={(q) => setQuadroArmado((atual) => (q && q.quadro_id !== atual ? q.quadro_id : null))}
                aoMoverQuadro={ehGestor && editando ? moverQuadro : undefined}
                aoTerminarArrasteQuadro={ehGestor && editando ? gravarQuadro : undefined}
                aoLigarMaquina={ehGestor && editando ? aoClicarMaquinaEnergia : undefined}
                aoClicarCabo={ehGestor && editando ? abrirEdicaoCabo : undefined}
                rotaEditando={rotaEditando}
                aoCliqueVazioRota={adicionarPontoRota}
                aoRemoverPontoRota={removerPontoRota}
              />
            )}
          </Cartao>

          {rotaEditando && (
            <div className="nao-imprimir absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap
              items-center gap-2 rounded-lg bg-slate-900/95 px-3 py-2 text-xs text-white shadow-lg">
              <Cable size={14} className="shrink-0 text-amber-400" />
              <span>
                Clique na planta pra marcar uma curva ({rotaEditando.pontos.length} até agora). Clique num ponto pra tirá-lo.
              </span>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={desfazerUltimoPontoRota}
                  disabled={!rotaEditando.pontos.length}
                  className="rounded bg-white/10 px-2 py-1 font-medium hover:bg-white/20 disabled:opacity-30"
                >
                  Desfazer
                </button>
                <button
                  onClick={limparRota}
                  disabled={!rotaEditando.pontos.length}
                  className="rounded bg-white/10 px-2 py-1 font-medium hover:bg-white/20 disabled:opacity-30"
                >
                  Limpar
                </button>
                <button
                  onClick={cancelarRota}
                  className="rounded bg-white/10 px-2 py-1 font-medium hover:bg-white/20"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarRota}
                  className="rounded bg-amber-500 px-2 py-1 font-semibold text-slate-900 hover:bg-amber-400"
                >
                  Salvar caminho
                </button>
              </div>
            </div>
          )}

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
          {esquemaEnergiaAtivo && (
            <Cartao className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: corAtiva }}>
                  <Zap size={15} className="mr-1 inline" style={{ color: corAtiva }} />
                  {esquemaAtivo.nome}
                </p>
                <span className="text-xs text-slate-500">{quadrosEnergia.length} quadro{quadrosEnergia.length === 1 ? '' : 's'}</span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {ehGestor && editando
                  ? quadroArmado
                    ? 'Clique numa máquina para puxar (ou tirar) o cabo. Clique num cabo já puxado para descrever a especificação.'
                    : 'Clique num quadro para selecioná-lo, depois clique nas máquinas que ele alimenta.'
                  : 'Cada linha é um cabo do quadro até a máquina. Anima enquanto a máquina está operando.'}
              </p>

              {ehGestor && editando && (
                <div className="mt-3 flex gap-2">
                  {criandoQuadro ? (
                    <>
                      <Entrada
                        autoFocus
                        value={novoQuadroNome}
                        onChange={(e) => setNovoQuadroNome(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && criarQuadro()}
                        placeholder="Nome (ex.: QGBT-2)"
                      />
                      <Botao onClick={criarQuadro} disabled={!novoQuadroNome.trim()}>
                        <Check size={15} />
                      </Botao>
                      <Botao variante="secundario" onClick={() => setCriandoQuadro(false)}>
                        <X size={15} />
                      </Botao>
                    </>
                  ) : (
                    <Botao variante="secundario" className="w-full" onClick={() => setCriandoQuadro(true)}>
                      <PlugZap size={15} /> Novo quadro
                    </Botao>
                  )}
                </div>
              )}

              <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                {quadrosEnergia.length === 0 && (
                  <p className="py-4 text-center text-sm text-slate-400">
                    Nenhum quadro cadastrado ainda.
                  </p>
                )}
                {quadrosEnergia.map((q) => {
                  const noChaoDaPlanta = q.pos_x_m != null && q.planta_id === planta.id
                  const armado = quadroArmado === q.quadro_id
                  return (
                    <div key={q.quadro_id} className={`rounded-lg px-2 py-1.5 ${armado ? 'bg-amber-50 ring-1 ring-amber-300' : ''}`}>
                      <div className="flex w-full items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!noChaoDaPlanta) return
                            setQuadroArmado(armado ? null : q.quadro_id)
                          }}
                          disabled={!noChaoDaPlanta}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
                        >
                          <PlugZap size={14} className="shrink-0" style={{ color: corAtiva }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800">
                              {q.nome} {q.tag ? `(${q.tag})` : ''}
                            </span>
                            <span className="block text-xs text-slate-400">
                              {q.qtd_maquinas} máquina{q.qtd_maquinas === 1 ? '' : 's'} ligada{q.qtd_maquinas === 1 ? '' : 's'}
                            </span>
                          </span>
                        </button>
                        {!noChaoDaPlanta && ehGestor && editando && (
                          <Botao
                            tamanho="sm"
                            variante="secundario"
                            onClick={() => colocarQuadroNaPlanta(q)}
                          >
                            <Plus size={13} /> Planta
                          </Botao>
                        )}
                      </div>

                      {armado && (
                        <div className="mt-1.5 space-y-1 border-t border-amber-200 pt-1.5">
                          {noChao.filter((m) => m.quadro_id === q.quadro_id).map((m) => (
                            <div key={m.ativo_id} className="flex items-center gap-2 rounded bg-white px-2 py-1 text-xs">
                              <Cable size={12} className="shrink-0 text-slate-400" />
                              <span className="min-w-0 flex-1 truncate text-slate-700">{m.nome}</span>
                              {ehGestor && editando && (
                                <>
                                  <button
                                    onClick={() => iniciarRota(m.ativo_id, q.quadro_id)}
                                    className="shrink-0 text-amber-600 hover:text-amber-700"
                                  >
                                    rota{Array.isArray(m.cabo_pontos) && m.cabo_pontos.length > 0 ? ` (${m.cabo_pontos.length})` : ''}
                                  </button>
                                  <button
                                    onClick={() => abrirEdicaoCabo(m.ativo_id)}
                                    className="shrink-0 text-sky-600 hover:text-sky-700"
                                  >
                                    especificar
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                          {noChao.filter((m) => m.quadro_id === q.quadro_id).length === 0 && (
                            <p className="px-2 py-1 text-xs text-slate-400">Nenhuma máquina ligada ainda.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Cartao>
          )}

          {esquemaAtivo && !esquemaEnergiaAtivo && (
            <Cartao className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: corAtiva }}>
                  {esquemaAtivo.nome}
                </p>
                <span className="text-xs text-slate-500">{etapas.length} itens</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-5" style={{ background: corAtiva }} /> sempre passa
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-0.5 w-5 opacity-70"
                    style={{ backgroundImage: `repeating-linear-gradient(90deg,${corAtiva} 0 3px,transparent 3px 6px)` }}
                  />
                  só às vezes
                </span>
              </div>

              {ehGestor && editando && (
                <div className="mt-3 flex gap-2">
                  <Entrada
                    value={novaEtapa}
                    onChange={(e) => setNovaEtapa(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && adicionarEtapa()}
                    placeholder={`Novo item (ex.: ${EXEMPLO_ITEM[esquemaAtivo.nome] || 'Item'})`}
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
                    De <strong>{etapaAberta.nome}</strong>, vai para:
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
                            <span style={{ color: corAtiva }}> · só às vezes</span>
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
                    <Trash2 size={13} /> Apagar {etapaAberta.nome}
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
                Cada quadrante tem {CELULA_COMPRIMENTO} × {CELULA_LARGURA} m, ou 30 m²,
                seguindo as juntas de dilatação como referência. O número no comprimento
                cruzado com a letra na largura forma o endereço; o canto de entrada é o{' '}
                <span className="font-mono font-semibold">1A</span>.
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

      <Modal
        aberto={Boolean(caboEditando)}
        aoFechar={() => setCaboEditando(null)}
        titulo="Especificação do cabo"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setCaboEditando(null)}>Cancelar</Botao>
            <Botao onClick={salvarCabo} carregando={salvarCaboDb.isPending}>
              <Save size={14} /> Salvar
            </Botao>
          </>
        }
      >
        <div className="space-y-3">
          <Campo rotulo="Descrição do cabo">
            <Entrada
              value={campoCabo.cabo_descricao}
              onChange={(e) => setCampoCabo((v) => ({ ...v, cabo_descricao: e.target.value }))}
              placeholder="Ex.: PP 3x2,5mm² + terra"
            />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Bitola (mm²)">
              <Entrada
                type="text"
                inputMode="decimal"
                value={campoCabo.cabo_bitola_mm2}
                onChange={(e) => setCampoCabo((v) => ({ ...v, cabo_bitola_mm2: e.target.value }))}
              />
            </Campo>
            <Campo rotulo="Comprimento (m)">
              <Entrada
                type="text"
                inputMode="decimal"
                value={campoCabo.cabo_comprimento_m}
                onChange={(e) => setCampoCabo((v) => ({ ...v, cabo_comprimento_m: e.target.value }))}
              />
            </Campo>
          </div>
          <Campo rotulo="Tipo de instalação">
            <Selecao
              value={campoCabo.cabo_tipo_instalacao}
              onChange={(e) => setCampoCabo((v) => ({ ...v, cabo_tipo_instalacao: e.target.value }))}
            >
              {TIPOS_INSTALACAO_CABO.map((t) => (
                <option key={t.valor} value={t.valor}>{t.label}</option>
              ))}
            </Selecao>
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Disjuntor">
              <Entrada
                value={campoCabo.disjuntor}
                onChange={(e) => setCampoCabo((v) => ({ ...v, disjuntor: e.target.value }))}
                placeholder="Ex.: 32A tripolar"
              />
            </Campo>
            <Campo rotulo="Circuito">
              <Entrada
                value={campoCabo.circuito}
                onChange={(e) => setCampoCabo((v) => ({ ...v, circuito: e.target.value }))}
                placeholder="Ex.: C-14"
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Tensão (V)">
              <Entrada
                type="text"
                inputMode="decimal"
                value={campoCabo.ficha_tensao_v}
                onChange={(e) => setCampoCabo((v) => ({ ...v, ficha_tensao_v: e.target.value }))}
              />
            </Campo>
            <Campo rotulo="Corrente nominal (A)">
              <Entrada
                type="text"
                inputMode="decimal"
                value={campoCabo.corrente_nominal_a}
                onChange={(e) => setCampoCabo((v) => ({ ...v, corrente_nominal_a: e.target.value }))}
              />
            </Campo>
          </div>
        </div>
      </Modal>
    </div>
  )
}
