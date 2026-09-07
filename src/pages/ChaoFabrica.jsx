import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Recycle, ArrowRight, ClipboardList, Target, History, Settings2, Download, Sparkles,
  AlertTriangle, CheckCircle2, MinusCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { gerarEBaixarResiduosChao } from '../lib/relatoriosXlsx'
import { useAuth } from '../hooks/useAuth'
import {
  useTabela, useUnidades, useSetores, useTecnicos, useMateriaisResiduo, useInserir, useInvalidar,
} from '../hooks/useDados'
import { data as fmtData, dataHora, numero } from '../lib/format'
import { M_STATUS_CHAO, STATUS_RELATORIO_CHAO } from '../lib/constants'
import {
  PERIODOS, limitesPeriodo, achatarLancamentos, agregarPeriodo, agregarLimpeza,
  variacaoPercentual, indiceDestinacaoUtil, gerarInsights, calcularRealizadoMeta, situacaoMeta,
} from '../lib/chaoIndicadores'
import {
  Botao, Cartao, CartaoTitulo, Campo, Entrada, Area, Selecao, Etiqueta, Carregando, Vazio,
  Modal, Segmentado, Tabela, Th, Td, Erro, useAviso,
} from '../components/ui'

const ABA_INICIAL = 'hoje'

export default function ChaoFabrica() {
  const navegar = useNavigate()
  const avisar = useAviso()
  const { perfil, ehGestor } = useAuth()

  const [aba, setAba] = useState(ABA_INICIAL)
  const [unidadeId, setUnidadeId] = useState(perfil?.unidade_id || '')
  const [abrindo, setAbrindo] = useState(false)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const [form, setForm] = useState({
    turno: '', responsavel_id: perfil?.id || '', setores_ids: [],
    horario_previsto: '', observacao_inicial: '',
  })
  const [justificativa, setJustificativa] = useState('')
  const [pedeJustificativa, setPedeJustificativa] = useState(false)

  const unidades = useUnidades()
  const unidadeAtual = unidadeId || unidades.data?.[0]?.id || ''
  const setores = useSetores(unidadeAtual)
  const tecnicos = useTecnicos()

  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPeriodoHist, setFiltroPeriodoHist] = useState({ inicio: '', fim: '' })
  const [exportando, setExportando] = useState(false)
  const historico = useTabela('vw_relatorio_chao_resumo', {
    filtros: [
      ...(unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : []),
      ...(filtroStatus ? [['status', 'eq', filtroStatus]] : []),
      ...(filtroPeriodoHist.inicio ? [['data', 'gte', filtroPeriodoHist.inicio]] : []),
      ...(filtroPeriodoHist.fim ? [['data', 'lte', filtroPeriodoHist.fim]] : []),
    ],
    ordem: { coluna: 'data', asc: false },
    limite: 200,
  })

  const exportarHistorico = async () => {
    setExportando(true)
    try {
      await gerarEBaixarResiduosChao({
        inicio: filtroPeriodoHist.inicio || '2000-01-01',
        fim: filtroPeriodoHist.fim || new Date().toISOString().slice(0, 10),
        unidadeId: unidadeAtual || null,
      })
    } catch (e) {
      avisar(`Não consegui gerar a planilha: ${e.message}`, 'erro')
    } finally {
      setExportando(false)
    }
  }

  const hoje = useTabela('vw_relatorio_chao_resumo', {
    filtros: [
      ...(unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : []),
      ['data', 'eq', new Date().toISOString().slice(0, 10)],
      ['status', 'in', ['aberta', 'em_andamento', 'reaberta']],
    ],
    ordem: { coluna: 'aberta_em', asc: false },
  })

  const saldos = useTabela('vw_residuo_saldo_material', { ordem: { coluna: 'saldo', asc: false } })
  const materiais = useMateriaisResiduo()

  const abrirModalNovo = () => {
    setForm({
      turno: '', responsavel_id: perfil?.id || '', setores_ids: (setores.data || []).map((s) => s.id),
      horario_previsto: '', observacao_inicial: '',
    })
    setJustificativa('')
    setPedeJustificativa(false)
    setErro(null)
    setAbrindo(true)
  }

  const alternarSetor = (id) =>
    setForm((f) => ({
      ...f,
      setores_ids: f.setores_ids.includes(id)
        ? f.setores_ids.filter((s) => s !== id)
        : [...f.setores_ids, id],
    }))

  const abrirRelatorio = async () => {
    setErro(null)
    setEnviando(true)
    const { data: linhas, error } = await supabase.rpc('abrir_relatorio_chao', {
      p_unidade_id: unidadeAtual,
      p_turno: form.turno.trim() || null,
      p_responsavel_id: form.responsavel_id || null,
      p_setores_ids: form.setores_ids,
      p_horario_previsto: form.horario_previsto || null,
      p_observacao_inicial: form.observacao_inicial.trim() || null,
      p_justificativa_duplicidade: justificativa.trim() || null,
    })
    setEnviando(false)
    if (error) {
      setErro(new Error(error.message))
      return
    }
    const linha = linhas?.[0]
    if (linha?.mensagem) {
      if (linha.mensagem.includes('gestor') && !pedeJustificativa) {
        setPedeJustificativa(true)
        return
      }
      setErro(new Error(linha.mensagem))
      return
    }
    setAbrindo(false)
    avisar(`Relatório ${linha.numero} aberto.`)
    navegar(`/desperdicios/${linha.id}`)
  }

  const abas = [
    { valor: 'hoje', rotulo: 'Hoje' },
    { valor: 'historico', rotulo: 'Histórico' },
    { valor: 'indicadores', rotulo: 'Indicadores' },
    { valor: 'metas', rotulo: 'Metas' },
  ]

  return (
    <div className="entra space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Desperdícios e Reaproveitamento</h1>
          <p className="text-sm text-slate-500">Inspeção diária do chão de fábrica</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(unidades.data || []).length > 1 && (
            <Selecao value={unidadeAtual} onChange={(e) => setUnidadeId(e.target.value)} className="w-auto">
              {(unidades.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </Selecao>
          )}
          {ehGestor && (
            <Link to="/desperdicios/materiais">
              <Botao variante="secundario" title="Cadastro de materiais">
                <Settings2 size={15} /> Materiais
              </Botao>
            </Link>
          )}
          <Botao onClick={abrirModalNovo}>
            <Plus size={16} /> Abrir relatório do dia
          </Botao>
        </div>
      </div>

      <Segmentado valor={aba} aoMudar={setAba} opcoes={abas} className="w-full sm:w-auto" />

      {aba === 'hoje' && (
        <div className="space-y-4">
          {hoje.isLoading ? (
            <Carregando />
          ) : (hoje.data || []).length === 0 ? (
            <Cartao>
              <Vazio
                icone={ClipboardList}
                titulo="Nenhum relatório em andamento hoje"
                descricao='Toque em "Abrir relatório do dia" pra começar a inspeção.'
                acao={<Botao onClick={abrirModalNovo}><Plus size={15} /> Abrir relatório do dia</Botao>}
              />
            </Cartao>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {hoje.data.map((r) => (
                <Link key={r.id} to={`/desperdicios/${r.id}`}>
                  <Cartao flutua className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-500">{r.numero}</span>
                          <Etiqueta cor={M_STATUS_CHAO[r.status]?.cor}>{M_STATUS_CHAO[r.status]?.label}</Etiqueta>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">
                          {r.responsavel || 'Sem responsável definido'}
                          {r.turno ? ` · ${r.turno}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {r.setores_avaliados}/{r.setores_previstos} setores avaliados ·{' '}
                          {r.qtd_desperdicios} desperdício(s) · {r.qtd_reaproveitamentos} reaproveitamento(s)
                        </p>
                      </div>
                      <ArrowRight size={16} className="mt-1 shrink-0 text-slate-300" />
                    </div>
                  </Cartao>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {aba === 'historico' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Selecao value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-auto">
              <option value="">Todos os status</option>
              {STATUS_RELATORIO_CHAO.map((s) => (
                <option key={s.valor} value={s.valor}>{s.label}</option>
              ))}
            </Selecao>
            <Entrada
              type="date" className="w-auto" value={filtroPeriodoHist.inicio}
              onChange={(e) => setFiltroPeriodoHist((f) => ({ ...f, inicio: e.target.value }))}
              title="De"
            />
            <span className="text-sm text-slate-400">até</span>
            <Entrada
              type="date" className="w-auto" value={filtroPeriodoHist.fim}
              onChange={(e) => setFiltroPeriodoHist((f) => ({ ...f, fim: e.target.value }))}
              title="Até"
            />
            <Botao
              variante="secundario" tamanho="sm" onClick={exportarHistorico} carregando={exportando}
              className="ml-auto"
            >
              <Download size={14} /> Exportar Excel
            </Botao>
          </div>

          <Cartao>
            {historico.isLoading ? (
              <Carregando />
            ) : (historico.data || []).length === 0 ? (
              <Vazio icone={History} titulo="Nenhum relatório ainda" />
            ) : (
              <>
                <ul className="cascata divide-y sm:hidden" style={{ borderColor: 'var(--traco)' }}>
                  {historico.data.map((r) => (
                    <li key={r.id}>
                      <Link to={`/desperdicios/${r.id}`} className="flex items-start justify-between gap-3 px-4 py-3.5 active:bg-slate-50">
                        <div className="min-w-0">
                          <p className="font-medium text-sky-600">{r.numero}</p>
                          <p className="text-xs text-slate-400">
                            {fmtData(r.data)}{r.turno ? ` · ${r.turno}` : ''}{r.responsavel ? ` · ${r.responsavel}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {r.nota_media != null ? `nota ${numero(r.nota_media, 1)}` : 'sem nota'}
                            {' · '}{r.qtd_desperdicios} desperdício(s) · {r.qtd_reaproveitamentos} reaproveitamento(s)
                          </p>
                        </div>
                        <Etiqueta cor={M_STATUS_CHAO[r.status]?.cor}>{M_STATUS_CHAO[r.status]?.label}</Etiqueta>
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="hidden sm:block">
                  <Tabela>
                    <thead>
                      <tr>
                        <Th>Relatório</Th>
                        <Th>Responsável</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Limpeza</Th>
                        <Th className="text-right">Desperdício</Th>
                        <Th className="text-right">Reaproveitamento</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.data.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <Td>
                            <Link to={`/desperdicios/${r.id}`} className="font-medium text-sky-600 hover:text-sky-700">
                              {r.numero}
                            </Link>
                            <p className="text-xs text-slate-400">{fmtData(r.data)}{r.turno ? ` · ${r.turno}` : ''}</p>
                          </Td>
                          <Td className="text-slate-700">{r.responsavel || '—'}</Td>
                          <Td><Etiqueta cor={M_STATUS_CHAO[r.status]?.cor}>{M_STATUS_CHAO[r.status]?.label}</Etiqueta></Td>
                          <Td className="text-right">{r.nota_media != null ? numero(r.nota_media, 1) : '—'}</Td>
                          <Td className="text-right">{r.qtd_desperdicios}</Td>
                          <Td className="text-right">{r.qtd_reaproveitamentos}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Tabela>
                </div>
              </>
            )}
          </Cartao>
        </div>
      )}

      {aba === 'indicadores' && (
        <PainelIndicadores saldos={saldos} unidadeAtual={unidadeAtual} />
      )}

      {aba === 'metas' && (
        <PainelMetas ehGestor={ehGestor} materiais={materiais} setores={setores} unidadeAtual={unidadeAtual} />
      )}

      {/* -------------------------------------------------------- abertura */}
      <Modal
        aberto={abrindo}
        aoFechar={() => setAbrindo(false)}
        titulo="Abrir relatório do dia"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAbrindo(false)}>Cancelar</Botao>
            <Botao onClick={abrirRelatorio} carregando={enviando}>
              Abrir
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Data de hoje ({fmtData(new Date().toISOString())}), preenchida sozinha.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Turno" dica="Opcional">
              <Entrada value={form.turno} onChange={(e) => setForm((f) => ({ ...f, turno: e.target.value }))} placeholder="Ex.: manhã" />
            </Campo>
            <Campo rotulo="Responsável">
              <Selecao value={form.responsavel_id} onChange={(e) => setForm((f) => ({ ...f, responsavel_id: e.target.value }))}>
                <option value="">—</option>
                {(tecnicos.data || []).map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </Selecao>
            </Campo>
          </div>
          <Campo rotulo="Horário previsto para conclusão" dica="Opcional">
            <Entrada type="time" value={form.horario_previsto} onChange={(e) => setForm((f) => ({ ...f, horario_previsto: e.target.value }))} />
          </Campo>
          <Campo rotulo="Setores a inspecionar">
            <div className="flex flex-wrap gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200 ring-inset">
              {(setores.data || []).map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                    form.setores_ids.includes(s.id)
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={form.setores_ids.includes(s.id)}
                    onChange={() => alternarSetor(s.id)}
                  />
                  {s.nome}
                </label>
              ))}
            </div>
          </Campo>
          <Campo rotulo="Observação inicial" dica="Opcional">
            <Area rows={2} value={form.observacao_inicial} onChange={(e) => setForm((f) => ({ ...f, observacao_inicial: e.target.value }))} />
          </Campo>

          {pedeJustificativa && (
            <Campo
              rotulo="Já existe relatório pra hoje/unidade/turno — justifique pra abrir outro (só gestor)"
              erro={!justificativa.trim() ? undefined : undefined}
            >
              <Area rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que precisa de um segundo relatório" />
            </Campo>
          )}

          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}

/* -------------------------------------------------------------- indicadores */

function PainelIndicadores({ saldos, unidadeAtual }) {
  const [periodoChave, setPeriodoChave] = useState('mes')
  const [personalizado, setPersonalizado] = useState({ inicio: '', fim: '' })
  const [quadranteFiltro, setQuadranteFiltro] = useState('')

  const { inicio, fim, inicioAnterior, fimAnterior } = useMemo(
    () => limitesPeriodo(periodoChave, personalizado),
    [periodoChave, personalizado]
  )

  const filtroUnidade = unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : []

  const lancAtual = useTabela('vw_residuo_lancamentos', {
    filtros: [...filtroUnidade, ['relatorio_data', 'gte', inicio], ['relatorio_data', 'lte', fim]],
  })
  const lancAnterior = useTabela('vw_residuo_lancamentos', {
    filtros: [...filtroUnidade, ['relatorio_data', 'gte', inicioAnterior], ['relatorio_data', 'lte', fimAnterior]],
  })
  const avaliacoesAtual = useTabela('vw_relatorio_chao_setor_avaliacoes', {
    filtros: [...filtroUnidade, ['relatorio_data', 'gte', inicio], ['relatorio_data', 'lte', fim]],
  })
  const avaliacoesAnterior = useTabela('vw_relatorio_chao_setor_avaliacoes', {
    filtros: [...filtroUnidade, ['relatorio_data', 'gte', inicioAnterior], ['relatorio_data', 'lte', fimAnterior]],
  })
  const relatoriosPeriodo = useTabela('vw_relatorio_chao_resumo', {
    filtros: [...filtroUnidade, ['data', 'gte', inicio], ['data', 'lte', fim]],
  })

  const carregando =
    lancAtual.isLoading || lancAnterior.isLoading || avaliacoesAtual.isLoading || relatoriosPeriodo.isLoading

  const linhasAtual = useMemo(() => achatarLancamentos(lancAtual.data), [lancAtual.data])
  const linhasAnterior = useMemo(() => achatarLancamentos(lancAnterior.data), [lancAnterior.data])

  const linhasAtualFiltradas = useMemo(
    () => (quadranteFiltro ? linhasAtual.filter((l) => l.quadrante === quadranteFiltro) : linhasAtual),
    [linhasAtual, quadranteFiltro]
  )

  const atual = useMemo(() => agregarPeriodo(linhasAtualFiltradas), [linhasAtualFiltradas])
  const anterior = useMemo(() => agregarPeriodo(linhasAnterior), [linhasAnterior])
  const limpezaAtual = useMemo(() => agregarLimpeza(avaliacoesAtual.data), [avaliacoesAtual.data])
  const limpezaAnterior = useMemo(() => agregarLimpeza(avaliacoesAnterior.data), [avaliacoesAnterior.data])

  const variacaoGeral = variacaoPercentual(atual.geradoTotalKg, anterior.geradoTotalKg)
  const destinacaoUtilPct = indiceDestinacaoUtil(atual)

  const insights = useMemo(
    () =>
      gerarInsights({
        atual, anterior, limpezaAtual, limpezaAnterior, relatorios: relatoriosPeriodo.data,
      }),
    [atual, anterior, limpezaAtual, limpezaAnterior, relatoriosPeriodo.data]
  )

  const lista = saldos.data || []
  const topMaterialSaldo = [...lista].sort((a, b) => Number(b.saldo) - Number(a.saldo))[0]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Selecao value={periodoChave} onChange={(e) => setPeriodoChave(e.target.value)} className="w-auto">
          {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
        </Selecao>
        {periodoChave === 'personalizado' && (
          <>
            <Entrada type="date" className="w-auto" value={personalizado.inicio}
              onChange={(e) => setPersonalizado((f) => ({ ...f, inicio: e.target.value }))} />
            <span className="text-sm text-slate-400">até</span>
            <Entrada type="date" className="w-auto" value={personalizado.fim}
              onChange={(e) => setPersonalizado((f) => ({ ...f, fim: e.target.value }))} />
          </>
        )}
        {atual.quadrantesDistintos.length > 0 && (
          <Selecao value={quadranteFiltro} onChange={(e) => setQuadranteFiltro(e.target.value)} className="w-auto">
            <option value="">Todos os quadrantes</option>
            {atual.quadrantesDistintos.map((q) => <option key={q} value={q}>{q}</option>)}
          </Selecao>
        )}
        <span className="text-xs text-slate-400">
          {fmtData(inicio)} até {fmtData(fim)}
        </span>
      </div>

      {carregando ? (
        <Carregando />
      ) : (
        <>
          {/* -------------------------------------------------- resumo do topo */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cartao className="p-4">
              <p className="text-xs text-slate-500">Resíduos gerados (kg)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{numero(atual.geradoTotalKg, 1)}</p>
              {variacaoGeral != null && (
                <p className={`mt-0.5 text-xs font-medium ${variacaoGeral >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {variacaoGeral >= 0 ? '+' : ''}{numero(variacaoGeral, 0)}% vs. período anterior
                </p>
              )}
            </Cartao>
            <Cartao className="p-4">
              <p className="text-xs text-slate-500">Descartado (kg)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{numero(atual.descartado, 1)}</p>
              <p className="mt-0.5 text-xs text-slate-400">enviado p/ moagem: {numero(atual.enviadoMoagem, 1)} kg</p>
            </Cartao>
            <Cartao className="p-4">
              <p className="text-xs text-slate-500">Destinação útil</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {destinacaoUtilPct != null ? `${numero(destinacaoUtilPct, 0)}%` : '—'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">reutilizado + reciclado ÷ (isso + descarte)</p>
            </Cartao>
            <Cartao className="p-4">
              <p className="text-xs text-slate-500">Nota média de limpeza</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {limpezaAtual.notaMedia != null ? numero(limpezaAtual.notaMedia, 1) : '—'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {limpezaAtual.pctInspecionados != null ? `${numero(limpezaAtual.pctInspecionados, 0)}% dos setores inspecionados` : 'sem avaliação no período'}
              </p>
            </Cartao>
          </div>

          {/* --------------------------------------------------------- insights */}
          {insights.length > 0 && (
            <Cartao className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Sparkles size={14} className="text-amber-500" /> O que os números mostram
              </p>
              <ul className="space-y-1.5">
                {insights.map((frase, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
                    {frase}
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          {/* --------------------------------------------------------- geração */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao>
              <CartaoTitulo>Geração por material</CartaoTitulo>
              <ListaBarras itens={atual.geradoPorMaterial} vazio="Nenhum desperdício no período." />
            </Cartao>
            <Cartao>
              <CartaoTitulo>Geração por setor</CartaoTitulo>
              <ListaBarras itens={atual.geradoPorSetor} vazio="Nenhum desperdício no período." />
            </Cartao>
            <Cartao>
              <CartaoTitulo>Geração por origem</CartaoTitulo>
              <ListaBarras itens={atual.geradoPorOrigem} vazio="Nenhum desperdício no período." />
            </Cartao>
            <Cartao>
              <CartaoTitulo>Ocorrências por quadrante</CartaoTitulo>
              <ListaBarras itens={atual.geradoPorQuadrante} vazio="Nenhum quadrante informado no período." />
            </Cartao>
          </div>

          {/* --------------------------------------------------- reaproveitamento */}
          <Cartao>
            <CartaoTitulo>Reaproveitamento no período</CartaoTitulo>
            <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Identificado', atual.identificadoReaproveitavel],
                ['Separado', atual.separado],
                ['Enviado p/ moagem', atual.enviadoMoagem],
                ['Moído', atual.moido],
                ['Reutilizado', atual.reutilizadoInterno],
                ['Vendido/reciclado', atual.vendidoReciclado],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="bg-white p-3">
                  <p className="text-xs text-slate-500">{rotulo}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{numero(valor, 1)} kg</p>
                </div>
              ))}
            </div>
          </Cartao>

          {/* ------------------------------------------------------------ limpeza */}
          <Cartao>
            <CartaoTitulo>Limpeza por setor no período</CartaoTitulo>
            {limpezaAtual.mediaPorSetor.length === 0 ? (
              <Vazio titulo="Nenhuma avaliação de limpeza no período" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {limpezaAtual.mediaPorSetor.map((s) => (
                  <li key={s.setor} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm text-slate-700">{s.setor}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{s.n} avaliação(ões)</span>
                      <Etiqueta cor={s.media <= 2 ? 'bg-red-100 text-red-700 ring-red-200' : s.media < 4 ? 'bg-amber-100 text-amber-700 ring-amber-200' : 'bg-emerald-100 text-emerald-700 ring-emerald-200'}>
                        {numero(s.media, 1)}
                      </Etiqueta>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </>
      )}

      <Cartao>
        <CartaoTitulo>Saldo acumulado por material (desde sempre)</CartaoTitulo>
        {lista.length === 0 ? (
          <Vazio icone={Recycle} titulo="Ainda não há lançamento" descricao="Os saldos aparecem assim que o primeiro relatório for preenchido." />
        ) : (
          <>
            {/* 8 colunas não cabem no celular nem esticando — cada material
                vira um cartãozinho com os mesmos números num grid 3x2. */}
            <ul className="cascata divide-y sm:hidden" style={{ borderColor: 'var(--traco)' }}>
              {lista.map((s) => (
                <li key={`${s.material_id}-${s.unidade_medida}`} className="px-4 py-3">
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium text-slate-800">{s.material_nome}</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {numero(s.saldo, 1)} {s.unidade_medida}
                    </p>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>Gerado: {numero(s.gerado, 1)}</span>
                    <span>Separado: {numero(s.separado, 1)}</span>
                    <span>Moído: {numero(s.moido, 1)}</span>
                    <span>Reutilizado: {numero(s.reutilizado_interno, 1)}</span>
                    <span>Descartado: {numero(s.descartado, 1)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block">
              <Tabela>
                <thead>
                  <tr>
                    <Th>Material</Th>
                    <Th>Unidade</Th>
                    <Th className="text-right">Gerado</Th>
                    <Th className="text-right">Separado</Th>
                    <Th className="text-right">Moído</Th>
                    <Th className="text-right">Reutilizado</Th>
                    <Th className="text-right">Descartado</Th>
                    <Th className="text-right">Saldo</Th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((s) => (
                    <tr key={`${s.material_id}-${s.unidade_medida}`} className="hover:bg-slate-50">
                      <Td className="text-slate-700">{s.material_nome}</Td>
                      <Td className="text-slate-500">{s.unidade_medida}</Td>
                      <Td className="text-right">{numero(s.gerado, 1)}</Td>
                      <Td className="text-right">{numero(s.separado, 1)}</Td>
                      <Td className="text-right">{numero(s.moido, 1)}</Td>
                      <Td className="text-right">{numero(s.reutilizado_interno, 1)}</Td>
                      <Td className="text-right">{numero(s.descartado, 1)}</Td>
                      <Td className="text-right font-semibold">{numero(s.saldo, 1)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            </div>
          </>
        )}
      </Cartao>
      {topMaterialSaldo && (
        <p className="text-xs text-slate-400">
          {topMaterialSaldo.material_nome} é o material com maior saldo aguardando processamento agora ({numero(topMaterialSaldo.saldo, 1)} {topMaterialSaldo.unidade_medida}).
        </p>
      )}
    </div>
  )
}

/** Barrinha proporcional ao maior valor da lista — leve, sem biblioteca de gráfico. */
function ListaBarras({ itens, vazio }) {
  if (!itens.length) return <Vazio titulo={vazio} />
  const maior = Math.max(...itens.map((i) => i.valor)) || 1
  return (
    <ul className="space-y-2.5 px-4 py-3">
      {itens.map((i) => (
        <li key={i.chave}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-slate-600">{i.chave}</span>
            <span className="shrink-0 font-medium text-slate-500">{numero(i.valor, 1)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-sky-500"
              style={{ width: `${Math.max(4, (i.valor / maior) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------- metas */

const CHAVE_JANELA_POR_PERIODICIDADE = { diaria: 'hoje', semanal: 'semana', mensal: 'mes', anual: 'ano' }

/** Dados de um período (achatado + avaliações + relatórios), só busca quando `ativo`. */
function useDadosPeriodo(chaveJanela, ativo, unidadeAtual) {
  const { inicio, fim } = limitesPeriodo(chaveJanela)
  const filtroUnidade = unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : []
  const lanc = useTabela('vw_residuo_lancamentos', {
    filtros: [...filtroUnidade, ['relatorio_data', 'gte', inicio], ['relatorio_data', 'lte', fim]],
    ativo,
  })
  const aval = useTabela('vw_relatorio_chao_setor_avaliacoes', {
    filtros: [...filtroUnidade, ['relatorio_data', 'gte', inicio], ['relatorio_data', 'lte', fim]],
    ativo,
  })
  const rel = useTabela('vw_relatorio_chao_resumo', {
    filtros: [...filtroUnidade, ['data', 'gte', inicio], ['data', 'lte', fim]],
    ativo,
  })
  return useMemo(
    () => ({ linhasAchatadas: achatarLancamentos(lanc.data), avaliacoes: aval.data || [], relatorios: rel.data || [] }),
    [lanc.data, aval.data, rel.data]
  )
}

const INDICADORES_META = [
  { valor: 'max_residuo_material', label: 'Máximo de resíduo por material' },
  { valor: 'max_residuo_setor', label: 'Máximo de resíduo por setor' },
  { valor: 'max_descarte', label: 'Máximo de descarte' },
  { valor: 'max_ocorrencias_quadrante', label: 'Máximo de ocorrências por quadrante' },
  { valor: 'min_destinacao_util', label: 'Mínimo de destinação útil' },
  { valor: 'min_reaproveitamento_concluido', label: 'Mínimo de reaproveitamento concluído' },
  { valor: 'min_nota_limpeza', label: 'Mínimo de nota média de limpeza' },
  { valor: 'nenhum_setor_nota_1', label: 'Nenhum setor com nota 1' },
  { valor: 'pct_min_setores_inspecionados', label: '% mínimo de setores inspecionados' },
  { valor: 'pct_min_relatorios_no_prazo', label: '% mínimo de relatórios concluídos no prazo' },
  { valor: 'max_kg_por_100_colchoes', label: 'Máximo de kg de resíduo por 100 colchões' },
  { valor: 'max_indice_perda', label: 'Máximo de índice de perda' },
  { valor: 'reducao_percentual', label: 'Redução percentual vs. período-base' },
]

const SITUACAO_META = {
  dentro: { label: 'Dentro da meta', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200', icone: CheckCircle2 },
  atencao: { label: 'Atenção', cor: 'bg-amber-100 text-amber-700 ring-amber-200', icone: AlertTriangle },
  fora: { label: 'Fora da meta', cor: 'bg-red-100 text-red-700 ring-red-200', icone: AlertTriangle },
  sem_dado: { label: 'Sem dado no período', cor: 'bg-slate-100 text-slate-500 ring-slate-200', icone: MinusCircle },
}

function PainelMetas({ ehGestor, materiais, setores, unidadeAtual }) {
  const avisar = useAviso()
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState({
    nome: '', indicador: 'max_residuo_material', material_id: '', setor_id: '', quadrante: '',
    valor_alvo: '', periodicidade: 'mensal',
  })

  const metas = useTabela('metas_chao', { ordem: { coluna: 'criado_em', asc: false } })
  const criar = useInserir('metas_chao')
  const invalidar = useInvalidar()

  const periodicidadesUsadas = useMemo(
    () => new Set((metas.data || []).map((m) => m.periodicidade)),
    [metas.data]
  )
  const dadosDiaria = useDadosPeriodo('hoje', periodicidadesUsadas.has('diaria'), unidadeAtual)
  const dadosSemanal = useDadosPeriodo('semana', periodicidadesUsadas.has('semanal'), unidadeAtual)
  const dadosMensal = useDadosPeriodo('mes', periodicidadesUsadas.has('mensal'), unidadeAtual)
  const dadosAnual = useDadosPeriodo('ano', periodicidadesUsadas.has('anual'), unidadeAtual)
  const dadosPorPeriodicidade = {
    diaria: dadosDiaria, semanal: dadosSemanal, mensal: dadosMensal, anual: dadosAnual,
  }

  const salvar = async () => {
    setErro(null)
    if (!form.nome.trim() || !(Number(form.valor_alvo) > 0)) {
      setErro(new Error('Dê um nome e um valor-alvo maior que zero.'))
      return
    }
    try {
      await criar.mutateAsync({
        nome: form.nome.trim(),
        indicador: form.indicador,
        material_id: form.material_id || null,
        setor_id: form.setor_id || null,
        quadrante: form.quadrante.trim() || null,
        valor_alvo: Number(form.valor_alvo),
        periodicidade: form.periodicidade,
      })
      setCriando(false)
      setForm({ nome: '', indicador: 'max_residuo_material', material_id: '', setor_id: '', quadrante: '', valor_alvo: '', periodicidade: 'mensal' })
      avisar('Meta criada.')
      invalidar('metas_chao')
    } catch (e) {
      setErro(e)
    }
  }

  return (
    <div className="space-y-4">
      <Cartao>
        <CartaoTitulo
          acao={ehGestor && (
            <Botao tamanho="sm" onClick={() => setCriando(true)}>
              <Plus size={14} /> Nova meta
            </Botao>
          )}
        >
          Metas de redução e melhoria
        </CartaoTitulo>
        {(metas.data || []).length === 0 ? (
          <Vazio
            icone={Target}
            titulo="Nenhuma meta cadastrada"
            descricao="Recomendado esperar ter uma linha de base de relatórios antes de criar metas."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {metas.data.map((m) => {
              const dados = dadosPorPeriodicidade[m.periodicidade] || { linhasAchatadas: [], avaliacoes: [], relatorios: [] }
              const realizado = calcularRealizadoMeta(m, dados)
              const situacao = situacaoMeta(realizado, m)
              const Icone = SITUACAO_META[situacao].icone
              return (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{m.nome}</p>
                      <p className="text-xs text-slate-400">
                        {INDICADORES_META.find((i) => i.valor === m.indicador)?.label || m.indicador} · alvo {numero(m.valor_alvo, 2)} {realizado.unidade} · {m.periodicidade}
                      </p>
                    </div>
                    <Etiqueta cor={SITUACAO_META[situacao].cor}>
                      <span className="inline-flex items-center gap-1"><Icone size={11} /> {SITUACAO_META[situacao].label}</span>
                    </Etiqueta>
                  </div>
                  {!m.ativo && <p className="mt-1 text-xs text-slate-400">Meta inativa.</p>}
                  {realizado.semDados ? (
                    <p className="mt-1.5 text-xs text-slate-400">
                      Ainda sem dado suficiente pra calcular esse indicador (falta registro de produção do período).
                    </p>
                  ) : realizado.valor != null ? (
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Realizado: {numero(realizado.valor, 1)} {realizado.unidade}</span>
                        <span>Alvo: {realizado.sentido === 'max' ? '≤' : '≥'} {numero(realizado.alvoForcado ?? m.valor_alvo, 1)} {realizado.unidade}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                        <div
                          className={`h-1.5 rounded-full ${situacao === 'dentro' ? 'bg-emerald-500' : situacao === 'atencao' ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{
                            width: `${Math.min(100, Math.max(4, (realizado.valor / Math.max(realizado.alvoForcado ?? Number(m.valor_alvo), 0.0001)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs text-slate-400">Nenhum lançamento no período pra calcular.</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>

      <Modal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Nova meta"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setCriando(false)}>Cancelar</Botao>
            <Botao onClick={salvar} carregando={criar.isPending}>Criar meta</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Nome da meta">
            <Entrada value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Reduzir descarte de espuma" />
          </Campo>
          <Campo rotulo="Indicador">
            <Selecao value={form.indicador} onChange={(e) => setForm((f) => ({ ...f, indicador: e.target.value }))}>
              {INDICADORES_META.map((i) => (
                <option key={i.valor} value={i.valor}>{i.label}</option>
              ))}
            </Selecao>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Material" dica="Opcional — vazio vale pra todos">
              <Selecao value={form.material_id} onChange={(e) => setForm((f) => ({ ...f, material_id: e.target.value }))}>
                <option value="">Todos</option>
                {(materiais.data || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Setor" dica="Opcional — vazio vale pra todos">
              <Selecao value={form.setor_id} onChange={(e) => setForm((f) => ({ ...f, setor_id: e.target.value }))}>
                <option value="">Todos</option>
                {(setores.data || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </Selecao>
            </Campo>
          </div>
          <Campo rotulo="Quadrante" dica='Opcional — ex.: "7C", vazio vale pra todos'>
            <Entrada value={form.quadrante} onChange={(e) => setForm((f) => ({ ...f, quadrante: e.target.value }))} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor-alvo">
              <Entrada type="number" step="0.01" value={form.valor_alvo} onChange={(e) => setForm((f) => ({ ...f, valor_alvo: e.target.value }))} />
            </Campo>
            <Campo rotulo="Periodicidade">
              <Selecao value={form.periodicidade} onChange={(e) => setForm((f) => ({ ...f, periodicidade: e.target.value }))}>
                <option value="diaria">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </Selecao>
            </Campo>
          </div>
          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
