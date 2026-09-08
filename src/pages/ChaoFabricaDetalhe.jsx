import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, CircleCheck, RotateCcw, Ban, Trash2, Recycle,
  ClipboardCheck, Scale, Image as ImageIcon, Printer,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  useRegistro, useTabela, useInvalidar, useSetores, useMateriaisResiduo,
} from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import { dataHora, data as fmtDataBr, numero } from '../lib/format'
import {
  M_STATUS_CHAO, M_NOTA_LIMPEZA, NOTAS_LIMPEZA, TIPOS_MOVIMENTACAO_RESIDUO,
  ETAPAS_REAPROVEITAMENTO, ORIGENS_RESIDUO, CONDICOES_RESIDUO, DESTINACOES_RESIDUO,
  UNIDADES_MEDIDA_RESIDUO, MOTIVOS_RESIDUO_SUGERIDOS,
} from '../lib/constants'
import {
  Botao, Cartao, CartaoTitulo, Campo, Entrada, Area, Selecao, Etiqueta, Carregando,
  Vazio, Modal, Erro, useAviso,
} from '../components/ui'
import GaleriaFotos from '../components/GaleriaFotos'
import ImpressaoRelatorio from '../components/ImpressaoRelatorio'

const INVALIDAR = [
  'relatorios_chao', 'relatorio_chao_setores', 'relatorio_chao_historico',
  'vw_residuo_lancamentos', 'vw_residuo_saldo', 'vw_residuo_saldo_material',
  'vw_relatorio_chao_resumo', 'residuo_bigbags',
]

const MEDIDA_VAZIA = { unidade_medida: 'kg', quantidade: '' }

export default function ChaoFabricaDetalhe() {
  const { id } = useParams()
  const navegar = useNavigate()
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const { ehGestor, perfil } = useAuth()

  const [modal, setModal] = useState(null) // 'desperdicio' | 'reaproveitamento' | 'bigbag' | 'limpeza' | 'concluir' | 'reabrir' | 'cancelar'
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [setorEditando, setSetorEditando] = useState(null)
  const [imprimindo, setImprimindo] = useState(false)

  const relatorio = useRegistro(
    'relatorios_chao', id,
    '*, unidade:unidades(nome), responsavel:responsavel_id(nome)'
  )
  const setoresRel = useTabela('relatorio_chao_setores', {
    select: '*, setor:setores(nome)',
    filtros: [['relatorio_id', 'eq', id]],
  })
  const lancamentos = useTabela('vw_residuo_lancamentos', {
    filtros: [['relatorio_id', 'eq', id]],
    ordem: { coluna: 'criado_em', asc: false },
  })
  const historico = useTabela('relatorio_chao_historico', {
    select: '*, autor:autor_id(nome)',
    filtros: [['relatorio_id', 'eq', id]],
    ordem: { coluna: 'criado_em' },
  })
  // useTabela ignora filtro com valor null (é assim de propósito, pra combo
  // opcional) — então "sem lançamento nem setor" filtra no cliente mesmo.
  const midiasRelatorio = useTabela('relatorio_chao_midias', {
    filtros: [['relatorio_id', 'eq', id]],
    ordem: { coluna: 'criado_em' },
  })
  const fotosGeraisData = (midiasRelatorio.data || []).filter(
    (m) => m.lancamento_id == null && m.setor_avaliacao_id == null
  )

  const materiais = useMateriaisResiduo()
  const r = relatorio.data
  const setores = useSetores(r?.unidade_id)
  const ativos = useTabela('ativos', {
    select: 'id, codigo, nome',
    filtros: [['ativo', 'eq', true], ...(r?.unidade_id ? [['unidade_id', 'eq', r.unidade_id]] : [])],
    ordem: { coluna: 'nome' },
  })

  // Espelha pode_editar_relatorio_chao no banco: mesmo gestor precisa
  // reabrir primeiro um relatório concluído — a reabertura é o portão de
  // auditoria, não um bypass.
  const podeEditar = ['aberta', 'em_andamento', 'reaberta'].includes(r?.status)

  const desperdicios = (lancamentos.data || []).filter((l) => l.tipo_movimentacao === 'geracao')
  const reaproveitamentos = (lancamentos.data || []).filter((l) => l.tipo_movimentacao !== 'geracao')

  const [formResiduo, setFormResiduo] = useState(campoResiduoVazio())
  const [formLimpeza, setFormLimpeza] = useState(campoLimpezaVazio())
  const [formConclusao, setFormConclusao] = useState({
    conclusao_situacao: '', conclusao_atencao: '', conclusao_providencias: '',
    sem_desperdicio: false, sem_reaproveitamento: false,
  })
  const [motivo, setMotivo] = useState('')
  const [fotosNovas, setFotosNovas] = useState([])

  useEffect(() => {
    if (modal === 'concluir') {
      setFormConclusao({
        conclusao_situacao: '', conclusao_atencao: '', conclusao_providencias: '',
        sem_desperdicio: desperdicios.length === 0,
        sem_reaproveitamento: reaproveitamentos.length === 0,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal])

  if (relatorio.isLoading) return <Carregando />
  if (relatorio.error || !r) return <Erro erro={relatorio.error || new Error('Relatório não encontrado.')} />

  function campoResiduoVazio() {
    return {
      material_id: '', tipo_movimentacao: 'geracao', origem: '', condicao: '', destinacao: '',
      motivo: '', setor_id: '', quadrante: '', localizacao_complementar: '',
      provavel_setor_origem_id: '', ativo_id: '', observacao: '',
      medicoes: [{ ...MEDIDA_VAZIA }],
    }
  }
  function campoLimpezaVazio() {
    return {
      nota: null, nao_inspecionado: false, justificativa: '', quadrantes: '',
      principais_problemas: '', observacao: '', acao_recomendada: '',
    }
  }

  const abrirNovoResiduo = (tipoBase) => {
    setFormResiduo({ ...campoResiduoVazio(), tipo_movimentacao: tipoBase === 'desperdicio' ? 'geracao' : 'identificado_reaproveitavel' })
    setFotosNovas([])
    setErro(null)
    setModal(tipoBase)
  }

  const mudarMedida = (i, campo, valor) =>
    setFormResiduo((f) => ({
      ...f,
      medicoes: f.medicoes.map((m, idx) => (idx === i ? { ...m, [campo]: valor } : m)),
    }))
  const addMedida = () =>
    setFormResiduo((f) => ({ ...f, medicoes: [...f.medicoes, { ...MEDIDA_VAZIA }] }))
  const removeMedida = (i) =>
    setFormResiduo((f) => ({ ...f, medicoes: f.medicoes.filter((_, idx) => idx !== i) }))

  const salvarResiduo = async () => {
    setErro(null)
    const medicoesValidas = formResiduo.medicoes
      .filter((m) => Number(m.quantidade) > 0)
      .map((m) => ({ unidade_medida: m.unidade_medida, quantidade: Number(m.quantidade) }))
    if (!formResiduo.material_id) {
      setErro(new Error('Escolha o material.'))
      return
    }
    if (medicoesValidas.length === 0) {
      setErro(new Error('Informe pelo menos uma medição maior que zero.'))
      return
    }
    setEnviando(true)
    const { data: linhas, error } = await supabase.rpc('registrar_residuo', {
      p_relatorio_id: id,
      p_material_id: formResiduo.material_id,
      p_tipo_movimentacao: formResiduo.tipo_movimentacao,
      p_medicoes: medicoesValidas,
      p_origem: formResiduo.origem || null,
      p_condicao: formResiduo.condicao || null,
      p_destinacao: formResiduo.destinacao || null,
      p_motivo: formResiduo.motivo.trim() || null,
      p_setor_id: formResiduo.setor_id || null,
      p_quadrante: formResiduo.quadrante.trim() || null,
      p_localizacao_complementar: formResiduo.localizacao_complementar.trim() || null,
      p_provavel_setor_origem_id: formResiduo.provavel_setor_origem_id || null,
      p_ativo_id: formResiduo.ativo_id || null,
      p_observacao: formResiduo.observacao.trim() || null,
    })
    setEnviando(false)
    if (error) { setErro(new Error(error.message)); return }
    const linha = linhas?.[0]
    if (linha?.mensagem) { setErro(new Error(linha.mensagem)); return }

    if (fotosNovas.length) {
      await supabase.from('relatorio_chao_midias').insert(
        fotosNovas.map((f) => ({
          relatorio_id: id, lancamento_id: linha.id, url: f.url, enviado_por: perfil?.id ?? null,
        }))
      )
    }

    setModal(null)
    avisar('Registrado.')
    invalidar(...INVALIDAR, 'relatorio_chao_midias')
  }

  const abrirLimpeza = (s) => {
    setFormLimpeza({
      nota: s.nota, nao_inspecionado: s.nao_inspecionado,
      justificativa: s.justificativa_nao_inspecionado || '',
      quadrantes: (s.quadrantes_inspecionados || []).join(', '),
      principais_problemas: s.principais_problemas || '', observacao: s.observacao || '',
      acao_recomendada: s.acao_recomendada || '',
    })
    setSetorEditando(s)
    setErro(null)
    setModal('limpeza')
  }

  const salvarLimpeza = async () => {
    setErro(null)
    setEnviando(true)
    const { data: linhas, error } = await supabase.rpc('avaliar_limpeza_setor', {
      p_relatorio_setor_id: setorEditando.id,
      p_nota: formLimpeza.nao_inspecionado ? null : formLimpeza.nota,
      p_nao_inspecionado: formLimpeza.nao_inspecionado,
      p_justificativa: formLimpeza.justificativa.trim() || null,
      p_quadrantes: formLimpeza.quadrantes.split(',').map((q) => q.trim()).filter(Boolean),
      p_principais_problemas: formLimpeza.principais_problemas.trim() || null,
      p_observacao: formLimpeza.observacao.trim() || null,
      p_acao_recomendada: formLimpeza.acao_recomendada.trim() || null,
    })
    setEnviando(false)
    if (error) { setErro(new Error(error.message)); return }
    const linha = linhas?.[0]
    if (linha?.mensagem) { setErro(new Error(linha.mensagem)); return }
    setModal(null)
    avisar('Avaliação salva.')
    invalidar(...INVALIDAR)
  }

  const concluir = async () => {
    setErro(null)
    setEnviando(true)
    const { data: linhas, error } = await supabase.rpc('concluir_relatorio_chao', {
      p_relatorio_id: id,
      p_conclusao_situacao: formConclusao.conclusao_situacao.trim(),
      p_conclusao_atencao: formConclusao.conclusao_atencao.trim(),
      p_conclusao_providencias: formConclusao.conclusao_providencias.trim(),
      p_sem_desperdicio: formConclusao.sem_desperdicio,
      p_sem_reaproveitamento: formConclusao.sem_reaproveitamento,
    })
    setEnviando(false)
    if (error) { setErro(new Error(error.message)); return }
    const linha = linhas?.[0]
    if (linha?.mensagem) { setErro(new Error(linha.mensagem)); return }
    setModal(null)
    avisar('Relatório concluído.')
    invalidar(...INVALIDAR)
  }

  const reabrirOuCancelar = async (rpc) => {
    setErro(null)
    if (!motivo.trim()) { setErro(new Error('Informe o motivo.')); return }
    setEnviando(true)
    const { data: linhas, error } = await supabase.rpc(rpc, { p_relatorio_id: id, p_motivo: motivo.trim() })
    setEnviando(false)
    if (error) { setErro(new Error(error.message)); return }
    const linha = linhas?.[0]
    if (linha?.mensagem) { setErro(new Error(linha.mensagem)); return }
    setModal(null)
    setMotivo('')
    avisar(rpc === 'reabrir_relatorio_chao' ? 'Relatório reaberto.' : 'Relatório cancelado.')
    invalidar(...INVALIDAR)
  }

  const enviarFotoGeral = async (novas) => {
    const adicionada = novas[novas.length - 1]
    await supabase.from('relatorio_chao_midias').insert({
      relatorio_id: id, url: adicionada.url, enviado_por: perfil?.id ?? null,
    })
    invalidar('relatorio_chao_midias')
  }

  // Diferente do PDF de Relatorios.jsx, aqui os dados já estão todos
  // carregados na tela — não precisa buscar de novo, só remontar no
  // formato que ImpressaoRelatorio entende.
  const dadosImpressao = imprimindo && r ? {
    titulo: `Relatório do Chão de Fábrica · ${r.numero}`,
    subtitulo: `${r.unidade?.nome || ''}${r.turno ? ` · ${r.turno}` : ''} · ${fmtDataBr(r.data)} · responsável: ${r.responsavel?.nome || '—'}`,
    tabelas: [
      {
        titulo: 'Limpeza por setor',
        colunas: ['Setor', 'Nota', 'Situação', 'Principais problemas', 'Ação recomendada'],
        linhas: (setoresRel.data || []).map((s) => [
          s.setor?.nome || '—',
          s.nao_inspecionado ? '—' : (s.nota ?? '—'),
          s.nao_inspecionado ? `Não inspecionado: ${s.justificativa_nao_inspecionado || '—'}` : (M_NOTA_LIMPEZA[s.nota]?.label || '—'),
          s.principais_problemas || '—',
          s.acao_recomendada || '—',
        ]),
      },
      {
        titulo: 'Desperdícios registrados',
        colunas: ['Material', 'Medição', 'Origem', 'Setor', 'Quadrante', 'Observação'],
        linhas: desperdicios.map((l) => [
          l.material_nome,
          (l.medicoes || []).map((m) => `${numero(m.quantidade, 2)} ${UNIDADES_MEDIDA_RESIDUO.find((u) => u.valor === m.unidade_medida)?.label || m.unidade_medida}`).join(' · ') || '—',
          ORIGENS_RESIDUO.find((o) => o.valor === l.origem)?.label || '—',
          l.setor_nome || '—',
          l.quadrante || '—',
          l.observacao || '—',
        ]),
      },
      {
        titulo: 'Reaproveitamento registrado',
        colunas: ['Material', 'Movimentação', 'Medição', 'Setor', 'Observação'],
        linhas: reaproveitamentos.map((l) => [
          l.material_nome,
          TIPOS_MOVIMENTACAO_RESIDUO.find((t) => t.valor === l.tipo_movimentacao)?.label || l.tipo_movimentacao,
          (l.medicoes || []).map((m) => `${numero(m.quantidade, 2)} ${UNIDADES_MEDIDA_RESIDUO.find((u) => u.valor === m.unidade_medida)?.label || m.unidade_medida}`).join(' · ') || '—',
          l.setor_nome || '—',
          l.observacao || '—',
        ]),
      },
      ...(r.conclusao_situacao ? [{
        titulo: 'Conclusão do relatório',
        colunas: ['Situação geral', 'Pontos de atenção', 'Providências'],
        linhas: [[r.conclusao_situacao, r.conclusao_atencao || '—', r.conclusao_providencias || '—']],
      }] : []),
    ],
  } : null

  useEffect(() => {
    if (!imprimindo) return
    const aoTerminar = () => setImprimindo(false)
    window.addEventListener('afterprint', aoTerminar, { once: true })
    const idTimeout = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(idTimeout)
      window.removeEventListener('afterprint', aoTerminar)
    }
  }, [imprimindo])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/desperdicios">
            <Botao variante="fantasma" tamanho="sm"><ArrowLeft size={16} /></Botao>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-500">{r.numero}</span>
              <Etiqueta cor={M_STATUS_CHAO[r.status]?.cor}>{M_STATUS_CHAO[r.status]?.label}</Etiqueta>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              {r.unidade?.nome}{r.turno ? ` · ${r.turno}` : ''}
            </h1>
            <p className="text-sm text-slate-500">
              {r.responsavel?.nome || 'Sem responsável'} · aberto {dataHora(r.aberta_em)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => setImprimindo(true)} carregando={imprimindo}>
            <Printer size={15} /> Baixar PDF
          </Botao>
          {podeEditar && !['concluida', 'cancelada'].includes(r.status) && (
            <Botao variante="sucesso" onClick={() => setModal('concluir')}>
              <CircleCheck size={15} /> Concluir
            </Botao>
          )}
          {ehGestor && r.status === 'concluida' && (
            <Botao variante="secundario" onClick={() => { setMotivo(''); setErro(null); setModal('reabrir') }}>
              <RotateCcw size={15} /> Reabrir
            </Botao>
          )}
          {ehGestor && !['cancelada', 'concluida'].includes(r.status) && (
            <Botao variante="secundario" onClick={() => { setMotivo(''); setErro(null); setModal('cancelar') }}>
              <Ban size={15} /> Cancelar
            </Botao>
          )}
        </div>
      </div>

      {r.status === 'cancelada' && r.motivo_cancelamento && (
        <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600">
          Cancelado: {r.motivo_cancelamento}
        </div>
      )}
      {r.motivo_reabertura && (
        <div className="rounded-lg bg-orange-50 px-4 py-2.5 text-sm text-orange-700 ring-1 ring-orange-200 ring-inset">
          Reaberto: {r.motivo_reabertura}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* ---------------------------------------------------- limpeza */}
          <Cartao>
            <CartaoTitulo>
              <span className="inline-flex items-center gap-1.5">
                <ClipboardCheck size={14} className="text-slate-400" /> Limpeza e organização por setor
              </span>
            </CartaoTitulo>
            {(setoresRel.data || []).length === 0 ? (
              <Vazio titulo="Nenhum setor definido na abertura" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {setoresRel.data.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{s.setor?.nome}</p>
                      {s.nao_inspecionado ? (
                        <p className="text-xs text-amber-600">Não inspecionado — {s.justificativa_nao_inspecionado}</p>
                      ) : s.nota ? (
                        <p className="text-xs text-slate-500">
                          {s.principais_problemas || 'Sem problemas anotados'}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">Ainda não avaliado</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {s.nota && (
                        <Etiqueta cor={M_NOTA_LIMPEZA[s.nota]?.cor}>
                          {s.nota} · {M_NOTA_LIMPEZA[s.nota]?.label}
                        </Etiqueta>
                      )}
                      {podeEditar && (
                        <Botao tamanho="sm" variante="secundario" onClick={() => abrirLimpeza(s)}>
                          {s.nota || s.nao_inspecionado ? 'Editar' : 'Avaliar'}
                        </Botao>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {/* ------------------------------------------------ desperdícios */}
          <Cartao>
            <CartaoTitulo
              acao={podeEditar && (
                <Botao tamanho="sm" variante="secundario" onClick={() => abrirNovoResiduo('desperdicio')}>
                  <Plus size={14} /> Desperdício
                </Botao>
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Trash2 size={14} className="text-slate-400" /> Desperdícios e resíduos encontrados
              </span>
            </CartaoTitulo>
            {desperdicios.length === 0 ? (
              <Vazio
                titulo={r.sem_desperdicio_confirmado ? 'Nenhum desperdício identificado na inspeção' : 'Nada registrado ainda'}
                descricao={!r.sem_desperdicio_confirmado ? 'Registre o que for achando, ou confirme "nenhum" na conclusão.' : undefined}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {desperdicios.map((l) => (
                  <LinhaLancamento key={l.id} l={l} />
                ))}
              </ul>
            )}
          </Cartao>

          {/* --------------------------------------------- reaproveitamento */}
          <Cartao>
            <CartaoTitulo
              acao={podeEditar && (
                <Botao tamanho="sm" variante="secundario" onClick={() => abrirNovoResiduo('reaproveitamento')}>
                  <Plus size={14} /> Reaproveitamento
                </Botao>
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Recycle size={14} className="text-slate-400" /> Reaproveitamento
              </span>
            </CartaoTitulo>
            {reaproveitamentos.length === 0 ? (
              <Vazio
                titulo={r.sem_reaproveitamento_confirmado ? 'Não houve movimentação de reaproveitamento hoje' : 'Nada registrado ainda'}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {reaproveitamentos.map((l) => (
                  <LinhaLancamento key={l.id} l={l} />
                ))}
              </ul>
            )}
          </Cartao>

          {/* --------------------------------------------------- big bag */}
          {podeEditar && (
            <Cartao className="p-4">
              <Botao variante="secundario" onClick={() => setModal('bigbag')}>
                <Scale size={15} /> Pesar big bag
              </Botao>
            </Cartao>
          )}

          {/* ----------------------------------------------------- fotos */}
          <Cartao className="p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <ImageIcon size={14} className="text-slate-400" /> Fotos gerais do relatório
            </p>
            <GaleriaFotos
              valor={fotosGeraisData.map((f) => ({ url: f.url }))}
              aoMudar={enviarFotoGeral}
              desabilitado={!podeEditar}
            />
          </Cartao>
        </div>

        <div className="space-y-4">
          {r.observacao_inicial && (
            <Cartao>
              <CartaoTitulo>Observação inicial</CartaoTitulo>
              <p className="px-4 py-3 text-sm text-slate-700">{r.observacao_inicial}</p>
            </Cartao>
          )}

          {r.status === 'concluida' && (
            <Cartao>
              <CartaoTitulo>Conclusão</CartaoTitulo>
              <dl className="space-y-2 px-4 py-3 text-sm">
                <div><dt className="text-xs font-medium text-slate-500">Situação geral</dt><dd className="text-slate-700">{r.conclusao_situacao}</dd></div>
                <div><dt className="text-xs font-medium text-slate-500">Pontos de atenção</dt><dd className="text-slate-700">{r.conclusao_atencao}</dd></div>
                <div><dt className="text-xs font-medium text-slate-500">Providências</dt><dd className="text-slate-700">{r.conclusao_providencias}</dd></div>
              </dl>
            </Cartao>
          )}

          <Cartao>
            <CartaoTitulo>O que aconteceu</CartaoTitulo>
            <ul className="space-y-3 px-4 py-3">
              {(historico.data || []).map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <div className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />
                  <div>
                    <p className="text-slate-700">
                      {h.status_de ? `${M_STATUS_CHAO[h.status_de]?.label} → ${M_STATUS_CHAO[h.status_para]?.label}` : 'Relatório aberto'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {dataHora(h.criado_em)}{h.autor?.nome ? ` · ${h.autor.nome}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Cartao>
        </div>
      </div>

      {/* ---------------------------------------------------------- modais */}
      <Modal
        aberto={modal === 'desperdicio' || modal === 'reaproveitamento'}
        aoFechar={() => setModal(null)}
        titulo={modal === 'desperdicio' ? 'Registrar desperdício' : 'Registrar reaproveitamento'}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>Cancelar</Botao>
            <Botao onClick={salvarResiduo} carregando={enviando}>Registrar</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Material *">
            <Selecao value={formResiduo.material_id} onChange={(e) => setFormResiduo((f) => ({ ...f, material_id: e.target.value }))}>
              <option value="">—</option>
              {(materiais.data || []).map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </Selecao>
          </Campo>

          {modal === 'reaproveitamento' && (
            <Campo rotulo="Etapa">
              <Selecao value={formResiduo.tipo_movimentacao} onChange={(e) => setFormResiduo((f) => ({ ...f, tipo_movimentacao: e.target.value }))}>
                {ETAPAS_REAPROVEITAMENTO.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.label}</option>
                ))}
              </Selecao>
            </Campo>
          )}

          <Campo rotulo="Medições *" dica="Pode informar mais de uma (ex.: EPS em kg, unidades e m³ ao mesmo tempo)">
            <div className="space-y-2">
              {formResiduo.medicoes.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <Selecao value={m.unidade_medida} onChange={(e) => mudarMedida(i, 'unidade_medida', e.target.value)} className="w-32">
                    {UNIDADES_MEDIDA_RESIDUO.map((u) => (
                      <option key={u.valor} value={u.valor}>{u.label}</option>
                    ))}
                  </Selecao>
                  <Entrada
                    type="number" step="0.001" min="0" placeholder="Quantidade"
                    value={m.quantidade} onChange={(e) => mudarMedida(i, 'quantidade', e.target.value)}
                  />
                  {formResiduo.medicoes.length > 1 && (
                    <button type="button" onClick={() => removeMedida(i)} className="text-slate-300 hover:text-red-600" aria-label="Remover medição">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addMedida} className="text-xs font-medium text-sky-600 hover:text-sky-700">
                + outra medição
              </button>
            </div>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            {modal === 'desperdicio' && (
              <Campo rotulo="Origem provável">
                <Selecao value={formResiduo.origem} onChange={(e) => setFormResiduo((f) => ({ ...f, origem: e.target.value }))}>
                  <option value="">—</option>
                  {ORIGENS_RESIDUO.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
                </Selecao>
              </Campo>
            )}
            <Campo rotulo="Condição do material">
              <Selecao value={formResiduo.condicao} onChange={(e) => setFormResiduo((f) => ({ ...f, condicao: e.target.value }))}>
                <option value="">—</option>
                {CONDICOES_RESIDUO.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
              </Selecao>
            </Campo>
          </div>

          <Campo rotulo="Destinação dada ou recomendada">
            <Selecao value={formResiduo.destinacao} onChange={(e) => setFormResiduo((f) => ({ ...f, destinacao: e.target.value }))}>
              <option value="">—</option>
              {DESTINACOES_RESIDUO.map((d) => <option key={d.valor} value={d.valor}>{d.label}</option>)}
            </Selecao>
          </Campo>

          {modal === 'desperdicio' && (
            <Campo rotulo="Motivo provável">
              <Entrada
                list="motivos-residuo" value={formResiduo.motivo}
                onChange={(e) => setFormResiduo((f) => ({ ...f, motivo: e.target.value }))}
                placeholder="Escolha ou digite"
              />
              <datalist id="motivos-residuo">
                {MOTIVOS_RESIDUO_SUGERIDOS.map((m) => <option key={m} value={m} />)}
              </datalist>
            </Campo>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Setor onde foi encontrado">
              <Selecao value={formResiduo.setor_id} onChange={(e) => setFormResiduo((f) => ({ ...f, setor_id: e.target.value }))}>
                <option value="">—</option>
                {(setores.data || []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </Selecao>
            </Campo>
            {modal === 'desperdicio' && (
              <Campo rotulo="Provável setor de origem" dica="Diferente de onde foi achado, se for o caso">
                <Selecao value={formResiduo.provavel_setor_origem_id} onChange={(e) => setFormResiduo((f) => ({ ...f, provavel_setor_origem_id: e.target.value }))}>
                  <option value="">—</option>
                  {(setores.data || []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </Selecao>
              </Campo>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Quadrante" dica='Ex.: "7C" — o mesmo endereço da planta'>
              <Entrada value={formResiduo.quadrante} onChange={(e) => setFormResiduo((f) => ({ ...f, quadrante: e.target.value }))} placeholder="7C" />
            </Campo>
            <Campo rotulo="Localização complementar" dica="Opcional">
              <Entrada value={formResiduo.localizacao_complementar} onChange={(e) => setFormResiduo((f) => ({ ...f, localizacao_complementar: e.target.value }))} />
            </Campo>
          </div>

          <Campo rotulo="Máquina ou ativo relacionado" dica="Opcional">
            <Selecao value={formResiduo.ativo_id} onChange={(e) => setFormResiduo((f) => ({ ...f, ativo_id: e.target.value }))}>
              <option value="">—</option>
              {(ativos.data || []).map((a) => (
                <option key={a.id} value={a.id}>{a.codigo ? `${a.codigo} · ` : ''}{a.nome}</option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Observação">
            <Area rows={2} value={formResiduo.observacao} onChange={(e) => setFormResiduo((f) => ({ ...f, observacao: e.target.value }))} />
          </Campo>

          <Campo rotulo="Fotos">
            <GaleriaFotos valor={fotosNovas} aoMudar={setFotosNovas} />
          </Campo>

          <Erro erro={erro} />
        </div>
      </Modal>

      <Modal
        aberto={modal === 'limpeza'}
        aoFechar={() => setModal(null)}
        titulo={`Avaliar limpeza — ${setorEditando?.setor?.nome || ''}`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>Cancelar</Botao>
            <Botao onClick={salvarLimpeza} carregando={enviando}>Salvar</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-1.5">
            {NOTAS_LIMPEZA.map((n) => (
              <button
                key={n.valor}
                type="button"
                onClick={() => setFormLimpeza((f) => ({ ...f, nota: n.valor, nao_inspecionado: false }))}
                className={`rounded-lg border-2 p-2 text-center transition ${
                  formLimpeza.nota === n.valor && !formLimpeza.nao_inspecionado
                    ? 'border-sky-500 bg-sky-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-lg font-bold text-slate-800">{n.valor}</p>
                <p className="text-[11px] font-medium text-slate-600">{n.label}</p>
              </button>
            ))}
          </div>
          {formLimpeza.nota && !formLimpeza.nao_inspecionado && (
            <p className="text-xs text-slate-500">{NOTAS_LIMPEZA.find((n) => n.valor === formLimpeza.nota)?.criterio}</p>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={formLimpeza.nao_inspecionado}
              onChange={(e) => setFormLimpeza((f) => ({ ...f, nao_inspecionado: e.target.checked, nota: null }))}
            />
            Não inspecionado hoje
          </label>
          {formLimpeza.nao_inspecionado && (
            <Campo rotulo="Justificativa *">
              <Entrada value={formLimpeza.justificativa} onChange={(e) => setFormLimpeza((f) => ({ ...f, justificativa: e.target.value }))} />
            </Campo>
          )}

          <Campo rotulo="Quadrantes inspecionados" dica="Separados por vírgula, ex.: 7C, 8C">
            <Entrada value={formLimpeza.quadrantes} onChange={(e) => setFormLimpeza((f) => ({ ...f, quadrantes: e.target.value }))} />
          </Campo>
          <Campo rotulo="Principais problemas">
            <Area rows={2} value={formLimpeza.principais_problemas} onChange={(e) => setFormLimpeza((f) => ({ ...f, principais_problemas: e.target.value }))} />
          </Campo>
          <Campo rotulo="Ação recomendada">
            <Entrada value={formLimpeza.acao_recomendada} onChange={(e) => setFormLimpeza((f) => ({ ...f, acao_recomendada: e.target.value }))} />
          </Campo>
          <Campo rotulo="Observação">
            <Area rows={2} value={formLimpeza.observacao} onChange={(e) => setFormLimpeza((f) => ({ ...f, observacao: e.target.value }))} />
          </Campo>

          <Erro erro={erro} />
        </div>
      </Modal>

      <ModalBigBag
        aberto={modal === 'bigbag'}
        aoFechar={() => setModal(null)}
        relatorioId={id}
        unidadeId={r.unidade_id}
        materiais={materiais.data || []}
        setores={setores.data || []}
        aoSalvar={() => { setModal(null); avisar('Pesagem registrada.'); invalidar(...INVALIDAR) }}
      />

      <Modal
        aberto={modal === 'concluir'}
        aoFechar={() => setModal(null)}
        titulo="Concluir relatório"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>Cancelar</Botao>
            <Botao variante="sucesso" onClick={concluir} carregando={enviando}>Concluir</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200 ring-inset">
            <p>{setoresRel.data?.filter((s) => s.nota || s.nao_inspecionado).length || 0}/{setoresRel.data?.length || 0} setores avaliados</p>
            <p>{desperdicios.length} desperdício(s) · {reaproveitamentos.length} reaproveitamento(s) · {fotosGeraisData.length} foto(s) gerais</p>
          </div>

          {desperdicios.length === 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={formConclusao.sem_desperdicio}
                onChange={(e) => setFormConclusao((f) => ({ ...f, sem_desperdicio: e.target.checked }))} />
              Nenhum desperdício identificado na inspeção de hoje
            </label>
          )}
          {reaproveitamentos.length === 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={formConclusao.sem_reaproveitamento}
                onChange={(e) => setFormConclusao((f) => ({ ...f, sem_reaproveitamento: e.target.checked }))} />
              Não houve movimentação de reaproveitamento hoje
            </label>
          )}

          <Campo rotulo="Situação geral *">
            <Area rows={2} value={formConclusao.conclusao_situacao} onChange={(e) => setFormConclusao((f) => ({ ...f, conclusao_situacao: e.target.value }))} />
          </Campo>
          <Campo rotulo="Principais pontos de atenção *">
            <Area rows={2} value={formConclusao.conclusao_atencao} onChange={(e) => setFormConclusao((f) => ({ ...f, conclusao_atencao: e.target.value }))} />
          </Campo>
          <Campo rotulo="Providências tomadas ou recomendadas *">
            <Area rows={2} value={formConclusao.conclusao_providencias} onChange={(e) => setFormConclusao((f) => ({ ...f, conclusao_providencias: e.target.value }))} />
          </Campo>

          <Erro erro={erro} />
        </div>
      </Modal>

      <Modal
        aberto={modal === 'reabrir' || modal === 'cancelar'}
        aoFechar={() => setModal(null)}
        titulo={modal === 'reabrir' ? 'Reabrir relatório' : 'Cancelar relatório'}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>Voltar</Botao>
            <Botao
              variante="perigo"
              onClick={() => reabrirOuCancelar(modal === 'reabrir' ? 'reabrir_relatorio_chao' : 'cancelar_relatorio_chao')}
              carregando={enviando}
            >
              Confirmar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Motivo *">
            <Area rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
          </Campo>
          <Erro erro={erro} />
        </div>
      </Modal>

      <ImpressaoRelatorio dados={dadosImpressao} />
    </div>
  )
}

function LinhaLancamento({ l }) {
  const tipo = TIPOS_MOVIMENTACAO_RESIDUO.find((t) => t.valor === l.tipo_movimentacao)
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-slate-800">{l.material_nome}</p>
        <Etiqueta>{tipo?.label}</Etiqueta>
        {l.condicao && <Etiqueta cor={CONDICOES_RESIDUO.find((c) => c.valor === l.condicao)?.cor}>
          {CONDICOES_RESIDUO.find((c) => c.valor === l.condicao)?.label}
        </Etiqueta>}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {(l.medicoes || []).map((m) => `${numero(m.quantidade, 2)} ${UNIDADES_MEDIDA_RESIDUO.find((u) => u.valor === m.unidade_medida)?.label}`).join(' · ')}
        {l.setor_nome ? ` · achado em ${l.setor_nome}` : ''}
        {l.provavel_setor_origem_nome ? ` · provável origem: ${l.provavel_setor_origem_nome}` : ''}
        {l.quadrante ? ` · ${l.quadrante}` : ''}
        {l.ativo_nome ? ` · ${l.ativo_nome}` : ''}
      </p>
      {l.observacao && <p className="mt-1 text-xs text-slate-400">{l.observacao}</p>}
    </li>
  )
}

function ModalBigBag({ aberto, aoFechar, relatorioId, unidadeId, materiais, setores, aoSalvar }) {
  const [modo, setModo] = useState('avulsa')
  const [form, setForm] = useState({
    identificacao: '', material_id: '', setor_id: '', peso_bruto: '', tara: '',
    peso_liquido_inicial: '', peso_liquido_final: '', quantidade_retirada: '',
  })
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [buscando, setBuscando] = useState(false)

  const buscarUltimaPesagem = async () => {
    setErro(null)
    if (!form.identificacao.trim()) { setErro(new Error('Informe a identificação do big bag primeiro.')); return }
    setBuscando(true)
    const { data: bigbag, error: erroBigbag } = await supabase
      .from('residuo_bigbags')
      .select('id')
      .eq('unidade_id', unidadeId)
      .eq('identificacao', form.identificacao.trim())
      .maybeSingle()
    if (erroBigbag || !bigbag) {
      setBuscando(false)
      setErro(new Error('Nenhuma pesagem anterior encontrada pra essa identificação.'))
      return
    }
    const { data: pesagem, error: erroPesagem } = await supabase
      .from('residuo_bigbag_pesagens')
      .select('peso_liquido_final, peso_liquido')
      .eq('bigbag_id', bigbag.id)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    setBuscando(false)
    const ultimoLiquido = pesagem?.peso_liquido_final ?? pesagem?.peso_liquido
    if (erroPesagem || ultimoLiquido == null) {
      setErro(new Error('Nenhuma pesagem anterior encontrada pra essa identificação.'))
      return
    }
    setForm((f) => ({ ...f, peso_liquido_inicial: String(ultimoLiquido) }))
  }

  const salvar = async () => {
    setErro(null)
    if (!form.identificacao.trim()) { setErro(new Error('Informe a identificação do big bag.')); return }
    setEnviando(true)
    const { data: linhas, error } = await supabase.rpc('registrar_pesagem_bigbag', {
      p_relatorio_id: relatorioId,
      p_unidade_id: unidadeId,
      p_identificacao: form.identificacao.trim(),
      p_material_id: form.material_id || null,
      p_setor_id: form.setor_id || null,
      p_peso_bruto: modo === 'avulsa' ? (Number(form.peso_bruto) || null) : null,
      p_tara: modo === 'avulsa' ? (Number(form.tara) || null) : null,
      p_peso_liquido_inicial: modo === 'acumulo' ? (Number(form.peso_liquido_inicial) || null) : null,
      p_peso_liquido_final: modo === 'acumulo' ? (Number(form.peso_liquido_final) || null) : null,
      p_quantidade_retirada: modo === 'acumulo' ? (Number(form.quantidade_retirada) || null) : null,
    })
    setEnviando(false)
    if (error) { setErro(new Error(error.message)); return }
    const linha = linhas?.[0]
    if (linha?.mensagem) { setErro(new Error(linha.mensagem)); return }
    setForm({
      identificacao: '', material_id: '', setor_id: '', peso_bruto: '', tara: '',
      peso_liquido_inicial: '', peso_liquido_final: '', quantidade_retirada: '',
    })
    setModo('avulsa')
    aoSalvar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Pesar big bag"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar} carregando={enviando}>Registrar pesagem</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Identificação do big bag *">
          <Entrada value={form.identificacao} onChange={(e) => setForm((f) => ({ ...f, identificacao: e.target.value }))} placeholder="Ex.: BB-04" />
        </Campo>
        <Campo rotulo="Material">
          <Selecao value={form.material_id} onChange={(e) => setForm((f) => ({ ...f, material_id: e.target.value }))}>
            <option value="">—</option>
            {materiais.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Setor">
          <Selecao value={form.setor_id} onChange={(e) => setForm((f) => ({ ...f, setor_id: e.target.value }))}>
            <option value="">—</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Selecao>
        </Campo>

        <Campo rotulo="Modo de pesagem">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setModo('avulsa')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${modo === 'avulsa' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              Pesagem avulsa
            </button>
            <button
              type="button"
              onClick={() => setModo('acumulo')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${modo === 'acumulo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              Acúmulo em vários dias
            </button>
          </div>
        </Campo>

        {modo === 'avulsa' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Peso bruto (kg)">
                <Entrada type="number" step="0.01" min="0" value={form.peso_bruto} onChange={(e) => setForm((f) => ({ ...f, peso_bruto: e.target.value }))} />
              </Campo>
              <Campo rotulo="Tara (kg)">
                <Entrada type="number" step="0.01" min="0" value={form.tara} onChange={(e) => setForm((f) => ({ ...f, tara: e.target.value }))} />
              </Campo>
            </div>
            {Number(form.peso_bruto) > 0 && Number(form.tara) >= 0 && (
              <p className="text-sm text-slate-500">
                Peso líquido: <strong>{numero(Number(form.peso_bruto) - Number(form.tara), 2)} kg</strong>
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              Pro mesmo big bag que vai enchendo aos poucos: informe o peso líquido que ele já tinha
              (do último registro) e o peso líquido de hoje. Se ele foi esvaziado/trocado no meio do
              caminho, informe também a quantidade retirada.
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Campo rotulo="Peso líquido inicial (kg)">
                  <Entrada type="number" step="0.01" min="0" value={form.peso_liquido_inicial} onChange={(e) => setForm((f) => ({ ...f, peso_liquido_inicial: e.target.value }))} />
                </Campo>
              </div>
              <Botao variante="secundario" onClick={buscarUltimaPesagem} carregando={buscando} className="mb-px">
                Buscar última pesagem
              </Botao>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Peso líquido final (kg) *">
                <Entrada type="number" step="0.01" min="0" value={form.peso_liquido_final} onChange={(e) => setForm((f) => ({ ...f, peso_liquido_final: e.target.value }))} />
              </Campo>
              <Campo rotulo="Quantidade retirada no meio (kg)" dica="Se houve esvaziamento parcial antes dessa leitura">
                <Entrada type="number" step="0.01" min="0" value={form.quantidade_retirada} onChange={(e) => setForm((f) => ({ ...f, quantidade_retirada: e.target.value }))} />
              </Campo>
            </div>
            {Number(form.peso_liquido_final) > 0 && form.peso_liquido_inicial !== '' && (
              <p className="text-sm text-slate-500">
                Gerado no dia: <strong>
                  {numero(Number(form.peso_liquido_final) + (Number(form.quantidade_retirada) || 0) - Number(form.peso_liquido_inicial), 2)} kg
                </strong>
              </p>
            )}
          </>
        )}

        <Erro erro={erro} />
      </div>
    </Modal>
  )
}
