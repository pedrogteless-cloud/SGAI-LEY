import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Upload, Package } from 'lucide-react'
import { useTabela, useCategorias, useSetores, useUnidades } from '../hooks/useDados'
import { moeda } from '../lib/format'
import { M_CRITICIDADE, M_SITUACAO, CRITICIDADES, SITUACOES_ATIVO } from '../lib/constants'
import {
  Botao, Cartao, Etiqueta, Carregando, Vazio, Tabela, Th, Td, Entrada, Selecao,
} from '../components/ui'

export default function Ativos() {
  const [busca, setBusca] = useState('')
  const [unidade, setUnidade] = useState('')
  const [categoria, setCategoria] = useState('')
  const [setor, setSetor] = useState('')
  const [criticidade, setCriticidade] = useState('')
  const [situacao, setSituacao] = useState('')

  const unidades = useUnidades()
  const categorias = useCategorias()
  const setores = useSetores(unidade || undefined)

  const ativos = useTabela('ativos', {
    select: `id, codigo, nome, fabricante, modelo, criticidade, situacao, valor_aquisicao,
             foto_capa_url, ativo_pai_id,
             categoria:categorias_ativo(nome), setor:setores(nome), unidade:unidades(nome)`,
    filtros: [
      ['ativo', 'eq', true],
      ...(unidade ? [['unidade_id', 'eq', unidade]] : []),
      ...(categoria ? [['categoria_id', 'eq', categoria]] : []),
      ...(setor ? [['setor_id', 'eq', setor]] : []),
      ...(criticidade ? [['criticidade', 'eq', criticidade]] : []),
      ...(situacao ? [['situacao', 'eq', situacao]] : []),
    ],
    ordem: { coluna: 'codigo' },
  })

  const custos = useTabela('vw_kpi_custo_por_ativo', { select: 'ativo_id, custo_12m' })
  const custoPorAtivo = useMemo(
    () => Object.fromEntries((custos.data || []).map((c) => [c.ativo_id, c.custo_12m])),
    [custos.data]
  )

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return ativos.data || []
    return (ativos.data || []).filter((a) =>
      [a.codigo, a.nome, a.fabricante, a.modelo]
        .filter(Boolean)
        .some((c) => c.toLowerCase().includes(termo))
    )
  }, [ativos.data, busca])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Ativos</h1>
          <p className="text-sm text-slate-500">
            {lista.length} {lista.length === 1 ? 'equipamento' : 'equipamentos'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/ativos/importar">
            <Botao variante="secundario">
              <Upload size={15} /> Importar planilha
            </Botao>
          </Link>
          <Link to="/ativos/novo">
            <Botao>
              <Plus size={15} /> Novo ativo
            </Botao>
          </Link>
        </div>
      </div>

      <Cartao className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute top-2.5 left-3 text-slate-400" />
            <Entrada
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código, nome, fabricante…"
              className="pl-9"
            />
          </div>
          <Selecao
            value={unidade}
            onChange={(e) => {
              setUnidade(e.target.value)
              setSetor('')
            }}
          >
            <option value="">Todas as unidades</option>
            {(unidades.data || []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Selecao>
          <Selecao value={setor} onChange={(e) => setSetor(e.target.value)}>
            <option value="">Todos os setores</option>
            {(setores.data || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Selecao>
          <Selecao value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas as categorias</option>
            {(categorias.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
          <div className="grid grid-cols-2 gap-2">
            <Selecao value={criticidade} onChange={(e) => setCriticidade(e.target.value)}>
              <option value="">Crit.</option>
              {CRITICIDADES.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.valor}
                </option>
              ))}
            </Selecao>
            <Selecao value={situacao} onChange={(e) => setSituacao(e.target.value)}>
              <option value="">Situação</option>
              {SITUACOES_ATIVO.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.label}
                </option>
              ))}
            </Selecao>
          </div>
        </div>
      </Cartao>

      <Cartao>
        {ativos.isLoading ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio
            icone={Package}
            titulo="Nenhum ativo encontrado"
            descricao="Cadastre o primeiro equipamento ou importe a planilha da mudança."
            acao={
              <Link to="/ativos/novo">
                <Botao>
                  <Plus size={15} /> Cadastrar ativo
                </Botao>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Equipamento</Th>
                <Th>Local</Th>
                <Th>Crit.</Th>
                <Th>Situação</Th>
                <Th className="text-right">Custo 12m</Th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      to={`/ativos/${a.id}`}
                      className="font-mono text-xs font-medium text-sky-600 hover:text-sky-700"
                    >
                      {a.codigo}
                    </Link>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      {a.foto_capa_url ? (
                        <img
                          src={a.foto_capa_url}
                          alt=""
                          className="size-8 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                          <Package size={14} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">
                          {a.ativo_pai_id && (
                            <span className="mr-1 text-xs text-slate-400">↳</span>
                          )}
                          {a.nome}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {[a.fabricante, a.modelo].filter(Boolean).join(' · ') ||
                            a.categoria?.nome}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-slate-600">
                    <p>{a.setor?.nome || '—'}</p>
                    <p className="text-xs text-slate-400">{a.unidade?.nome}</p>
                  </Td>
                  <Td>
                    <Etiqueta cor={M_CRITICIDADE[a.criticidade]?.cor}>{a.criticidade}</Etiqueta>
                  </Td>
                  <Td>
                    <Etiqueta cor={M_SITUACAO[a.situacao]?.cor}>
                      {M_SITUACAO[a.situacao]?.label}
                    </Etiqueta>
                  </Td>
                  <Td className="text-right font-medium">
                    {custoPorAtivo[a.id] ? moeda(custoPorAtivo[a.id]) : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>
    </div>
  )
}
