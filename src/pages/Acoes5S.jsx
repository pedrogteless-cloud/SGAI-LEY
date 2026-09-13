import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks, CheckCircle2, AlertTriangle, Plus, Ban } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTabela, useUnidades, useSetores, useTecnicos, useInvalidar } from '../hooks/useDados'
import { data as fmtData } from '../lib/format'
import { hojeISO } from '../lib/tempo'
import {
  M_STATUS_ACAO_CHAO, M_PRIORIDADE_ACAO, M_ITEM_5S, PRIORIDADES_ACAO, STATUS_ACAO_CHAO,
} from '../lib/constants'
import {
  Botao, Cartao, CartaoTitulo, Campo, Entrada, Area, Selecao, Etiqueta, Carregando, Vazio,
  Modal, Erro, useAviso, Segmentado,
} from '../components/ui'
import GaleriaFotos from '../components/GaleriaFotos'

/**
 * O pedaço que faltava pro 5S virar melhoria de verdade: o problema
 * achado no checklist tem dono, prazo e prova de que foi resolvido.
 * Sem isso o sistema só documentava que o setor estava sujo — e na
 * semana seguinte documentava de novo.
 */

const ABAS = [
  { valor: 'pendentes', rotulo: 'Pendentes' },
  { valor: 'atrasadas', rotulo: 'Atrasadas' },
  { valor: 'concluidas', rotulo: 'Concluídas' },
  { valor: 'todas', rotulo: 'Todas' },
]

export default function Acoes5S() {
  const { perfil, ehGestor } = useAuth()
  const avisar = useAviso()
  const invalidar = useInvalidar()

  const [unidadeId, setUnidadeId] = useState(perfil?.unidade_id || '')
  const [aba, setAba] = useState('pendentes')
  const [soMinhas, setSoMinhas] = useState(false)
  const [concluindo, setConcluindo] = useState(null)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const unidades = useUnidades()
  const unidadeAtual = unidadeId || unidades.data?.[0]?.id || ''
  const setores = useSetores(unidadeAtual)
  const tecnicos = useTecnicos()

  const acoes = useTabela('vw_acoes_chao', {
    filtros: unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : [],
    ordem: { coluna: 'prazo' },
    limite: 300,
  })

  const [formConclusao, setFormConclusao] = useState({ observacao: '', fotos: [] })
  const [formNova, setFormNova] = useState({
    descricao: '', setor_id: '', quadrante: '', prioridade: 'media', prazo: '', responsavel_id: '',
  })

  const lista = useMemo(() => {
    let l = acoes.data || []
    if (soMinhas) l = l.filter((a) => a.responsavel_id === perfil?.id)
    if (aba === 'pendentes') l = l.filter((a) => ['aberta', 'em_andamento'].includes(a.status))
    if (aba === 'atrasadas') l = l.filter((a) => a.dias_atraso != null && a.dias_atraso > 0)
    if (aba === 'concluidas') l = l.filter((a) => a.status === 'concluida')
    return l
  }, [acoes.data, aba, soMinhas, perfil?.id])

  const resumo = useMemo(() => {
    const todas = acoes.data || []
    const pendentes = todas.filter((a) => ['aberta', 'em_andamento'].includes(a.status))
    return {
      pendentes: pendentes.length,
      atrasadas: pendentes.filter((a) => a.dias_atraso != null && a.dias_atraso > 0).length,
      semPrazo: pendentes.filter((a) => !a.prazo).length,
      semDono: pendentes.filter((a) => !a.responsavel_id).length,
    }
  }, [acoes.data])

  const abrirConclusao = (a) => {
    setFormConclusao({ observacao: '', fotos: [] })
    setErro(null)
    setConcluindo(a)
  }

  const confirmarConclusao = async () => {
    setErro(null)
    setEnviando(true)
    const { data: linhas, error } = await supabase.rpc('concluir_acao_chao', {
      p_acao_id: concluindo.id,
      p_observacao: formConclusao.observacao.trim() || null,
      p_evidencia_url: formConclusao.fotos[0]?.url || null,
    })
    setEnviando(false)
    if (error) { setErro(new Error(error.message)); return }
    const linha = linhas?.[0]
    if (linha?.mensagem) { setErro(new Error(linha.mensagem)); return }
    setConcluindo(null)
    avisar('Ação concluída.')
    invalidar('vw_acoes_chao')
  }

  const criarAcao = async () => {
    setErro(null)
    if (!formNova.descricao.trim()) { setErro(new Error('Descreva o que precisa ser feito.')); return }
    setEnviando(true)
    const { data: linhas, error } = await supabase.rpc('criar_acao_chao', {
      p_unidade_id: unidadeAtual,
      p_descricao: formNova.descricao.trim(),
      p_setor_id: formNova.setor_id || null,
      p_quadrante: formNova.quadrante.trim() || null,
      p_prioridade: formNova.prioridade,
      p_prazo: formNova.prazo || null,
      p_responsavel_id: formNova.responsavel_id || null,
    })
    setEnviando(false)
    if (error) { setErro(new Error(error.message)); return }
    const linha = linhas?.[0]
    if (linha?.mensagem) { setErro(new Error(linha.mensagem)); return }
    setCriando(false)
    setFormNova({ descricao: '', setor_id: '', quadrante: '', prioridade: 'media', prazo: '', responsavel_id: '' })
    avisar('Ação aberta.')
    invalidar('vw_acoes_chao')
  }

  const mudarStatus = async (a, status) => {
    const motivo = status === 'cancelada'
      ? window.prompt('Por que essa ação está sendo cancelada?')
      : null
    if (status === 'cancelada' && !motivo?.trim()) return

    const { data: linhas, error } = await supabase.rpc('atualizar_acao_chao', {
      p_acao_id: a.id,
      p_status: status,
      p_motivo: motivo?.trim() || null,
    })
    if (error) { avisar(error.message, 'erro'); return }
    if (linhas?.[0]?.mensagem) { avisar(linhas[0].mensagem, 'erro'); return }
    invalidar('vw_acoes_chao')
  }

  return (
    <div className="entra space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Ações do 5S</h1>
          <p className="text-sm text-slate-500">O que foi achado na inspeção e ainda precisa ser resolvido</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(unidades.data || []).length > 1 && (
            <Selecao value={unidadeAtual} onChange={(e) => setUnidadeId(e.target.value)} className="w-auto">
              {(unidades.data || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
          )}
          <Botao onClick={() => { setErro(null); setCriando(true) }}>
            <Plus size={16} /> Nova ação
          </Botao>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Pendentes</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{resumo.pendentes}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Atrasadas</p>
          <p className={`mt-1 text-2xl font-bold ${resumo.atrasadas > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {resumo.atrasadas}
          </p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Sem prazo</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{resumo.semPrazo}</p>
          <p className="mt-0.5 text-xs text-slate-400">ninguém sabe quando vence</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Sem responsável</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{resumo.semDono}</p>
          <p className="mt-0.5 text-xs text-slate-400">ninguém foi combinado</p>
        </Cartao>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmentado valor={aba} aoMudar={setAba} opcoes={ABAS} className="w-full sm:w-auto" />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={soMinhas} onChange={(e) => setSoMinhas(e.target.checked)} />
          Só as minhas
        </label>
      </div>

      <Cartao>
        {acoes.isLoading ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio
            icone={aba === 'pendentes' ? CheckCircle2 : ListChecks}
            titulo={aba === 'pendentes' ? 'Nenhuma pendência em aberto' : 'Nada aqui'}
            descricao={
              aba === 'pendentes'
                ? 'Tudo que o checklist apontou já foi resolvido — ou ainda não virou ação com dono.'
                : undefined
            }
          />
        ) : (
          <ul className="cascata divide-y" style={{ borderColor: 'var(--traco)' }}>
            {lista.map((a) => {
              const atrasada = a.dias_atraso != null && a.dias_atraso > 0
              const pendente = ['aberta', 'em_andamento'].includes(a.status)
              return (
                <li key={a.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{a.descricao}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {a.setor_nome || 'Sem setor'}
                        {a.quadrante ? ` · ${a.quadrante}` : ''}
                        {a.item_5s ? ` · ${M_ITEM_5S[a.item_5s]?.titulo || a.item_5s}` : ''}
                        {a.relatorio_data ? ` · achado em ${fmtData(a.relatorio_data)}` : ''}
                      </p>
                      {a.descricao_problema && a.descricao_problema !== a.descricao && (
                        <p className="mt-1 text-xs text-slate-500">Problema: {a.descricao_problema}</p>
                      )}
                      {a.status === 'concluida' && (
                        <p className="mt-1 text-xs text-emerald-700">
                          Concluída {a.concluida_em ? `em ${fmtData(a.concluida_em)}` : ''}
                          {a.concluida_por_nome ? ` por ${a.concluida_por_nome}` : ''}
                          {a.observacao_conclusao ? ` — ${a.observacao_conclusao}` : ''}
                        </p>
                      )}
                      {a.evidencia_url && (
                        <a
                          href={a.evidencia_url} target="_blank" rel="noreferrer"
                          className="mt-1 inline-block text-xs font-medium text-sky-600"
                        >
                          ver evidência
                        </a>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Etiqueta cor={M_PRIORIDADE_ACAO[a.prioridade]?.cor}>
                        {M_PRIORIDADE_ACAO[a.prioridade]?.label}
                      </Etiqueta>
                      <Etiqueta cor={M_STATUS_ACAO_CHAO[a.status]?.cor}>
                        {M_STATUS_ACAO_CHAO[a.status]?.label}
                      </Etiqueta>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`text-xs ${atrasada ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                      {!a.prazo
                        ? 'Sem prazo combinado'
                        : atrasada
                          ? `Atrasada ${a.dias_atraso} dia(s) — vencia ${fmtData(a.prazo)}`
                          : pendente
                            ? `Vence ${fmtData(a.prazo)}${a.dias_atraso != null ? ` (faltam ${Math.abs(a.dias_atraso)} dia(s))` : ''}`
                            : `Prazo era ${fmtData(a.prazo)}`}
                    </span>
                    <span className="text-xs text-slate-400">
                      · {a.responsavel_nome || 'sem responsável'}
                    </span>

                    {pendente && (
                      <span className="ml-auto flex flex-wrap gap-1.5">
                        {a.status === 'aberta' && (
                          <Botao tamanho="sm" variante="secundario" onClick={() => mudarStatus(a, 'em_andamento')}>
                            Comecei
                          </Botao>
                        )}
                        <Botao tamanho="sm" variante="sucesso" onClick={() => abrirConclusao(a)}>
                          <CheckCircle2 size={13} /> Concluir
                        </Botao>
                        {ehGestor && (
                          <Botao tamanho="sm" variante="fantasma" onClick={() => mudarStatus(a, 'cancelada')}>
                            <Ban size={13} />
                          </Botao>
                        )}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>

      {resumo.semDono > 0 && aba === 'pendentes' && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800 ring-1 ring-amber-200 ring-inset">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            {resumo.semDono} ação(ões) sem responsável. Enquanto não tiver um nome e uma data,
            na prática não foi combinado com ninguém — é o tipo de pendência que volta igual
            na inspeção da semana que vem.
          </span>
        </div>
      )}

      {/* ------------------------------------------------------- concluir */}
      <Modal
        aberto={Boolean(concluindo)}
        aoFechar={() => setConcluindo(null)}
        titulo="Concluir ação"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConcluindo(null)}>Cancelar</Botao>
            <Botao variante="sucesso" onClick={confirmarConclusao} carregando={enviando}>Concluir</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200 ring-inset">
            {concluindo?.descricao}
            <p className="mt-1 text-xs text-slate-500">
              {concluindo?.setor_nome}{concluindo?.quadrante ? ` · ${concluindo.quadrante}` : ''}
            </p>
          </div>
          <Campo rotulo="O que foi feito" dica="Uma linha basta">
            <Area
              rows={2}
              value={formConclusao.observacao}
              onChange={(e) => setFormConclusao((f) => ({ ...f, observacao: e.target.value }))}
              placeholder="Ex.: piso limpo e bandeja instalada embaixo da prensa"
            />
          </Campo>
          <Campo rotulo="Foto de evidência" dica="Opcional, mas é o que prova que resolveu">
            <GaleriaFotos
              valor={formConclusao.fotos}
              aoMudar={(novo) => setFormConclusao((f) => ({ ...f, fotos: novo }))}
            />
          </Campo>
          <Erro erro={erro} />
        </div>
      </Modal>

      {/* ---------------------------------------------------- nova ação */}
      <Modal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Nova ação"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setCriando(false)}>Cancelar</Botao>
            <Botao onClick={criarAcao} carregando={enviando}>Abrir ação</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="O que precisa ser feito *">
            <Area
              rows={2}
              value={formNova.descricao}
              onChange={(e) => setFormNova((f) => ({ ...f, descricao: e.target.value }))}
              autoFocus
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Setor">
              <Selecao value={formNova.setor_id} onChange={(e) => setFormNova((f) => ({ ...f, setor_id: e.target.value }))}>
                <option value="">—</option>
                {(setores.data || []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </Selecao>
            </Campo>
            <Campo rotulo="Quadrante" dica='Ex.: "7C"'>
              <Entrada value={formNova.quadrante} onChange={(e) => setFormNova((f) => ({ ...f, quadrante: e.target.value }))} />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Quem resolve">
              <Selecao value={formNova.responsavel_id} onChange={(e) => setFormNova((f) => ({ ...f, responsavel_id: e.target.value }))}>
                <option value="">— decido depois —</option>
                {(tecnicos.data || []).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </Selecao>
            </Campo>
            <Campo rotulo="Até quando">
              <Entrada
                type="date" min={hojeISO()}
                value={formNova.prazo}
                onChange={(e) => setFormNova((f) => ({ ...f, prazo: e.target.value }))}
              />
            </Campo>
          </div>
          <Campo rotulo="Prioridade">
            <Selecao value={formNova.prioridade} onChange={(e) => setFormNova((f) => ({ ...f, prioridade: e.target.value }))}>
              {PRIORIDADES_ACAO.map((p) => <option key={p.valor} value={p.valor}>{p.label}</option>)}
            </Selecao>
          </Campo>
          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
