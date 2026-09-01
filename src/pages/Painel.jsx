import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from 'recharts'
import {
  Wallet, ClipboardList, AlertTriangle, PackageX, TrendingUp, ArrowRight, Plus,
} from 'lucide-react'
import { useTabela } from '../hooks/useDados'
import { useTemaEscuro } from '../hooks/useTema'
import { moeda, mesLabel, numero } from '../lib/format'
import { M_CRITICIDADE, M_PRIORIDADE } from '../lib/constants'
import {
  Botao, Cartao, CartaoTitulo, Etiqueta, Carregando, Vazio, Tabela, Th, Td,
  EsqueletoIndicadores, NumeroAnimado,
} from '../components/ui'
import LancarGasto from '../components/LancarGasto'

/* Cada indicador tem um tom próprio, aplicado no quadradinho do ícone.
   É o que deixa a fileira de números legível de relance: a pessoa
   aprende a cor antes de ler o rótulo. */
const TONS = {
  sky: 'text-sky-600 bg-sky-50 ring-sky-100',
  indigo: 'text-indigo-600 bg-indigo-50 ring-indigo-100',
  red: 'text-red-600 bg-red-50 ring-red-100',
  amber: 'text-amber-600 bg-amber-50 ring-amber-100',
}

function Indicador({ icone: Icone, rotulo, valor, formatar, detalhe, tom = 'sky', para }) {
  const conteudo = (
    <Cartao flutua={Boolean(para)} className="group h-full p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{rotulo}</p>
          <p className="numero mt-1.5 truncate text-[1.75rem] leading-none font-bold tracking-tight text-slate-900">
            {typeof valor === 'number' ? (
              <NumeroAnimado valor={valor} formatar={formatar || Math.round} />
            ) : (
              valor
            )}
          </p>
          {detalhe && <p className="mt-2 truncate text-xs text-slate-400">{detalhe}</p>}
        </div>
        <div
          className={`shrink-0 rounded-xl p-2 ring-1 ring-inset transition-transform duration-300
            group-hover:scale-110 ${TONS[tom]}`}
          style={{ transitionTimingFunction: 'var(--ease-mola)' }}
        >
          <Icone size={18} strokeWidth={2} />
        </div>
      </div>
      {para && (
        <span
          className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-400
            transition-colors group-hover:text-sky-600"
        >
          ver detalhe
          <ArrowRight
            size={12}
            className="transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </span>
      )}
    </Cartao>
  )
  return para ? (
    <Link to={para} viewTransition className="block h-full">
      {conteudo}
    </Link>
  ) : (
    conteudo
  )
}

/** Cores dos gráficos seguem o tema — recharts não herda CSS sozinho. */
function useTemaGrafico() {
  const escuro = useTemaEscuro()
  return escuro
    ? { grade: '#25324a', eixo: '#74839a', rotulo: '#93a3b8', caixa: '#1a2536', traco: '#25324a', texto: '#e2e8f0' }
    : { grade: '#e8edf3', eixo: '#94a3b8', rotulo: '#64748b', caixa: '#ffffff', traco: '#e2e8f0', texto: '#0f172a' }
}

export default function Painel() {
  const [gasto, setGasto] = useState(false)
  const tema = useTemaGrafico()
  const unidades = useTabela('vw_kpi_comparativo_unidades')
  const mensal = useTabela('vw_kpi_custo_mensal', { ordem: { coluna: 'mes' } })
  const ranking = useTabela('vw_kpi_ranking_ativos', { ordem: { coluna: 'posicao' }, limite: 8 })
  const backlog = useTabela('vw_kpi_backlog_os', { ordem: { coluna: 'aberta_em' } })
  const estoqueBaixo = useTabela('vw_kpi_estoque_baixo')
  const solicitacoes = useTabela('solicitacoes_servico', {
    select: 'id',
    filtros: [['status', 'in', ['aberta', 'em_triagem']]],
  })

  if (unidades.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resumo</h1>
          <p className="mt-0.5 text-sm text-slate-500">Como está a manutenção hoje</p>
        </div>
        <EsqueletoIndicadores />
      </div>
    )
  }

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
    <div className="entra space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resumo</h1>
          <p className="mt-0.5 text-sm text-slate-500">Como está a manutenção hoje</p>
        </div>
        <Botao tamanho="lg" onClick={() => setGasto(true)}>
          <Plus size={16} /> Lançar gasto
        </Botao>
      </div>

      <LancarGasto aberto={gasto} aoFechar={() => setGasto(false)} />

      <div className="cascata grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          icone={Wallet}
          rotulo="Gasto no último ano"
          valor={totais.custo12m}
          formatar={moeda}
          detalhe={`${totais.ativos} máquinas cadastradas`}
        />
        <Indicador
          icone={ClipboardList}
          rotulo="Serviços em aberto"
          valor={totais.osAbertas}
          detalhe={`${solicitacoes.data?.length || 0} avisos esperando`}
          tom="indigo"
          para="/os"
        />
        <Indicador
          icone={AlertTriangle}
          rotulo="Serviços atrasados"
          valor={atrasadas.length}
          detalhe={`${numero(totais.paradaHoras, 1)} h de máquina parada`}
          tom="red"
          para="/os"
        />
        <Indicador
          icone={PackageX}
          rotulo="Peças acabando"
          valor={estoqueBaixo.data?.length || 0}
          detalhe="abaixo do mínimo"
          tom="amber"
          para="/almoxarifado"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao>
          <CartaoTitulo>Quanto gastamos por mês</CartaoTitulo>
          <div className="p-4">
            {porMes.length === 0 ? (
              <Vazio
                icone={TrendingUp}
                titulo="Ainda não tem gasto lançado"
                descricao="Os valores aparecem quando o primeiro serviço for concluído."
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={porMes} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  {/* O degradê embaixo da linha dá peso ao gasto acumulado
                      sem precisar de uma barra pra cada mês. */}
                  <defs>
                    <linearGradient id="grad-custo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={tema.grade} vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tickFormatter={mesLabel}
                    tick={{ fontSize: 11, fill: tema.eixo }}
                    tickLine={false}
                    axisLine={false}
                    dy={4}
                  />
                  <YAxis
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: tema.eixo }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [moeda(v), 'Gasto']}
                    labelFormatter={mesLabel}
                    cursor={{ stroke: tema.eixo, strokeDasharray: '4 4' }}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 12,
                      border: `1px solid ${tema.traco}`,
                      background: tema.caixa,
                      color: tema.texto,
                      boxShadow: '0 12px 28px -6px rgb(15 23 42 / 0.18)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="custo"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    fill="url(#grad-custo)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: tema.caixa }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Cartao>

        <Cartao>
          <CartaoTitulo
            acao={
              <Link to="/ativos" className="text-xs font-medium text-sky-600 hover:text-sky-700">
                ver máquinas
              </Link>
            }
          >
            Máquinas que mais deram gasto (último ano)
          </CartaoTitulo>
          <div className="p-4">
            {topRanking.length === 0 ? (
              <Vazio
                icone={TrendingUp}
                titulo="Ainda não dá pra comparar"
                descricao="Quando houver gasto lançado, a lista aparece aqui."
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={topRanking}
                  layout="vertical"
                  margin={{ top: 5, right: 15, bottom: 5, left: 5 }}
                >
                  <defs>
                    <linearGradient id="grad-barra" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={tema.grade} horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: tema.eixo }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={130}
                    tick={{ fontSize: 11, fill: tema.rotulo }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [moeda(v), 'Gasto no ano']}
                    cursor={{ fill: tema.grade, opacity: 0.5 }}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 12,
                      border: `1px solid ${tema.traco}`,
                      background: tema.caixa,
                      color: tema.texto,
                      boxShadow: '0 12px 28px -6px rgb(15 23 42 / 0.18)',
                    }}
                  />
                  <Bar dataKey="custo" fill="url(#grad-barra)" radius={[0, 6, 6, 0]} />
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
              ver todos <ArrowRight size={13} />
            </Link>
          }
        >
          Serviços em aberto
        </CartaoTitulo>
        {backlog.isLoading ? (
          <Carregando />
        ) : (backlog.data || []).length === 0 ? (
          <Vazio titulo="Nenhum serviço em aberto" descricao="Tudo em dia por aqui." />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Serviço</Th>
                <Th>Máquina</Th>
                <Th>Urgência</Th>
                <Th>Aberto há</Th>
                <Th className="text-right">Gasto</Th>
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
                      {o.criticidade && ` · importância ${o.criticidade}`}
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
          <CartaoTitulo>Eusébio x Timon</CartaoTitulo>
          <Tabela>
            <thead>
              <tr>
                <Th>Unidade</Th>
                <Th className="text-right">Máquinas</Th>
                <Th className="text-right">Importância A</Th>
                <Th className="text-right">Em aberto</Th>
                <Th className="text-right">Parada (h)</Th>
                <Th className="text-right">Gasto no ano</Th>
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
