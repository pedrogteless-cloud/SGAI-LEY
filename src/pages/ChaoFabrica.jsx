import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Recycle, ArrowRight, ClipboardList, Target, History, Settings2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  useTabela, useUnidades, useSetores, useTecnicos, useMateriaisResiduo, useInserir, useInvalidar,
} from '../hooks/useDados'
import { data as fmtData, dataHora, numero } from '../lib/format'
import { M_STATUS_CHAO, STATUS_RELATORIO_CHAO } from '../lib/constants'
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
  const historico = useTabela('vw_relatorio_chao_resumo', {
    filtros: [
      ...(unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : []),
      ...(filtroStatus ? [['status', 'eq', filtroStatus]] : []),
    ],
    ordem: { coluna: 'data', asc: false },
    limite: 60,
  })

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
          <Selecao value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-auto">
            <option value="">Todos os status</option>
            {STATUS_RELATORIO_CHAO.map((s) => (
              <option key={s.valor} value={s.valor}>{s.label}</option>
            ))}
          </Selecao>

          <Cartao>
            {historico.isLoading ? (
              <Carregando />
            ) : (historico.data || []).length === 0 ? (
              <Vazio icone={History} titulo="Nenhum relatório ainda" />
            ) : (
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
            )}
          </Cartao>
        </div>
      )}

      {aba === 'indicadores' && (
        <PainelIndicadores saldos={saldos} historico={historico} />
      )}

      {aba === 'metas' && <PainelMetas ehGestor={ehGestor} materiais={materiais} setores={setores} />}

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

function PainelIndicadores({ saldos, historico }) {
  const lista = saldos.data || []
  const relatorios = historico.data || []

  const concluidos = relatorios.filter((r) => r.status === 'concluida')
  const notaMedia = concluidos.length
    ? concluidos.reduce((acc, r) => acc + (Number(r.nota_media) || 0), 0) / concluidos.filter((r) => r.nota_media != null).length
    : null

  const topMaterial = [...lista].sort((a, b) => Number(b.gerado) - Number(a.gerado))[0]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Relatórios concluídos</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{concluidos.length}</p>
          <p className="mt-0.5 text-xs text-slate-400">de {relatorios.length} no total</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Nota média de limpeza</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{notaMedia ? numero(notaMedia, 1) : '—'}</p>
          <p className="mt-0.5 text-xs text-slate-400">só setores avaliados</p>
        </Cartao>
        <Cartao className="p-4 sm:col-span-2">
          <p className="text-xs text-slate-500">Material com maior geração (saldo)</p>
          <p className="mt-1 truncate text-lg font-bold text-slate-900">{topMaterial?.material_nome || '—'}</p>
          {topMaterial && (
            <p className="mt-0.5 text-xs text-slate-400">
              {numero(topMaterial.gerado, 1)} {topMaterial.unidade_medida} gerados
            </p>
          )}
        </Cartao>
      </div>

      <Cartao>
        <CartaoTitulo>Saldo por material</CartaoTitulo>
        {lista.length === 0 ? (
          <Vazio icone={Recycle} titulo="Ainda não há lançamento" descricao="Os saldos aparecem assim que o primeiro relatório for preenchido." />
        ) : (
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
        )}
      </Cartao>

      <p className="text-xs text-slate-400">
        Indicadores por período, quadrante e comparação com período anterior ficam pra próxima
        etapa — esta primeira versão mostra o saldo acumulado geral.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------- metas */

function PainelMetas({ ehGestor, materiais, setores }) {
  const avisar = useAviso()
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState({
    nome: '', indicador: 'max_residuo_material', material_id: '', setor_id: '',
    valor_alvo: '', periodicidade: 'mensal',
  })

  const metas = useTabela('metas_chao', { ordem: { coluna: 'criado_em', asc: false } })
  const criar = useInserir('metas_chao')
  const invalidar = useInvalidar()

  const indicadores = [
    { valor: 'max_residuo_material', label: 'Máximo de resíduo por material' },
    { valor: 'max_residuo_setor', label: 'Máximo de resíduo por setor' },
    { valor: 'max_descarte', label: 'Máximo de descarte' },
    { valor: 'min_destinacao_util', label: 'Mínimo de destinação útil' },
    { valor: 'min_reaproveitamento_concluido', label: 'Mínimo de reaproveitamento concluído' },
    { valor: 'min_nota_limpeza', label: 'Mínimo de nota média de limpeza' },
    { valor: 'pct_min_setores_inspecionados', label: '% mínimo de setores inspecionados' },
    { valor: 'pct_min_relatorios_no_prazo', label: '% mínimo de relatórios concluídos no prazo' },
  ]

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
        valor_alvo: Number(form.valor_alvo),
        periodicidade: form.periodicidade,
      })
      setCriando(false)
      setForm({ nome: '', indicador: 'max_residuo_material', material_id: '', setor_id: '', valor_alvo: '', periodicidade: 'mensal' })
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
            {metas.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{m.nome}</p>
                  <p className="text-xs text-slate-400">
                    {indicadores.find((i) => i.valor === m.indicador)?.label || m.indicador} · alvo {numero(m.valor_alvo, 2)} · {m.periodicidade}
                  </p>
                </div>
                <Etiqueta cor={m.ativo ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}>
                  {m.ativo ? 'Ativa' : 'Inativa'}
                </Etiqueta>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <p className="text-xs text-slate-400">
        O cálculo automático de "realizado x meta" ainda cobre só os indicadores mais simples e
        vai evoluir conforme o histórico crescer — por enquanto a meta fica cadastrada como
        referência.
      </p>

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
              {indicadores.map((i) => (
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
