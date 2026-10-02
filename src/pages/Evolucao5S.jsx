import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Eye, CalendarDays, RotateCcw, ArrowRight, Sprout } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid,
} from 'recharts'
import { useTabela, useUnidades } from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import { data as fmtData, numero } from '../lib/format'
import { hojeISO } from '../lib/tempo'
import { limitesPeriodo, PERIODOS } from '../lib/chaoIndicadores'
import {
  consistenciaDaObservacao, observacaoPorDia, serieDeCadaSetor,
  ressalvasPorItem, problemasQueVoltaram,
} from '../lib/evolucao5s'
import { corDaNota5s, labelDaNota5s } from '../lib/constants'
import {
  Cartao, CartaoTitulo, Etiqueta, Selecao, Entrada, Carregando, Vazio, Botao,
} from '../components/ui'

/**
 * Como o 5S está evoluindo — de propósito sem ranking e sem meta.
 *
 * O combinado das primeiras semanas é que o objetivo não é nota alta, é
 * consistência: o encarregado aprendendo a olhar o setor sempre do mesmo
 * jeito. Por isso o número que abre a tela é "quanto do que era pra ser
 * olhado foi olhado", os setores aparecem em ordem alfabética, cada um
 * comparado só com ele mesmo, e em nenhum lugar existe "melhor" ou
 * "pior". Quando houver linha de base, aí sim dá pra falar de meta.
 */

// Períodos curtos demais não mostram evolução nenhuma; o padrão é o mês.
const PERIODOS_UTEIS = PERIODOS.filter((p) => p.valor !== 'hoje')

export default function Evolucao5S() {
  const { perfil } = useAuth()
  const [unidadeId, setUnidadeId] = useState(perfil?.unidade_id || '')
  const [periodo, setPeriodo] = useState('mes')
  const [personalizado, setPersonalizado] = useState({ inicio: '', fim: hojeISO() })

  const unidades = useUnidades()
  const unidadeAtual = unidadeId || unidades.data?.[0]?.id || ''
  const limites = useMemo(() => limitesPeriodo(periodo, personalizado), [periodo, personalizado])

  const filtroBase = [
    ...(unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : []),
    ['relatorio_data', 'gte', limites.inicio],
    ['relatorio_data', 'lte', limites.fim],
  ]

  const avaliacoes = useTabela('vw_relatorio_chao_setor_avaliacoes', {
    select: 'id, setor_nome, nota, nao_inspecionado, relatorio_data',
    filtros: filtroBase,
    ordem: { coluna: 'relatorio_data' },
    limite: 2000,
  })
  const respostas = useTabela('vw_relatorio_chao_setor_5s', {
    select: 'id, setor_nome, item, resposta, descricao_problema, relatorio_data',
    filtros: filtroBase,
    ordem: { coluna: 'relatorio_data' },
    limite: 5000,
  })

  // Os memos dependem de `.data` direto: `data || []` cria um array novo
  // a cada render enquanto a consulta não volta, e aí o memo nunca memo-iza.
  const listaAval = useMemo(() => avaliacoes.data || [], [avaliacoes.data])
  const listaResp = useMemo(() => respostas.data || [], [respostas.data])

  const consistencia = useMemo(() => consistenciaDaObservacao(listaAval), [listaAval])
  const porDia = useMemo(() => observacaoPorDia(listaAval), [listaAval])
  const series = useMemo(() => serieDeCadaSetor(listaAval), [listaAval])
  const porItem = useMemo(() => ressalvasPorItem(listaResp), [listaResp])
  const voltaram = useMemo(() => problemasQueVoltaram(listaResp), [listaResp])

  const carregando = avaliacoes.isLoading || respostas.isLoading
  const semDados = !carregando && listaAval.length === 0

  return (
    <div className="entra space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Evolução do 5S</h1>
          <p className="text-sm text-slate-500">
            {fmtData(limites.inicio)} a {fmtData(limites.fim)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(unidades.data || []).length > 1 && (
            <Selecao value={unidadeAtual} onChange={(e) => setUnidadeId(e.target.value)} className="w-auto">
              {(unidades.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </Selecao>
          )}
          <Selecao value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-auto">
            {PERIODOS_UTEIS.map((p) => (
              <option key={p.valor} value={p.valor}>{p.rotulo}</option>
            ))}
          </Selecao>
          {periodo === 'personalizado' && (
            <>
              <Entrada
                type="date" className="w-auto" max={hojeISO()}
                value={personalizado.inicio}
                onChange={(e) => setPersonalizado((p) => ({ ...p, inicio: e.target.value }))}
              />
              <Entrada
                type="date" className="w-auto" max={hojeISO()}
                value={personalizado.fim}
                onChange={(e) => setPersonalizado((p) => ({ ...p, fim: e.target.value }))}
              />
            </>
          )}
        </div>
      </div>

      {/* O enquadramento fica no topo, não num rodapé que ninguém lê: é
          ele que evita a tela ser usada como placar. */}
      <div className="flex gap-2.5 rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200 ring-inset">
        <Sprout size={16} className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="text-xs leading-relaxed text-emerald-900">
          <span className="font-semibold">Fase de aprendizado.</span> Esta tela mostra como a
          observação está acontecendo — não é ranking nem cobrança de meta. Cada setor aparece
          comparado com ele mesmo, em ordem alfabética. O objetivo agora é avaliar sempre do mesmo
          jeito e formar linha de base; nota alta cedo demais só ensina a preencher bonito.
        </p>
      </div>

      {carregando ? (
        <Carregando />
      ) : semDados ? (
        <Cartao>
          <Vazio
            icone={TrendingUp}
            titulo="Ainda não há checklist nesse período"
            descricao="Assim que o 5S começar a ser preenchido, a evolução aparece aqui."
            acao={<Link to="/5s"><Botao>Ir para o 5S <ArrowRight size={15} /></Botao></Link>}
          />
        </Cartao>
      ) : (
        <>
          {/* ---------------------------------------------- consistência */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CartaoNumero
              icone={Eye}
              rotulo="Setores observados"
              valor={consistencia.pctObservado == null ? '—' : `${numero(consistencia.pctObservado, 0)}%`}
              detalhe={`${consistencia.observados} de ${consistencia.previstos} previstos`}
              destaque
            />
            <CartaoNumero
              icone={CalendarDays}
              rotulo="Dias com observação"
              valor={consistencia.diasComObservacao}
              detalhe={`${consistencia.diasComRelatorio} dia(s) com relatório aberto`}
            />
            <CartaoNumero
              rotulo="Não visitados com motivo"
              valor={consistencia.justificados}
              detalhe="Explicam a ausência, não substituem a visita"
            />
            <CartaoNumero
              rotulo="Sem registro nenhum"
              valor={consistencia.semRegistro}
              detalhe="Estavam na lista do dia e ninguém disse nada"
              alerta={consistencia.semRegistro > 0}
            />
          </div>

          {porDia.length > 1 && (
            <Cartao>
              <CartaoTitulo>Setores observados por dia</CartaoTitulo>
              <div className="h-56 px-2 pb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porDia} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--traco)" vertical={false} />
                    <XAxis
                      dataKey="data" tickFormatter={(d) => fmtData(d).slice(0, 5)}
                      tick={{ fontSize: 11 }} stroke="#94a3b8"
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip
                      labelFormatter={(d) => fmtData(d)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--traco)' }}
                    />
                    <Bar dataKey="observados" name="Observados" fill="#0284c7" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="justificados" name="Não visitados" fill="#fbbf24" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="semRegistro" name="Sem registro" fill="#e2e8f0" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cartao>
          )}

          {/* ------------------------------------------- linha por setor */}
          <Cartao>
            <CartaoTitulo>Cada setor com ele mesmo</CartaoTitulo>
            {series.length === 0 ? (
              <Vazio titulo="Nenhum setor com nota nesse período" />
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {series.map((s) => (
                  <SetorAoLongoDoTempo key={s.setor} serie={s} />
                ))}
              </div>
            )}
          </Cartao>

          {/* ----------------------------------------- ressalva por item */}
          <Cartao>
            <CartaoTitulo>Onde a observação mais engancha</CartaoTitulo>
            <p className="px-4 pt-3 text-xs text-slate-500">
              Na ordem do método, não na da frequência. Serve pra saber em qual etapa vale
              reforçar o combinado com o pessoal — não pra apontar setor.
            </p>
            <ul className="divide-y divide-slate-100">
              {porItem.map((i) => (
                <li key={i.item} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">{i.titulo}</p>
                    <p className="shrink-0 text-xs text-slate-500 tabular-nums">
                      {i.respondidas === 0
                        ? 'sem resposta ainda'
                        : `${i.comRessalva} de ${i.respondidas} com ressalva`}
                    </p>
                  </div>
                  {i.respondidas > 0 && (
                    <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <span className="bg-red-400" style={{ width: `${(i.naoConforme / i.respondidas) * 100}%` }} />
                      <span className="bg-amber-300" style={{ width: `${(i.parcial / i.respondidas) * 100}%` }} />
                      <span className="bg-emerald-400" style={{ width: `${(i.conforme / i.respondidas) * 100}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Cartao>

          {/* ------------------------------------------ o que voltou */}
          <Cartao>
            <CartaoTitulo
              acao={
                <Link to="/5s/acoes" className="text-xs font-medium text-sky-600 hover:text-sky-700">
                  Ver o plano de ação →
                </Link>
              }
            >
              <span className="inline-flex items-center gap-2">
                <RotateCcw size={15} className="text-slate-400" /> O que voltou a aparecer
              </span>
            </CartaoTitulo>
            {voltaram.length === 0 ? (
              <Vazio
                titulo="Nada se repetiu nesse período"
                descricao="Nenhum item foi apontado no mesmo setor em mais de um dia."
              />
            ) : (
              <>
                <p className="px-4 pt-3 text-xs text-slate-500">
                  O mesmo item, no mesmo setor, apontado em dias diferentes. Não é nota de
                  ninguém: é o que ficou sem resolver entre uma visita e outra.
                </p>
                <ul className="divide-y divide-slate-100">
                  {voltaram.map((g) => (
                    <li key={`${g.setor}-${g.item}`} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {g.setor} · <span className="font-normal text-slate-600">{g.titulo}</span>
                        </p>
                        {g.ultimaDescricao && (
                          <p className="mt-0.5 truncate text-xs text-slate-500">{g.ultimaDescricao}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {g.dias.map((d) => fmtData(d)).join(' · ')}
                        </p>
                      </div>
                      <Etiqueta cor="bg-amber-100 text-amber-700 ring-amber-200">
                        {g.vezes}×
                      </Etiqueta>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Cartao>
        </>
      )}
    </div>
  )
}

function CartaoNumero({ icone: Icone, rotulo, valor, detalhe, destaque = false, alerta = false }) {
  return (
    <Cartao className="p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
        {Icone && <Icone size={12} />} {rotulo}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          alerta ? 'text-amber-600' : destaque ? 'text-sky-700' : 'text-slate-900'
        }`}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-xs leading-snug text-slate-400">{detalhe}</p>
    </Cartao>
  )
}

/**
 * Um setor, a linha dele no tempo. Sem eixo comparativo com os outros e
 * sem posição numa lista — só "como estava" e "como está".
 */
function SetorAoLongoDoTempo({ serie }) {
  const { setor, pontos, media, primeira, ultima, observacoes } = serie
  const variou = observacoes > 1 ? ultima - primeira : null

  return (
    <div className="rounded-lg p-3 ring-1 ring-slate-200 ring-inset">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold text-slate-800">{setor}</p>
        <Etiqueta cor={corDaNota5s(media)}>
          {numero(media, 1)} · {labelDaNota5s(media)}
        </Etiqueta>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {observacoes} observação(ões) no período
        {variou != null && variou !== 0 && (
          <span className={variou > 0 ? 'text-emerald-600' : 'text-amber-600'}>
            {' · '}{variou > 0 ? 'subiu' : 'caiu'} {numero(Math.abs(variou), 1)} desde a primeira
          </span>
        )}
      </p>
      {pontos.length > 1 ? (
        <div className="mt-2 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pontos} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
              <XAxis dataKey="data" hide />
              <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={{ fontSize: 10 }} stroke="#cbd5e1" />
              <Tooltip
                labelFormatter={(d) => fmtData(d)}
                formatter={(v) => [numero(v, 1), 'Nota']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--traco)' }}
              />
              <Line
                type="monotone" dataKey="nota" stroke="#0284c7" strokeWidth={2}
                dot={{ r: 2.5 }} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">
          Só uma observação até agora — a linha aparece a partir da segunda.
        </p>
      )}
    </div>
  )
}
