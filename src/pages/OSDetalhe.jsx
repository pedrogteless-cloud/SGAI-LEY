import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Check, Play, Pause, CircleCheck, ThumbsUp, Package, Wrench, Clock,
} from 'lucide-react'
import {
  useRegistro, useTabela, useInserir, useAtualizar, useRemover, useRpc,
  useInvalidar, usePecas, useFornecedores, useTecnicos,
} from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import { moeda, dataHora, duracao, numero } from '../lib/format'
import { M_STATUS_OS, M_PRIORIDADE, M_TIPO_OS, TIPOS_SERVICO } from '../lib/constants'
import {
  Botao, Cartao, CartaoTitulo, Campo, Entrada, Area, Selecao, Etiqueta, Carregando,
  Vazio, Modal, Tabela, Th, Td, Erro, useAviso,
} from '../components/ui'

const INVALIDAR = [
  'ordens_servico', 'estoque', 'estoque_movimentos', 'vw_kpi_custo_por_ativo',
  'vw_kpi_backlog_os', 'vw_kpi_estoque_baixo',
]

export default function OSDetalhe() {
  const { id } = useParams()
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const { ehGestor, perfil } = useAuth()

  const [modal, setModal] = useState(null) // 'peca' | 'servico' | 'mao_obra' | 'tarefa'
  const [erro, setErro] = useState(null)
  const [formPeca, setFormPeca] = useState({ peca_id: '', quantidade: '1', observacao: '' })
  const [formServico, setFormServico] = useState({
    fornecedor_id: '', tipo_servico: 'torno', descricao: '', valor: '', nota_fiscal: '',
  })
  const [formMO, setFormMO] = useState({ tecnico_id: '', horas: '', custo_hora: '' })
  const [formTarefa, setFormTarefa] = useState('')

  const os = useRegistro(
    'ordens_servico',
    id,
    `*, ativo:ativos(id, codigo, nome, criticidade, unidade_id,
       setor:setores(nome), unidade:unidades(nome)),
     responsavel:responsavel_id(id, nome), aprovador:aprovada_por(nome),
     solicitacao:solicitacoes_servico(numero, descricao, solicitante_nome)`
  )
  const tarefas = useTabela('os_tarefas', {
    filtros: [['os_id', 'eq', id]],
    ordem: { coluna: 'ordem' },
  })
  const pecasOS = useTabela('os_pecas', {
    select: '*, peca:pecas(codigo, nome, unidade_medida)',
    filtros: [['os_id', 'eq', id]],
    ordem: { coluna: 'criado_em' },
  })
  const servicos = useTabela('os_servicos_externos', {
    select: '*, fornecedor:fornecedores(nome)',
    filtros: [['os_id', 'eq', id]],
    ordem: { coluna: 'criado_em' },
  })
  const maoObra = useTabela('os_mao_de_obra', {
    select: '*, tecnico:tecnico_id(nome)',
    filtros: [['os_id', 'eq', id]],
    ordem: { coluna: 'criado_em' },
  })
  const historico = useTabela('os_historico', {
    select: '*, autor:autor_id(nome)',
    filtros: [['os_id', 'eq', id]],
    ordem: { coluna: 'criado_em' },
  })

  const pecas = usePecas()
  const fornecedores = useFornecedores()
  const tecnicos = useTecnicos()

  const inserirPeca = useInserir('os_pecas', INVALIDAR)
  const inserirServico = useInserir('os_servicos_externos', INVALIDAR)
  const inserirMO = useInserir('os_mao_de_obra', INVALIDAR)
  const inserirTarefa = useInserir('os_tarefas', ['ordens_servico'])
  const removerPeca = useRemover('os_pecas', INVALIDAR)
  const removerServico = useRemover('os_servicos_externos', INVALIDAR)
  const removerMO = useRemover('os_mao_de_obra', INVALIDAR)
  const atualizarTarefa = useAtualizar('os_tarefas')
  const atualizarOS = useAtualizar('ordens_servico', INVALIDAR)
  const aprovar = useRpc('aprovar_os', INVALIDAR)

  const o = os.data

  if (os.isLoading) return <Carregando />
  if (os.error || !o) return <Erro erro={os.error || new Error('Serviço não encontrado.')} />

  const mudarStatus = async (novo) => {
    setErro(null)
    try {
      await atualizarOS.mutateAsync({ id, status: novo })
      invalidar('ordens_servico', 'os_historico')
      avisar('Pronto, atualizei.')
    } catch (e) {
      setErro(e)
    }
  }

  const aprovarOS = async () => {
    setErro(null)
    try {
      await aprovar.mutateAsync({ p_os: id })
      invalidar('ordens_servico', 'os_historico')
      avisar('Gasto liberado.')
    } catch (e) {
      setErro(e)
    }
  }

  const salvarPeca = async () => {
    setErro(null)
    try {
      await inserirPeca.mutateAsync({
        os_id: id,
        peca_id: formPeca.peca_id,
        quantidade: Number(formPeca.quantidade),
        observacao: formPeca.observacao.trim() || null,
        registrado_por: perfil?.id ?? null,
      })
      setModal(null)
      setFormPeca({ peca_id: '', quantidade: '1', observacao: '' })
      avisar('Peça lançada e tirada do estoque.')
    } catch (e) {
      setErro(e)
    }
  }

  const salvarServico = async () => {
    setErro(null)
    try {
      await inserirServico.mutateAsync({
        os_id: id,
        fornecedor_id: formServico.fornecedor_id || null,
        tipo_servico: formServico.tipo_servico,
        descricao: formServico.descricao.trim() || null,
        valor: Number(formServico.valor),
        nota_fiscal: formServico.nota_fiscal.trim() || null,
        registrado_por: perfil?.id ?? null,
      })
      setModal(null)
      setFormServico({
        fornecedor_id: '', tipo_servico: 'torno', descricao: '', valor: '', nota_fiscal: '',
      })
      avisar('Serviço de fora lançado.')
    } catch (e) {
      setErro(e)
    }
  }

  const salvarMO = async () => {
    setErro(null)
    try {
      const tec = (tecnicos.data || []).find((t) => t.id === formMO.tecnico_id)
      await inserirMO.mutateAsync({
        os_id: id,
        tecnico_id: formMO.tecnico_id || null,
        tecnico_nome: tec?.nome ?? null,
        horas: Number(formMO.horas),
        custo_hora: Number(formMO.custo_hora || tec?.custo_hora || 0),
      })
      setModal(null)
      setFormMO({ tecnico_id: '', horas: '', custo_hora: '' })
      avisar('Hora lançada.')
    } catch (e) {
      setErro(e)
    }
  }

  const salvarTarefa = async () => {
    setErro(null)
    try {
      await inserirTarefa.mutateAsync({
        os_id: id,
        descricao: formTarefa.trim(),
        ordem: (tarefas.data?.length || 0) + 1,
      })
      setModal(null)
      setFormTarefa('')
    } catch (e) {
      setErro(e)
    }
  }

  const alternarTarefa = async (t) => {
    await atualizarTarefa.mutateAsync({
      id: t.id,
      concluida: !t.concluida,
      concluida_em: !t.concluida ? new Date().toISOString() : null,
      concluida_por: !t.concluida ? (perfil?.id ?? null) : null,
    })
    invalidar('os_tarefas')
  }

  const pecaSelecionada = (pecas.data || []).find((p) => p.id === formPeca.peca_id)
  const tarefasFeitas = (tarefas.data || []).filter((t) => t.concluida).length
  const totalTarefas = tarefas.data?.length || 0

  const acoes = []
  if (ehGestor && ['aberta', 'pausada'].includes(o.status))
    acoes.push(
      <Botao key="ap" variante="sucesso" onClick={aprovarOS} carregando={aprovar.isPending}>
        <ThumbsUp size={15} /> Liberar o gasto
      </Botao>
    )
  if (['aprovada', 'pausada'].includes(o.status))
    acoes.push(
      <Botao key="ex" onClick={() => mudarStatus('em_execucao')}>
        <Play size={15} /> Começar
      </Botao>
    )
  if (o.status === 'em_execucao') {
    acoes.push(
      <Botao key="pa" variante="secundario" onClick={() => mudarStatus('pausada')}>
        <Pause size={15} /> Parar no meio
      </Botao>,
      <Botao key="co" variante="sucesso" onClick={() => mudarStatus('concluida')}>
        <CircleCheck size={15} /> Terminei
      </Botao>
    )
  }
  if (ehGestor && !['concluida', 'cancelada'].includes(o.status))
    acoes.push(
      <Botao key="ca" variante="secundario" onClick={() => mudarStatus('cancelada')}>
        Cancelar serviço
      </Botao>
    )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/os">
            <Botao variante="fantasma" tamanho="sm">
              <ArrowLeft size={16} />
            </Botao>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-500">{o.numero}</span>
              <Etiqueta cor={M_STATUS_OS[o.status]?.cor}>{M_STATUS_OS[o.status]?.label}</Etiqueta>
              <Etiqueta cor={M_PRIORIDADE[o.prioridade]?.cor}>
                {M_PRIORIDADE[o.prioridade]?.label}
              </Etiqueta>
              <Etiqueta>{M_TIPO_OS[o.tipo]?.label}</Etiqueta>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{o.titulo}</h1>
            <p className="text-sm text-slate-500">
              <Link to={`/ativos/${o.ativo?.id}`} className="text-sky-600 hover:underline">
                {o.ativo?.nome}
              </Link>
              {' · '}
              {o.ativo?.setor?.nome || o.ativo?.unidade?.nome}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">{acoes}</div>
      </div>

      <Erro erro={erro} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Peças</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{moeda(o.custo_pecas)}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Serviço de fora</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{moeda(o.custo_servicos)}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Horas da equipe</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{moeda(o.custo_mao_obra)}</p>
        </Cartao>
        <Cartao className="border-sky-200 bg-sky-50 p-4">
          <p className="text-xs text-sky-700">Gasto total</p>
          <p className="mt-1 text-lg font-bold text-sky-900">{moeda(o.custo_total)}</p>
          {o.orcamento_previsto != null && (
            <p className="mt-0.5 text-xs text-sky-600">
              estava previsto {moeda(o.orcamento_previsto)}
            </p>
          )}
        </Cartao>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao>
            <CartaoTitulo
              acao={
                <Botao tamanho="sm" variante="secundario" onClick={() => setModal('tarefa')}>
                  <Plus size={14} /> Passo
                </Botao>
              }
            >
              Passo a passo {totalTarefas > 0 && `(${tarefasFeitas}/${totalTarefas})`}
            </CartaoTitulo>
            {totalTarefas === 0 ? (
              <Vazio titulo="Sem passos anotados" descricao="Anote passo a passo pra não esquecer nada." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {tarefas.data.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-2.5">
                    <button
                      onClick={() => alternarTarefa(t)}
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition ${
                        t.concluida
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 hover:border-emerald-500'
                      }`}
                      aria-label={t.concluida ? 'Desmarcar' : 'Marcar como feita'}
                    >
                      {t.concluida && <Check size={13} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${
                          t.concluida ? 'text-slate-400 line-through' : 'text-slate-700'
                        }`}
                      >
                        {t.descricao}
                      </p>
                      {t.observacao && <p className="text-xs text-slate-400">{t.observacao}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao>
            <CartaoTitulo
              acao={
                <Botao tamanho="sm" variante="secundario" onClick={() => setModal('peca')}>
                  <Plus size={14} /> Peça
                </Botao>
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <Package size={14} className="text-slate-400" /> Peças usadas
              </span>
            </CartaoTitulo>
            {(pecasOS.data || []).length === 0 ? (
              <Vazio titulo="Nenhuma peça usada" descricao="Ao lançar aqui, sai do estoque sozinho." />
            ) : (
              <Tabela>
                <thead>
                  <tr>
                    <Th>Peça</Th>
                    <Th className="text-right">Qtd</Th>
                    <Th className="text-right">Preço da un.</Th>
                    <Th className="text-right">Total</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {pecasOS.data.map((p) => (
                    <tr key={p.id}>
                      <Td>
                        <p className="text-slate-700">{p.peca?.nome}</p>
                        <p className="font-mono text-xs text-slate-400">{p.peca?.codigo}</p>
                      </Td>
                      <Td className="text-right">
                        {numero(p.quantidade, 2)} {p.peca?.unidade_medida}
                      </Td>
                      <Td className="text-right text-slate-600">{moeda(p.custo_unitario)}</Td>
                      <Td className="text-right font-medium">{moeda(p.custo_total)}</Td>
                      <Td className="text-right">
                        <button
                          onClick={() => removerPeca.mutate(p.id)}
                          className="text-slate-300 hover:text-red-600"
                          aria-label="Remover"
                        >
                          <Trash2 size={15} />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </Cartao>

          <Cartao>
            <CartaoTitulo
              acao={
                <Botao tamanho="sm" variante="secundario" onClick={() => setModal('servico')}>
                  <Plus size={14} /> Serviço
                </Botao>
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <Wrench size={14} className="text-slate-400" /> Serviço de fora
              </span>
            </CartaoTitulo>
            {(servicos.data || []).length === 0 ? (
              <Vazio titulo="Nada mandado pra fora" descricao="Torno, retífica, solda, rebobinamento, laudo…" />
            ) : (
              <Tabela>
                <thead>
                  <tr>
                    <Th>Serviço</Th>
                    <Th>Fornecedor</Th>
                    <Th>NF</Th>
                    <Th className="text-right">Valor</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {servicos.data.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        <p className="text-slate-700 capitalize">{s.tipo_servico}</p>
                        {s.descricao && (
                          <p className="max-w-56 truncate text-xs text-slate-400">{s.descricao}</p>
                        )}
                      </Td>
                      <Td className="text-slate-600">{s.fornecedor?.nome || '—'}</Td>
                      <Td className="font-mono text-xs text-slate-500">{s.nota_fiscal || '—'}</Td>
                      <Td className="text-right font-medium">{moeda(s.valor)}</Td>
                      <Td className="text-right">
                        <button
                          onClick={() => removerServico.mutate(s.id)}
                          className="text-slate-300 hover:text-red-600"
                          aria-label="Remover"
                        >
                          <Trash2 size={15} />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </Cartao>

          <Cartao>
            <CartaoTitulo
              acao={
                <Botao tamanho="sm" variante="secundario" onClick={() => setModal('mao_obra')}>
                  <Plus size={14} /> Hora
                </Botao>
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" /> Horas da equipe
              </span>
            </CartaoTitulo>
            {(maoObra.data || []).length === 0 ? (
              <Vazio titulo="Nenhuma hora lançada" descricao="Anote quem mexeu e quanto tempo levou." />
            ) : (
              <Tabela>
                <thead>
                  <tr>
                    <Th>Quem fez</Th>
                    <Th className="text-right">Horas</Th>
                    <Th className="text-right">R$/h</Th>
                    <Th className="text-right">Total</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {maoObra.data.map((m) => (
                    <tr key={m.id}>
                      <Td className="text-slate-700">{m.tecnico?.nome || m.tecnico_nome || '—'}</Td>
                      <Td className="text-right">{numero(m.horas, 2)}</Td>
                      <Td className="text-right text-slate-600">{moeda(m.custo_hora)}</Td>
                      <Td className="text-right font-medium">{moeda(m.custo_total)}</Td>
                      <Td className="text-right">
                        <button
                          onClick={() => removerMO.mutate(m.id)}
                          className="text-slate-300 hover:text-red-600"
                          aria-label="Remover"
                        >
                          <Trash2 size={15} />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </Cartao>
        </div>

        <div className="space-y-4">
          <Cartao>
            <CartaoTitulo>Dados do serviço</CartaoTitulo>
            <dl className="space-y-2 px-4 py-3 text-sm">
              {[
                ['Quem faz', o.responsavel?.nome],
                ['Aberto em', dataHora(o.aberta_em)],
                ['Liberado em', o.aprovada_em ? dataHora(o.aprovada_em) : null],
                ['Liberado por', o.aprovador?.nome],
                ['Começou em', o.iniciada_em ? dataHora(o.iniciada_em) : null],
                ['Terminou em', o.concluida_em ? dataHora(o.concluida_em) : null],
                ['Máquina ficou parada', o.tempo_parada_min ? duracao(o.tempo_parada_min) : null],
              ]
                .filter(([, v]) => v)
                .map(([r, v]) => (
                  <div key={r} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{r}</dt>
                    <dd className="text-right font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
            </dl>
            {o.descricao && (
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="mb-1 text-xs font-medium text-slate-500">Detalhes</p>
                <p className="text-sm text-slate-700">{o.descricao}</p>
              </div>
            )}
            {o.solicitacao && (
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="mb-1 text-xs font-medium text-slate-500">
                  Veio do aviso {o.solicitacao.numero}
                </p>
                <p className="text-sm text-slate-700">{o.solicitacao.descricao}</p>
                {o.solicitacao.solicitante_nome && (
                  <p className="mt-1 text-xs text-slate-400">
                    avisado por {o.solicitacao.solicitante_nome}
                  </p>
                )}
              </div>
            )}
          </Cartao>

          <Cartao>
            <CartaoTitulo>O que aconteceu</CartaoTitulo>
            <ul className="space-y-3 px-4 py-3">
              {(historico.data || []).map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <div className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />
                  <div>
                    <p className="text-slate-700">
                      {h.status_de
                        ? `${M_STATUS_OS[h.status_de]?.label} → ${M_STATUS_OS[h.status_para]?.label}`
                        : `Serviço aberto`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {dataHora(h.criado_em)}
                      {h.autor?.nome ? ` · ${h.autor.nome}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Cartao>
        </div>
      </div>

      {/* -------------------------------------------------------- modais */}
      <Modal
        aberto={modal === 'peca'}
        aoFechar={() => setModal(null)}
        titulo="Lançar peça usada"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>
              Cancelar
            </Botao>
            <Botao
              onClick={salvarPeca}
              carregando={inserirPeca.isPending}
              disabled={!formPeca.peca_id || !(Number(formPeca.quantidade) > 0)}
            >
              Lançar e tirar do estoque
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Qual peça *">
            <Selecao
              value={formPeca.peca_id}
              onChange={(e) => setFormPeca((f) => ({ ...f, peca_id: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {(pecas.data || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo ? `${p.codigo} · ` : ''}
                  {p.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo
            rotulo="Quantidade *"
            dica={
              pecaSelecionada
                ? `O preço sai sozinho do custo médio do estoque (${pecaSelecionada.unidade_medida})`
                : undefined
            }
          >
            <Entrada
              type="number"
              step="0.001"
              min="0.001"
              value={formPeca.quantidade}
              onChange={(e) => setFormPeca((f) => ({ ...f, quantidade: e.target.value }))}
            />
          </Campo>
          <Campo rotulo="Observação">
            <Entrada
              value={formPeca.observacao}
              onChange={(e) => setFormPeca((f) => ({ ...f, observacao: e.target.value }))}
            />
          </Campo>
          <Erro erro={erro} />
        </div>
      </Modal>

      <Modal
        aberto={modal === 'servico'}
        aoFechar={() => setModal(null)}
        titulo="Lançar serviço de fora"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>
              Cancelar
            </Botao>
            <Botao
              onClick={salvarServico}
              carregando={inserirServico.isPending}
              disabled={!(Number(formServico.valor) >= 0) || formServico.valor === ''}
            >
              Lançar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Que serviço foi">
            <Selecao
              value={formServico.tipo_servico}
              onChange={(e) => setFormServico((f) => ({ ...f, tipo_servico: e.target.value }))}
            >
              {TIPOS_SERVICO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Fornecedor">
            <Selecao
              value={formServico.fornecedor_id}
              onChange={(e) => setFormServico((f) => ({ ...f, fornecedor_id: e.target.value }))}
            >
              <option value="">—</option>
              {(fornecedores.data || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Quanto pagou (R$) *">
            <Entrada
              type="number"
              step="0.01"
              min="0"
              value={formServico.valor}
              onChange={(e) => setFormServico((f) => ({ ...f, valor: e.target.value }))}
            />
          </Campo>
          <Campo rotulo="Nota fiscal">
            <Entrada
              value={formServico.nota_fiscal}
              onChange={(e) => setFormServico((f) => ({ ...f, nota_fiscal: e.target.value }))}
            />
          </Campo>
          <Campo rotulo="Descrição">
            <Area
              rows={2}
              value={formServico.descricao}
              onChange={(e) => setFormServico((f) => ({ ...f, descricao: e.target.value }))}
            />
          </Campo>
          <Erro erro={erro} />
        </div>
      </Modal>

      <Modal
        aberto={modal === 'mao_obra'}
        aoFechar={() => setModal(null)}
        titulo="Lançar horas da equipe"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>
              Cancelar
            </Botao>
            <Botao
              onClick={salvarMO}
              carregando={inserirMO.isPending}
              disabled={!(Number(formMO.horas) > 0)}
            >
              Lançar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Quem fez">
            <Selecao
              value={formMO.tecnico_id}
              onChange={(e) => {
                const tec = (tecnicos.data || []).find((t) => t.id === e.target.value)
                setFormMO((f) => ({
                  ...f,
                  tecnico_id: e.target.value,
                  custo_hora: f.custo_hora || (tec?.custo_hora ?? ''),
                }))
              }}
            >
              <option value="">—</option>
              {(tecnicos.data || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Quantas horas *">
              <Entrada
                type="number"
                step="0.25"
                min="0.25"
                value={formMO.horas}
                onChange={(e) => setFormMO((f) => ({ ...f, horas: e.target.value }))}
              />
            </Campo>
            <Campo rotulo="Valor da hora (R$)">
              <Entrada
                type="number"
                step="0.01"
                min="0"
                value={formMO.custo_hora}
                onChange={(e) => setFormMO((f) => ({ ...f, custo_hora: e.target.value }))}
              />
            </Campo>
          </div>
          <Erro erro={erro} />
        </div>
      </Modal>

      <Modal
        aberto={modal === 'tarefa'}
        aoFechar={() => setModal(null)}
        titulo="Novo passo"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>
              Cancelar
            </Botao>
            <Botao
              onClick={salvarTarefa}
              carregando={inserirTarefa.isPending}
              disabled={!formTarefa.trim()}
            >
              Adicionar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="O que precisa ser feito">
            <Entrada
              value={formTarefa}
              onChange={(e) => setFormTarefa(e.target.value)}
              autoFocus
              placeholder="Ex.: desmontar o cabeçote e medir a folga"
            />
          </Campo>
          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
