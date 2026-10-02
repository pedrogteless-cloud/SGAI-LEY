import { useMemo, useState } from 'react'
import { History, ShieldCheck, ChevronDown, Filter } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTabela } from '../hooks/useDados'
import { dataHora } from '../lib/format'
import { hojeISO } from '../lib/tempo'
import {
  M_TABELA_AUDITORIA, M_OPERACAO_AUDITORIA, M_CAMPO_AUDITORIA, M_PAPEL,
} from '../lib/constants'
import {
  Cartao, Campo, Entrada, Selecao, Etiqueta, Carregando, Vazio, Botao,
} from '../components/ui'

/**
 * Quem fez o quê, e a que horas.
 *
 * Só gestor abre — e é assim no banco também, não só aqui: a política de
 * leitura da tabela exige gestor. Esconder o item do menu sem fechar o
 * banco seria fingir segurança.
 *
 * O registro é escrito por gatilho, não pela tela. Não existe "marcar
 * como lido" nem apagar: auditoria que dá pra editar não serve de
 * auditoria.
 */

const TETO = 400

// Quantos dias pra trás, pra não arrastar a tabela inteira no 4G.
const PERIODOS = [
  { valor: '7', rotulo: 'Últimos 7 dias' },
  { valor: '30', rotulo: 'Últimos 30 dias' },
  { valor: '90', rotulo: 'Últimos 90 dias' },
  { valor: 'tudo', rotulo: 'Desde o começo' },
]

const diasAtras = (n) => {
  const [ano, mes, dia] = hojeISO().split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia - n)).toISOString().slice(0, 10)
}

export default function Auditoria() {
  const { ehGestor } = useAuth()
  const [periodo, setPeriodo] = useState('30')
  const [quem, setQuem] = useState('')
  const [oQue, setOQue] = useState('')
  const [operacao, setOperacao] = useState('')
  const [aberto, setAberto] = useState(null)

  const desde = periodo === 'tudo' ? null : `${diasAtras(Number(periodo))}T00:00:00`

  const registros = useTabela('vw_auditoria', {
    filtros: [
      ...(desde ? [['criado_em', 'gte', desde]] : []),
      ...(quem ? [['autor_id', 'eq', quem]] : []),
      ...(oQue ? [['tabela', 'eq', oQue]] : []),
      ...(operacao ? [['operacao', 'eq', operacao]] : []),
    ],
    ordem: { coluna: 'criado_em', asc: false },
    limite: TETO,
    ativo: ehGestor,
  })

  const lista = useMemo(() => registros.data || [], [registros.data])

  // Os filtros saem do que existe no período, não de uma lista fixa: não
  // adianta oferecer "Fornecedor" se ninguém mexeu em fornecedor.
  const pessoas = useMemo(() => {
    const vistos = new Map()
    for (const r of lista) if (r.autor_id) vistos.set(r.autor_id, r.autor)
    return [...vistos.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [lista])

  const tabelas = useMemo(
    () => [...new Set(lista.map((r) => r.tabela))].sort((a, b) =>
      (M_TABELA_AUDITORIA[a] || a).localeCompare(M_TABELA_AUDITORIA[b] || b, 'pt-BR')
    ),
    [lista]
  )

  if (!ehGestor) {
    return (
      <Cartao>
        <Vazio
          icone={ShieldCheck}
          titulo="Só gestor abre esta tela"
          descricao="O histórico de quem mexeu em quê é leitura de gestor."
        />
      </Cartao>
    )
  }

  const limpar = () => { setQuem(''); setOQue(''); setOperacao('') }
  const filtrando = quem || oQue || operacao

  return (
    <div className="entra space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Auditoria</h1>
        <p className="text-sm text-slate-500">Quem fez o quê, e a que horas</p>
      </div>

      <Cartao className="p-3">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Período">
            <Selecao value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Quem">
            <Selecao value={quem} onChange={(e) => setQuem(e.target.value)}>
              <option value="">Todo mundo</option>
              {pessoas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Onde">
            <Selecao value={oQue} onChange={(e) => setOQue(e.target.value)}>
              <option value="">Tudo</option>
              {tabelas.map((t) => (
                <option key={t} value={t}>{M_TABELA_AUDITORIA[t] || t}</option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="O que fez">
            <Selecao value={operacao} onChange={(e) => setOperacao(e.target.value)}>
              <option value="">Qualquer coisa</option>
              <option value="insert">Criou</option>
              <option value="update">Alterou</option>
              <option value="delete">Apagou</option>
            </Selecao>
          </Campo>
        </div>
        {filtrando && (
          <div className="mt-2 flex items-center gap-2">
            <Filter size={13} className="text-slate-400" />
            <Botao tamanho="sm" variante="secundario" onClick={limpar}>Limpar filtros</Botao>
          </div>
        )}
      </Cartao>

      {registros.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Cartao>
          <Vazio
            icone={History}
            titulo="Nada registrado nesse recorte"
            descricao="Mude o período ou tire os filtros. Só entra aqui o que mexe em cadastro, serviço, relatório ou permissão."
          />
        </Cartao>
      ) : (
        <>
          <Cartao>
            <ul className="divide-y divide-slate-100">
              {lista.map((r) => {
                const op = M_OPERACAO_AUDITORIA[r.operacao] || { label: r.operacao, cor: 'bg-slate-100 text-slate-600 ring-slate-200' }
                const campos = (r.campos || [])
                  .filter((c) => !['id', 'criado_em', 'criado_por'].includes(c))
                  .map((c) => M_CAMPO_AUDITORIA[c] || c.replace(/_/g, ' '))
                const estaAberto = aberto === r.id
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setAberto(estaAberto ? null : r.id)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm text-slate-800">
                          <span className="font-medium">{r.autor}</span>
                          {r.autor_papel && (
                            <span className="text-[11px] text-slate-400">
                              ({M_PAPEL[r.autor_papel]?.label || r.autor_papel})
                            </span>
                          )}
                          <Etiqueta cor={op.cor}>{op.label}</Etiqueta>
                          <span className="text-slate-600">
                            {M_TABELA_AUDITORIA[r.tabela] || r.tabela}
                          </span>
                          {r.rotulo && r.rotulo !== r.registro_id && (
                            <span className="truncate font-medium text-slate-700">“{r.rotulo}”</span>
                          )}
                        </p>
                        {campos.length > 0 && r.operacao === 'update' && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            Mudou: {campos.join(', ')}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-slate-400">{dataHora(r.criado_em)}</p>
                      </div>
                      <ChevronDown
                        size={15}
                        className={`mt-0.5 shrink-0 text-slate-300 transition-transform ${estaAberto ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {estaAberto && (
                      <div className="space-y-2 bg-slate-50 px-4 py-3">
                        {r.operacao === 'update' ? (
                          <TabelaDeMudancas antes={r.dados_antes} depois={r.dados_depois} campos={r.campos} />
                        ) : (
                          <Bruto dados={r.operacao === 'delete' ? r.dados_antes : r.dados_depois} />
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Cartao>

          {lista.length >= TETO && (
            <p className="text-xs text-amber-600">
              Mostrando os {TETO} mais recentes do período. Aperte o filtro pra ver o resto.
            </p>
          )}
        </>
      )}
    </div>
  )
}

const valorLegivel = (v) => {
  if (v == null) return '—'
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** De → para, só dos campos que mudaram. */
function TabelaDeMudancas({ antes, depois, campos }) {
  const mudados = (campos || []).filter((c) => !['id', 'atualizado_em'].includes(c))
  if (!mudados.length) return <p className="text-xs text-slate-400">Sem detalhe guardado.</p>
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="text-slate-400">
          <th className="pb-1 font-medium">Campo</th>
          <th className="pb-1 font-medium">Antes</th>
          <th className="pb-1 font-medium">Depois</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {mudados.map((c) => (
          <tr key={c}>
            <td className="py-1 pr-3 text-slate-600">{M_CAMPO_AUDITORIA[c] || c.replace(/_/g, ' ')}</td>
            <td className="py-1 pr-3 text-slate-500 line-through decoration-slate-300">
              {valorLegivel(antes?.[c])}
            </td>
            <td className="py-1 font-medium text-slate-800">{valorLegivel(depois?.[c])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Bruto({ dados }) {
  const campos = Object.entries(dados || {}).filter(
    ([c, v]) => v != null && !['id', 'atualizado_em', 'criado_em'].includes(c)
  )
  if (!campos.length) return <p className="text-xs text-slate-400">Sem detalhe guardado.</p>
  return (
    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
      {campos.map(([c, v]) => (
        <div key={c} className="flex gap-1.5">
          <dt className="shrink-0 text-slate-400">{M_CAMPO_AUDITORIA[c] || c.replace(/_/g, ' ')}:</dt>
          <dd className="min-w-0 truncate text-slate-700">{valorLegivel(v)}</dd>
        </div>
      ))}
    </dl>
  )
}
