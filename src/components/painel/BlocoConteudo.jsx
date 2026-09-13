import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { AlertTriangle, Info } from 'lucide-react'
import { moeda, numero, data as fmtData, mesLabel } from '../../lib/format'
import { campoDe } from '../../lib/painelFontes'
import {
  aplicarFiltros, agregar, agruparPorCampo, serieNoTempo, M_OPERACAO,
} from '../../lib/painelDados'
import { useDadosDoBloco } from '../../hooks/usePainel'
import { Carregando } from '../ui'

/**
 * O conteúdo de um bloco: o número, o gráfico ou a lista.
 *
 * Cada bloco busca os próprios dados. Poderia haver uma busca só pro
 * painel inteiro, mas blocos diferentes usam fontes diferentes — e o
 * react-query já junta consultas iguais entre si, então dois cartões da
 * mesma fonte com o mesmo filtro fazem uma requisição só.
 */

// Paleta na mesma família do resto do app. A primeira cor é a que mais
// aparece, então é a do app (sky), não um roxo de biblioteca.
const CORES = ['#0284c7', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']

const EIXO = { fontSize: 11, fill: '#94a3b8' }

function formatarValor(valor, bloco) {
  if (valor == null) return '—'
  const op = M_OPERACAO[bloco.operacao]
  // Contagem é quantidade de linha, nunca dinheiro: contar OS de custo
  // não dá "R$ 12", dá "12 serviços".
  if (!op?.precisaCampo || bloco.operacao === 'contar_distintos') return numero(valor, 0)

  const campo = campoDe(bloco.fonte, bloco.campoValor)
  if (campo?.formato === 'dinheiro') return moeda(valor)
  if (campo?.formato === 'porcento') return `${numero(valor, 1)}%`
  return numero(valor, Number.isInteger(valor) ? 0 : 2)
}

const rotuloDoPeriodo = (iso, granularidade) => {
  if (granularidade === 'mes') return mesLabel(iso)
  if (granularidade === 'ano') return iso.slice(0, 4)
  return fmtData(iso).slice(0, 5)
}

function Recado({ icone: Icone = Info, children, tom = 'neutro' }) {
  const cor = tom === 'alerta' ? 'text-amber-600' : 'text-slate-400'
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center">
      <Icone size={18} className={cor} />
      <p className={`text-xs leading-snug ${cor}`}>{children}</p>
    </div>
  )
}

const DicaGrafico = {
  contentStyle: { fontSize: 12, borderRadius: 8, border: '1px solid var(--traco)' },
}

export default function BlocoConteudo({ bloco, contexto }) {
  const { linhas, isLoading, isError, error, total, truncado, validacao } =
    useDadosDoBloco(bloco, contexto)

  if (bloco.tipo === 'texto') {
    return (
      <div className="h-full overflow-auto px-4 py-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
          {bloco.texto || 'Toque em editar pra escrever aqui.'}
        </p>
      </div>
    )
  }

  // O bloco diz o que falta pra ele funcionar, em vez de ficar em branco
  // esperando alguém adivinhar.
  if (!validacao.ok) return <Recado icone={AlertTriangle} tom="alerta">{validacao.erro}</Recado>
  if (isLoading) return <Carregando texto="" />
  if (isError) return <Recado icone={AlertTriangle} tom="alerta">{error?.message || 'Não deu pra buscar.'}</Recado>

  const filtradas = aplicarFiltros(linhas, bloco.filtros)
  if (!filtradas.length) return <Recado>Nenhum dado no período e nos filtros escolhidos.</Recado>

  const aviso = truncado
    ? `Mostrando ${numero(linhas.length, 0)} de ${numero(total, 0)} — aperte o filtro pra conta fechar.`
    : null

  if (bloco.tipo === 'numero') {
    const valor = agregar(filtradas, bloco.operacao, bloco.campoValor)
    return (
      <div className="flex h-full flex-col justify-center px-4 py-3">
        <p className="truncate text-3xl font-bold tabular-nums text-slate-900">
          {formatarValor(valor, bloco)}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {numero(filtradas.length, 0)} linha(s)
        </p>
        {aviso && <p className="mt-1 text-[11px] leading-snug text-amber-600">{aviso}</p>}
      </div>
    )
  }

  if (bloco.tipo === 'barras') {
    const itens = agruparPorCampo(filtradas, bloco.agruparPor, bloco.operacao, bloco.campoValor, {
      limite: bloco.limite || 8,
      ordem: bloco.ordem || 'valor',
    })
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 px-1 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {/* Barra deitada: nome de setor e de material não cabe em
                pé sem virar texto na diagonal. */}
            <BarChart data={itens} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--traco)" horizontal={false} />
              <XAxis type="number" tick={EIXO} stroke="#cbd5e1" />
              <YAxis type="category" dataKey="rotulo" width={96} tick={EIXO} stroke="#cbd5e1" />
              <Tooltip {...DicaGrafico} formatter={(v) => [formatarValor(v, bloco), '']} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {itens.map((i, idx) => (
                  <Cell key={i.rotulo} fill={i.resto ? '#cbd5e1' : CORES[idx % CORES.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {aviso && <p className="px-3 pb-2 text-[11px] text-amber-600">{aviso}</p>}
      </div>
    )
  }

  if (bloco.tipo === 'pizza') {
    const itens = agruparPorCampo(filtradas, bloco.agruparPor, bloco.operacao, bloco.campoValor, {
      limite: bloco.limite || 6,
    }).filter((i) => i.valor != null && i.valor > 0)
    if (!itens.length) return <Recado>Nada com valor maior que zero pra dividir em fatias.</Recado>
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={itens} dataKey="valor" nameKey="rotulo"
                innerRadius="45%" outerRadius="78%" paddingAngle={2} isAnimationActive={false}
              >
                {itens.map((i, idx) => (
                  <Cell key={i.rotulo} fill={i.resto ? '#cbd5e1' : CORES[idx % CORES.length]} />
                ))}
              </Pie>
              <Tooltip {...DicaGrafico} formatter={(v, nome) => [formatarValor(v, bloco), nome]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 px-3 pb-2">
          {itens.map((i, idx) => (
            <li key={i.rotulo} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: i.resto ? '#cbd5e1' : CORES[idx % CORES.length] }}
              />
              <span className="truncate">{i.rotulo}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (bloco.tipo === 'linha') {
    const granularidade = bloco.granularidade || 'dia'
    const serie = serieNoTempo(
      filtradas, bloco.campoData, granularidade, bloco.operacao, bloco.campoValor
    )
    if (!serie.length) return <Recado>Nenhuma data preenchida nas linhas encontradas.</Recado>
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 px-1 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 4, right: 12, left: -18, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--traco)" vertical={false} />
              <XAxis
                dataKey="periodo" tick={EIXO} stroke="#cbd5e1"
                tickFormatter={(p) => rotuloDoPeriodo(p, granularidade)}
              />
              <YAxis tick={EIXO} stroke="#cbd5e1" />
              <Tooltip
                {...DicaGrafico}
                labelFormatter={(p) => rotuloDoPeriodo(p, granularidade)}
                formatter={(v) => [formatarValor(v, bloco), '']}
              />
              {/* connectNulls fica desligado de propósito: período sem
                  medição é buraco, não uma reta ligando os dois lados. */}
              <Line
                type="monotone" dataKey="valor" stroke={CORES[0]} strokeWidth={2}
                dot={serie.length <= 40 ? { r: 2 } : false}
                connectNulls={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {aviso && <p className="px-3 pb-2 text-[11px] text-amber-600">{aviso}</p>}
      </div>
    )
  }

  if (bloco.tipo === 'lista') {
    const colunas = bloco.colunas || []
    const ordenadas = bloco.ordenarPor
      ? [...filtradas].sort((a, b) => {
          const va = a[bloco.ordenarPor]
          const vb = b[bloco.ordenarPor]
          const na = Number(va)
          const nb = Number(vb)
          const cmp = Number.isFinite(na) && Number.isFinite(nb)
            ? na - nb
            : String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR')
          return bloco.ordemDecrescente ? -cmp : cmp
        })
      : filtradas

    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {colunas.map((c) => (
                <th key={c} className="px-3 py-2 font-semibold text-slate-500">
                  {campoDe(bloco.fonte, c)?.rotulo || c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordenadas.slice(0, bloco.limite || 50).map((l, i) => (
              <tr key={l.id || i}>
                {colunas.map((c) => {
                  const campo = campoDe(bloco.fonte, c)
                  const v = l[c]
                  let texto = v == null || v === '' ? '—' : String(v)
                  if (campo?.tipo === 'data' && v) texto = fmtData(v)
                  else if (campo?.tipo === 'numero' && v != null) {
                    texto = campo.formato === 'dinheiro' ? moeda(v) : numero(v, 2)
                  } else if (campo?.tipo === 'booleano') texto = v ? 'Sim' : 'Não'
                  return (
                    <td key={c} className="max-w-[18ch] truncate px-3 py-2 text-slate-700">{texto}</td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {aviso && <p className="px-3 py-2 text-[11px] text-amber-600">{aviso}</p>}
      </div>
    )
  }

  return <Recado icone={AlertTriangle} tom="alerta">Tipo de bloco desconhecido: {bloco.tipo}</Recado>
}
