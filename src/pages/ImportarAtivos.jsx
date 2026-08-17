import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { ArrowLeft, Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCategorias, useSetores, useUnidades, useInvalidar } from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import {
  Botao, Cartao, CartaoTitulo, Carregando, Tabela, Th, Td, Erro, Etiqueta, useAviso,
} from '../components/ui'

const COLUNAS = [
  'nome', 'categoria', 'unidade', 'setor', 'fabricante', 'modelo', 'numero_serie',
  'ano_fabricacao', 'data_aquisicao', 'valor_aquisicao', 'criticidade', 'localizacao',
  'tensao_v', 'fases', 'potencia_cv', 'corrente_nominal_a', 'disjuntor', 'observacoes',
]

const EXEMPLO = [
  COLUNAS.join(','),
  'Matelassê Gribetz 4000,Matelassê,Eusébio,Matelassê,Gribetz,GX-4000,SN-88213,2018,2019-03-15,180000,A,Galpão 2 linha B,380,3,25,34.5,3x50A,Comprada usada',
  'Compressor Parafuso 50CV,Compressor,Eusébio,Utilidades,Atlas Copco,GA37,AC-7781,2020,2020-08-01,80000,A,Casa de máquinas,380,3,50,68.5,3x100A,',
].join('\n')

const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

export default function ImportarAtivos() {
  const navegar = useNavigate()
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const { perfil } = useAuth()

  const [linhas, setLinhas] = useState([])
  const [arquivo, setArquivo] = useState(null)
  const [erro, setErro] = useState(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const unidades = useUnidades()
  const categorias = useCategorias()
  const setores = useSetores()

  const indices = useMemo(
    () => ({
      unidades: Object.fromEntries((unidades.data || []).map((u) => [semAcento(u.nome), u.id])),
      categorias: Object.fromEntries((categorias.data || []).map((c) => [semAcento(c.nome), c.id])),
      setores: Object.fromEntries(
        (setores.data || []).map((s) => [`${s.unidade_id}|${semAcento(s.nome)}`, s.id])
      ),
    }),
    [unidades.data, categorias.data, setores.data]
  )

  const validadas = useMemo(
    () =>
      linhas.map((l, i) => {
        const problemas = []
        const nome = String(l.nome || '').trim()
        if (!nome) problemas.push('nome vazio')

        const unidadeId = indices.unidades[semAcento(l.unidade)]
        if (!unidadeId) problemas.push(`unidade "${l.unidade || ''}" não existe`)

        const categoriaId = indices.categorias[semAcento(l.categoria)]
        if (!categoriaId) problemas.push(`categoria "${l.categoria || ''}" não existe`)

        let setorId = null
        if (String(l.setor || '').trim() && unidadeId) {
          setorId = indices.setores[`${unidadeId}|${semAcento(l.setor)}`] ?? null
          if (!setorId) problemas.push(`setor "${l.setor}" não existe nessa unidade`)
        }

        const criticidade = String(l.criticidade || 'B').trim().toUpperCase()
        if (!['A', 'B', 'C'].includes(criticidade)) problemas.push('criticidade deve ser A, B ou C')

        return { linha: i + 2, dados: l, nome, unidadeId, categoriaId, setorId, criticidade, problemas }
      }),
    [linhas, indices]
  )

  const validas = validadas.filter((v) => v.problemas.length === 0)
  const invalidas = validadas.filter((v) => v.problemas.length > 0)

  const lerArquivo = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setErro(null)
    setResultado(null)
    setArquivo(f.name)
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => semAcento(h).replace(/\s+/g, '_'),
      complete: (r) => setLinhas(r.data),
      error: (err) => setErro(new Error(err.message)),
    })
  }

  const baixarModelo = () => {
    const url = URL.createObjectURL(new Blob([EXEMPLO], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-ativos-sgai.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const num = (v) => {
    const n = Number(String(v ?? '').replace(',', '.'))
    return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null
  }

  const importar = async () => {
    setErro(null)
    setImportando(true)
    const erros = []
    let inseridos = 0

    for (const v of validas) {
      const d = v.dados
      const { data: ativo, error } = await supabase
        .from('ativos')
        .insert({
          nome: v.nome,
          categoria_id: v.categoriaId,
          unidade_id: v.unidadeId,
          setor_id: v.setorId,
          fabricante: String(d.fabricante || '').trim() || null,
          modelo: String(d.modelo || '').trim() || null,
          numero_serie: String(d.numero_serie || '').trim() || null,
          ano_fabricacao: num(d.ano_fabricacao),
          data_aquisicao: String(d.data_aquisicao || '').trim() || null,
          valor_aquisicao: num(d.valor_aquisicao),
          criticidade: v.criticidade,
          localizacao: String(d.localizacao || '').trim() || null,
          observacoes: String(d.observacoes || '').trim() || null,
        })
        .select('id')
        .single()

      if (error) {
        erros.push({ linha: v.linha, nome: v.nome, erro: error.message })
        continue
      }
      inseridos += 1

      const ficha = {
        tensao_v: num(d.tensao_v),
        fases: num(d.fases),
        potencia_cv: num(d.potencia_cv),
        corrente_nominal_a: num(d.corrente_nominal_a),
        disjuntor: String(d.disjuntor || '').trim() || null,
      }
      if (Object.values(ficha).some((x) => x !== null)) {
        await supabase.from('ativo_ficha_eletrica').upsert({ ativo_id: ativo.id, ...ficha })
      }
    }

    await supabase.from('importacoes').insert({
      entidade: 'ativos',
      arquivo_nome: arquivo,
      total_linhas: linhas.length,
      linhas_ok: inseridos,
      linhas_erro: erros.length + invalidas.length,
      erros: [...invalidas.map((i) => ({ linha: i.linha, erro: i.problemas.join('; ') })), ...erros],
      executado_por: perfil?.id ?? null,
    })

    invalidar('ativos', 'vw_kpi_custo_por_ativo')
    setResultado({ inseridos, erros })
    setImportando(false)
    if (inseridos > 0) avisar(`${inseridos} ativos cadastrados.`)
  }

  if (unidades.isLoading || categorias.isLoading) return <Carregando />

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/ativos">
          <Botao variante="fantasma" tamanho="sm">
            <ArrowLeft size={16} />
          </Botao>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Importar ativos por planilha</h1>
          <p className="text-sm text-slate-500">
            Cadastre dezenas de máquinas de uma vez, sem digitar uma por uma
          </p>
        </div>
      </div>

      <Cartao>
        <CartaoTitulo
          acao={
            <Botao variante="secundario" tamanho="sm" onClick={baixarModelo}>
              <Download size={14} /> Modelo CSV
            </Botao>
          }
        >
          1. Prepare o arquivo
        </CartaoTitulo>
        <div className="space-y-3 p-4 text-sm text-slate-600">
          <p>
            Baixe o modelo, preencha no Excel e salve como <strong>CSV (separado por vírgula)</strong>.
            Só <code className="rounded bg-slate-100 px-1">nome</code>,{' '}
            <code className="rounded bg-slate-100 px-1">categoria</code> e{' '}
            <code className="rounded bg-slate-100 px-1">unidade</code> são obrigatórios.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COLUNAS.map((c) => (
              <Etiqueta key={c}>{c}</Etiqueta>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Categoria, unidade e setor precisam existir no sistema — o nome é comparado ignorando
            acento e maiúscula. O código do ativo e o QR são gerados automaticamente.
          </p>
        </div>
      </Cartao>

      <Cartao>
        <CartaoTitulo>2. Envie o arquivo</CartaoTitulo>
        <div className="p-4">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg
              border-2 border-dashed border-slate-300 px-6 py-10 text-center transition
              hover:border-sky-400 hover:bg-sky-50/40"
          >
            <Upload size={24} className="mb-2 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              {arquivo || 'Clique para escolher o arquivo CSV'}
            </span>
            <span className="mt-0.5 text-xs text-slate-400">
              {linhas.length > 0 ? `${linhas.length} linhas lidas` : 'nenhum arquivo selecionado'}
            </span>
            <input type="file" accept=".csv,text/csv" onChange={lerArquivo} className="hidden" />
          </label>
        </div>
      </Cartao>

      {linhas.length > 0 && !resultado && (
        <Cartao>
          <CartaoTitulo
            acao={
              <Botao onClick={importar} carregando={importando} disabled={validas.length === 0}>
                Importar {validas.length} {validas.length === 1 ? 'ativo' : 'ativos'}
              </Botao>
            }
          >
            3. Confira antes de gravar
          </CartaoTitulo>

          <div className="flex gap-4 border-b border-slate-100 px-4 py-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 size={15} /> {validas.length} prontas
            </span>
            {invalidas.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-red-700">
                <AlertTriangle size={15} /> {invalidas.length} com problema
              </span>
            )}
          </div>

          <Tabela>
            <thead>
              <tr>
                <Th>Linha</Th>
                <Th>Nome</Th>
                <Th>Categoria</Th>
                <Th>Unidade / Setor</Th>
                <Th>Crit.</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {validadas.slice(0, 60).map((v) => (
                <tr key={v.linha} className={v.problemas.length ? 'bg-red-50/50' : ''}>
                  <Td className="text-xs text-slate-400">{v.linha}</Td>
                  <Td className="font-medium text-slate-800">{v.nome || '—'}</Td>
                  <Td className="text-slate-600">{v.dados.categoria}</Td>
                  <Td className="text-slate-600">
                    {v.dados.unidade}
                    {v.dados.setor ? ` / ${v.dados.setor}` : ''}
                  </Td>
                  <Td>{v.criticidade}</Td>
                  <Td>
                    {v.problemas.length === 0 ? (
                      <Etiqueta cor="bg-emerald-100 text-emerald-700 ring-emerald-200">ok</Etiqueta>
                    ) : (
                      <span className="text-xs text-red-700">{v.problemas.join('; ')}</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
          {validadas.length > 60 && (
            <p className="px-4 py-2 text-xs text-slate-400">
              Mostrando as 60 primeiras de {validadas.length} linhas.
            </p>
          )}
        </Cartao>
      )}

      {resultado && (
        <Cartao>
          <CartaoTitulo>Resultado</CartaoTitulo>
          <div className="space-y-3 p-4">
            <p className="text-sm text-slate-700">
              <strong className="text-emerald-700">{resultado.inseridos}</strong> ativos cadastrados.
              {(resultado.erros.length > 0 || invalidas.length > 0) && (
                <>
                  {' '}
                  <strong className="text-red-700">
                    {resultado.erros.length + invalidas.length}
                  </strong>{' '}
                  linhas não entraram.
                </>
              )}
            </p>

            {resultado.erros.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {resultado.erros.map((e) => (
                  <li key={e.linha}>
                    Linha {e.linha} ({e.nome}): {e.erro}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2 pt-1">
              <Botao onClick={() => navegar('/ativos')}>Ver ativos</Botao>
              <Botao
                variante="secundario"
                onClick={() => {
                  setLinhas([])
                  setArquivo(null)
                  setResultado(null)
                }}
              >
                Importar outra planilha
              </Botao>
            </div>
          </div>
        </Cartao>
      )}

      <Erro erro={erro} />
    </div>
  )
}
