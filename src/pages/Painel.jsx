import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line,
} from 'recharts'
import {
  Wallet, ClipboardList, AlertTriangle, PackageX, TrendingUp, ArrowRight,
} from 'lucide-react'
import { useTabela } from '../hooks/useDados'
import { moeda, mesLabel, numero } from '../lib/format'
import { M_CRITICIDADE, M_PRIORIDADE } from '../lib/constants'
import { Cartao, CartaoTitulo, Etiqueta, Carregando, Vazio, Tabela, Th, Td } from '../components/ui'

function Indicador({ icone: Icone, rotulo, valor, detalhe, cor = 'text-sky-600', para }) {
  const conteudo = (
    <Cartao className="p-4 transition hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{rotulo}</p>
          <p className="mt-1 truncate text-2xl font-bold text-slate-900">{valor}</p>
          {detalhe && <p className="mt-0.5 text-xs text-slate-400">{detalhe}</p>}
        </div>
        <Icone size={20} className={`shrink-0 ${cor}`} />
      </div>
    </Cartao>
  )
  return para ? <Link to={para}>{conteudo}</Link> : conteudo
}

export default function Painel() {
  const unidades = useTabela('vw_kpi_comparativo_unidades')
  const mensal = useTabela('vw_kpi_custo_mensal', { ordem: { coluna: 'mes' } })
  const ranking = useTabela('vw_kpi_ranking_ativos', { ordem: { coluna: 'posicao' }, limite: 8 })
  const backlog = useTabela('vw_kpi_backlog_os', { ordem: { coluna: 'aberta_em' } })
  const estoqueBaixo = useTabela('vw_kpi_estoque_baixo')
  const solicitacoes = useTabela('solicitacoes_servico', {
    select: 'id',
    filtros: [['status', 'in', ['aberta', 'em_triagem']]],
  })

  if (unidades.isLoading) return <Carregando />

  const totais = (unidades.data || []).reduce(
    (acc, u) => ({
      custo12m: acc.custo12m + Number(u.custo_12m || 0),
      ativos: acc.ativos + Number(u.qtd_ativos || 0),
      osAbertas: acc.osAbertas + Number(u.os_abertas || 0),
      paradaHoras: acc.paradaHoras + Number(u.parada_horas || 0),
    }),
    { custo12m: 0, ativos: 0, osAbertas: 0, paradaHoras: 0 }
  )

  const atrasadas = (backlog.data || []).filter((o) => o.atrasada)

  // Agrupa o custo mensal somando todas as unidades, nos últimos 12 meses.
  const porMes = Object.values(
    (mensal.data || []).reduce((acc, l) => {
      acc[l.mes] ??= { mes: l.mes, custo: 0 }
      acc[l.mes].custo += Number(l.custo_total || 0)
      return acc
    }, {})
  ).slice(-12)

  const topRanking = (ranking.data || []).map((r) => ({
    nome: r.nome.length > 22 ? `${r.nome.slice(0, 22)}…` : r.nome,
    custo: Number(r.custo_12m || 0),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Painel</h1>
        <p className="text-sm text-slate-500">Visão geral do parque de máquinas</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          icone={Wallet}
          rotulo="Custo de manutenção (12 meses)"
          valor={moeda(totais.custo12m)}
          detalhe={`${totais.ativos} ativos cadastrados`}
        />
        <Indicador
          icone={ClipboardList}
          rotulo="OS em aberto"
          valor={totais.osAbertas}
          detalhe={`${solicitacoes.data?.length || 0} solicitações na fila`}
          cor="text-indigo-600"
          para="/os"
        />
        <Indicador
          icone={AlertTriangle}
          rotulo="OS atrasadas"
          valor={atrasadas.length}
          detalhe="acima do prazo da prioridade"
          cor="text-red-600"
          para="/os"
        />
        <Indicador
          icone={PackageX}
          rotulo="Peças abaixo do mínimo"
          valor={estoqueBaixo.data?.length || 0}
          detalhe={`${numero(totais.paradaHoras, 1)} h de parada no período`}
          cor="text-amber-600"
          para="/almoxarifado"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao>
          <CartaoTitulo>Custo por mês</CartaoTitulo>
          <div className="p-4">
            {porMes.length === 0 ? (
              <Vazio
                icone={TrendingUp}
                titulo="Ainda sem custo lançado"
                descricao="Os valores aparecem assim que a primeira OS for concluída."
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={porMes} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tickFormatter={mesLabel}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [moeda(v), 'Custo']}
                    labelFormatter={mesLabel}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="custo"
                    stroke="#0284c7"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Cartao>

        <Cartao>
          <CartaoTitulo
            acao={
              <Link to="/ativos" className="text-xs font-medium text-sky-600 hover:text-sky-700">
                ver ativos
              </Link>
            }
          >
            Máquinas mais caras (12 meses)
          </CartaoTitulo>
          <div className="p-4">
            {topRanking.length === 0 ? (
              <Vazio
                icone={TrendingUp}
                titulo="Sem ranking ainda"
                descricao="Assim que houver custo por máquina, o ranking aparece aqui."
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={topRanking}
                  layout="vertical"
                  margin={{ top: 5, right: 15, bottom: 5, left: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={130}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [moeda(v), 'Custo 12m']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="custo" fill="#0284c7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Cartao>
      </div>

      <Cartao>
        <CartaoTitulo
          acao={
            <Link
              to="/os"
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              todas as OS <ArrowRight size={13} />
            </Link>
          }
        >
          Backlog — OS em aberto
        </CartaoTitulo>
        {backlog.isLoading ? (
          <Carregando />
        ) : (backlog.data || []).length === 0 ? (
          <Vazio titulo="Nenhuma OS em aberto" descricao="Tudo em dia por aqui." />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>OS</Th>
                <Th>Ativo</Th>
                <Th>Prioridade</Th>
                <Th>Aberta há</Th>
                <Th className="text-right">Custo</Th>
              </tr>
            </thead>
            <tbody>
              {backlog.data.slice(0, 10).map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <Td>
                    <Link to={`/os/${o.id}`} className="font-medium text-sky-600 hover:text-sky-700">
                      {o.numero}
                    </Link>
                    <p className="max-w-xs truncate text-xs text-slate-400">{o.titulo}</p>
                  </Td>
                  <Td>
                    <span className="text-slate-700">{o.ativo_nome}</span>
                    <p className="text-xs text-slate-400">
                      {o.setor || o.unidade}
                      {o.criticidade && ` · criticidade ${o.criticidade}`}
                    </p>
                  </Td>
                  <Td>
                    <Etiqueta cor={M_PRIORIDADE[o.prioridade]?.cor}>
                      {M_PRIORIDADE[o.prioridade]?.label}
                    </Etiqueta>
                  </Td>
                  <Td>
                    <span className={o.atrasada ? 'font-medium text-red-600' : 'text-slate-600'}>
                      {o.dias_aberta} {o.dias_aberta === 1 ? 'dia' : 'dias'}
                    </span>
                  </Td>
                  <Td className="text-right font-medium">{moeda(o.custo_total)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>

      {(unidades.data || []).length > 1 && (
        <Cartao>
          <CartaoTitulo>Comparativo entre unidades</CartaoTitulo>
          <Tabela>
            <thead>
              <tr>
                <Th>Unidade</Th>
                <Th className="text-right">Ativos</Th>
                <Th className="text-right">Críticos A</Th>
                <Th className="text-right">OS abertas</Th>
                <Th className="text-right">Parada (h)</Th>
                <Th className="text-right">Custo 12m</Th>
              </tr>
            </thead>
            <tbody>
              {unidades.data.map((u) => (
                <tr key={u.unidade_id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{u.unidade}</Td>
                  <Td className="text-right">{u.qtd_ativos}</Td>
                  <Td className="text-right">
                    {u.ativos_criticos > 0 ? (
                      <Etiqueta cor={M_CRITICIDADE.A.cor}>{u.ativos_criticos}</Etiqueta>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="text-right">{u.os_abertas}</Td>
                  <Td className="text-right">{numero(u.parada_horas, 1)}</Td>
                  <Td className="text-right font-medium">{moeda(u.custo_12m)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </Cartao>
      )}
    </div>
  )
}
