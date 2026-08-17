import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, ClipboardList } from 'lucide-react'
import { useTabela, useTecnicos, useUnidades, useInserir, useInvalidar } from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import { moeda, data, duracao } from '../lib/format'
import { M_STATUS_OS, M_PRIORIDADE, STATUS_OS, TIPOS_OS, PRIORIDADES } from '../lib/constants'
import {
  Botao, Cartao, Etiqueta, Carregando, Vazio, Tabela, Th, Td, Entrada, Selecao,
  Modal, Campo, Area, Erro, useAviso,
} from '../components/ui'

export default function OrdensServico() {
  const { ehGestor } = useAuth()
  const avisar = useAviso()
  const invalidar = useInvalidar()

  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('abertas')
  const [tipo, setTipo] = useState('')
  const [unidade, setUnidade] = useState('')
  const [nova, setNova] = useState(false)
  const [erro, setErro] = useState(null)

  const [form, setForm] = useState({
    ativo_id: '', titulo: '', descricao: '', tipo: 'corretiva',
    prioridade: 'media', responsavel_id: '',
  })

  const unidades = useUnidades()
  const tecnicos = useTecnicos()
  const ativos = useTabela('ativos', {
    select: 'id, codigo, nome, unidade_id',
    filtros: [['ativo', 'eq', true]],
    ordem: { coluna: 'nome' },
  })

  const filtroStatus =
    status === 'abertas'
      ? [['status', 'in', ['aberta', 'aprovada', 'em_execucao', 'pausada']]]
      : status === 'todas'
        ? []
        : [['status', 'eq', status]]

  const ordens = useTabela('ordens_servico', {
    select: `id, numero, titulo, tipo, status, prioridade, aberta_em, concluida_em,
             custo_total, tempo_parada_min,
             ativo:ativos(id, codigo, nome, unidade_id, unidade:unidades(nome), setor:setores(nome)),
             responsavel:responsavel_id(nome)`,
    filtros: [...filtroStatus, ...(tipo ? [['tipo', 'eq', tipo]] : [])],
    ordem: { coluna: 'aberta_em', asc: false },
  })

  const criar = useInserir('ordens_servico', ['vw_kpi_backlog_os'])

  const lista = useMemo(() => {
    let l = ordens.data || []
    if (unidade) l = l.filter((o) => o.ativo?.unidade_id === unidade)
    const termo = busca.trim().toLowerCase()
    if (termo) {
      l = l.filter((o) =>
        [o.numero, o.titulo, o.ativo?.nome, o.ativo?.codigo]
          .filter(Boolean)
          .some((c) => c.toLowerCase().includes(termo))
      )
    }
    return l
  }, [ordens.data, busca, unidade])

  const abrirNova = () => {
    setErro(null)
    setForm({
      ativo_id: '', titulo: '', descricao: '', tipo: 'corretiva',
      prioridade: 'media', responsavel_id: '',
    })
    setNova(true)
  }

  const salvarNova = async () => {
    setErro(null)
    try {
      const os = await criar.mutateAsync({
        ativo_id: form.ativo_id,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        tipo: form.tipo,
        prioridade: form.prioridade,
        responsavel_id: form.responsavel_id || null,
      })
      setNova(false)
      invalidar('ordens_servico')
      avisar(`OS ${os.numero} aberta.`)
    } catch (e) {
      setErro(e)
    }
  }

  const totalAberto = lista.reduce((s, o) => s + Number(o.custo_total || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Ordens de Serviço</h1>
          <p className="text-sm text-slate-500">
            {lista.length} {lista.length === 1 ? 'OS' : 'OS'} · {moeda(totalAberto)} em custo
          </p>
        </div>
        {ehGestor && (
          <Botao onClick={abrirNova}>
            <Plus size={15} /> Nova OS
          </Botao>
        )}
      </div>

      <Cartao className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search size={15} className="absolute top-2.5 left-3 text-slate-400" />
            <Entrada
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nº da OS, título, máquina…"
              className="pl-9"
            />
          </div>
          <Selecao value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="abertas">Em aberto</option>
            <option value="todas">Todas</option>
            {STATUS_OS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </Selecao>
          <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {TIPOS_OS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </Selecao>
          <Selecao value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            <option value="">Todas as unidades</option>
            {(unidades.data || []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Selecao>
        </div>
      </Cartao>

      <Cartao>
        {ordens.isLoading ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio
            icone={ClipboardList}
            titulo="Nenhuma OS encontrada"
            descricao="Ajuste os filtros ou converta uma solicitação da fila."
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>OS</Th>
                <Th>Ativo</Th>
                <Th>Status</Th>
                <Th>Prioridade</Th>
                <Th>Responsável</Th>
                <Th>Aberta</Th>
                <Th>Parada</Th>
                <Th className="text-right">Custo</Th>
              </tr>
            </thead>
            <tbody>
              {lista.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      to={`/os/${o.id}`}
                      className="font-mono text-xs font-medium text-sky-600 hover:underline"
                    >
                      {o.numero}
                    </Link>
                    <p className="max-w-56 truncate text-xs text-slate-500">{o.titulo}</p>
                  </Td>
                  <Td>
                    <p className="max-w-48 truncate text-slate-700">{o.ativo?.nome}</p>
                    <p className="text-xs text-slate-400">
                      {o.ativo?.setor?.nome || o.ativo?.unidade?.nome}
                    </p>
                  </Td>
                  <Td>
                    <Etiqueta cor={M_STATUS_OS[o.status]?.cor}>
                      {M_STATUS_OS[o.status]?.label}
                    </Etiqueta>
                  </Td>
                  <Td>
                    <Etiqueta cor={M_PRIORIDADE[o.prioridade]?.cor}>
                      {M_PRIORIDADE[o.prioridade]?.label}
                    </Etiqueta>
                  </Td>
                  <Td className="text-slate-600">{o.responsavel?.nome || '—'}</Td>
                  <Td className="text-slate-600">{data(o.aberta_em)}</Td>
                  <Td className="text-slate-600">
                    {o.tempo_parada_min ? duracao(o.tempo_parada_min) : '—'}
                  </Td>
                  <Td className="text-right font-medium">{moeda(o.custo_total)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>

      <Modal
        aberto={nova}
        aoFechar={() => setNova(false)}
        titulo="Nova Ordem de Serviço"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setNova(false)}>
              Cancelar
            </Botao>
            <Botao
              onClick={salvarNova}
              carregando={criar.isPending}
              disabled={!form.ativo_id || !form.titulo.trim()}
            >
              Abrir OS
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Ativo *">
            <Selecao
              value={form.ativo_id}
              onChange={(e) => setForm((f) => ({ ...f, ativo_id: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {(ativos.data || []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo} · {a.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Título *">
            <Entrada
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex.: Troca de rolamento do eixo principal"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Tipo">
              <Selecao
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              >
                {TIPOS_OS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Prioridade">
              <Selecao
                value={form.prioridade}
                onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.label}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>

          <Campo rotulo="Responsável">
            <Selecao
              value={form.responsavel_id}
              onChange={(e) => setForm((f) => ({ ...f, responsavel_id: e.target.value }))}
            >
              <option value="">— definir depois —</option>
              {(tecnicos.data || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Descrição">
            <Area
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </Campo>

          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
