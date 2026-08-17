import { useMemo, useState } from 'react'
import { Plus, Search, Boxes, AlertTriangle, ArrowDownUp } from 'lucide-react'
import {
  useTabela, useInserir, useAtualizar, useUnidades, useFornecedores, useInvalidar,
} from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import { moeda, numero, dataHora } from '../lib/format'
import { TIPOS_MOVIMENTO } from '../lib/constants'
import {
  Botao, Cartao, CartaoTitulo, Etiqueta, Carregando, Vazio, Tabela, Th, Td,
  Entrada, Selecao, Modal, Campo, Area, Erro, useAviso,
} from '../components/ui'

const INVALIDAR = ['estoque', 'estoque_movimentos', 'vw_kpi_estoque_baixo', 'pecas']

export default function Almoxarifado() {
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const { ehGestor } = useAuth()

  const [aba, setAba] = useState('estoque')
  const [busca, setBusca] = useState('')
  const [soAbaixoMinimo, setSoAbaixoMinimo] = useState(false)
  const [modal, setModal] = useState(null)
  const [erro, setErro] = useState(null)

  const [formPeca, setFormPeca] = useState({
    codigo: '', nome: '', unidade_medida: 'UN', fabricante: '', categoria: '',
    critica: false, fornecedor_padrao_id: '',
  })
  const [formMov, setFormMov] = useState({
    peca_id: '', unidade_id: '', tipo: 'entrada', quantidade: '',
    custo_unitario: '', documento: '', fornecedor_id: '', observacao: '',
  })
  const [formMinimo, setFormMinimo] = useState(null)

  const unidades = useUnidades()
  const fornecedores = useFornecedores()

  const estoque = useTabela('estoque', {
    select: '*, peca:pecas(id, codigo, nome, unidade_medida, critica, ativo), unidade:unidades(nome)',
    ordem: { coluna: 'atualizado_em', asc: false },
  })
  const pecas = useTabela('pecas', {
    filtros: [['ativo', 'eq', true]],
    ordem: { coluna: 'nome' },
  })
  const movimentos = useTabela('estoque_movimentos', {
    select: '*, peca:pecas(codigo, nome), unidade:unidades(nome), fornecedor:fornecedores(nome)',
    ordem: { coluna: 'criado_em', asc: false },
    limite: 100,
  })
  const baixo = useTabela('vw_kpi_estoque_baixo')

  const criarPeca = useInserir('pecas', INVALIDAR)
  const criarMov = useInserir('estoque_movimentos', INVALIDAR)
  const atualizarEstoque = useAtualizar('estoque', INVALIDAR)

  const linhasEstoque = useMemo(() => {
    let l = (estoque.data || []).filter((e) => e.peca?.ativo)
    if (soAbaixoMinimo) l = l.filter((e) => Number(e.quantidade) < Number(e.estoque_minimo))
    const termo = busca.trim().toLowerCase()
    if (termo) {
      l = l.filter((e) =>
        [e.peca?.codigo, e.peca?.nome].filter(Boolean).some((c) => c.toLowerCase().includes(termo))
      )
    }
    return l
  }, [estoque.data, busca, soAbaixoMinimo])

  const valorTotal = linhasEstoque.reduce(
    (s, e) => s + Number(e.quantidade || 0) * Number(e.custo_medio || 0),
    0
  )

  const salvarPeca = async () => {
    setErro(null)
    try {
      await criarPeca.mutateAsync({
        codigo: formPeca.codigo.trim() || null,
        nome: formPeca.nome.trim(),
        unidade_medida: formPeca.unidade_medida,
        fabricante: formPeca.fabricante.trim() || null,
        categoria: formPeca.categoria.trim() || null,
        critica: formPeca.critica,
        fornecedor_padrao_id: formPeca.fornecedor_padrao_id || null,
      })
      setModal(null)
      setFormPeca({
        codigo: '', nome: '', unidade_medida: 'UN', fabricante: '', categoria: '',
        critica: false, fornecedor_padrao_id: '',
      })
      avisar('Peça cadastrada.')
    } catch (e) {
      setErro(e)
    }
  }

  const salvarMov = async () => {
    setErro(null)
    try {
      await criarMov.mutateAsync({
        peca_id: formMov.peca_id,
        unidade_id: formMov.unidade_id,
        tipo: formMov.tipo,
        quantidade: Number(formMov.quantidade),
        custo_unitario: Number(formMov.custo_unitario || 0),
        documento: formMov.documento.trim() || null,
        fornecedor_id: formMov.fornecedor_id || null,
        observacao: formMov.observacao.trim() || null,
      })
      setModal(null)
      setFormMov({
        peca_id: '', unidade_id: '', tipo: 'entrada', quantidade: '',
        custo_unitario: '', documento: '', fornecedor_id: '', observacao: '',
      })
      avisar('Anotado. Preço médio recalculado.')
    } catch (e) {
      setErro(e)
    }
  }

  const salvarMinimo = async () => {
    setErro(null)
    try {
      await atualizarEstoque.mutateAsync({
        id: formMinimo.id,
        estoque_minimo: Number(formMinimo.estoque_minimo || 0),
        localizacao: formMinimo.localizacao?.trim() || null,
      })
      setFormMinimo(null)
      invalidar('estoque')
      avisar('Pronto, vou te avisar quando chegar nesse nível.')
    } catch (e) {
      setErro(e)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Peças</h1>
          <p className="text-sm text-slate-500">
            {linhasEstoque.length} peças · {moeda(valorTotal)} parados na prateleira
          </p>
        </div>
        <div className="flex gap-2">
          <Botao
            variante="secundario"
            onClick={() => {
              setErro(null)
              setModal('peca')
            }}
          >
            <Plus size={15} /> Nova peça
          </Botao>
          {ehGestor && (
            <Botao
              onClick={() => {
                setErro(null)
                setFormMov((f) => ({
                  ...f,
                  unidade_id: f.unidade_id || unidades.data?.[0]?.id || '',
                }))
                setModal('movimento')
              }}
            >
              <ArrowDownUp size={15} /> Entrada / saída
            </Botao>
          )}
        </div>
      </div>

      {(baixo.data || []).length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-200 ring-inset">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900">
              {baixo.data.length} {baixo.data.length === 1 ? 'peça está' : 'peças estão'} acabando
            </p>
            <p className="text-amber-700">
              {baixo.data
                .slice(0, 4)
                .map((b) => b.nome)
                .join(', ')}
              {baixo.data.length > 4 && ` e mais ${baixo.data.length - 4}`}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {[
          ['estoque', 'O que tem'],
          ['movimentos', 'Entradas e saídas'],
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setAba(v)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              aba === v
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {aba === 'estoque' ? (
        <>
          <Cartao className="p-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-56 flex-1">
                <Search size={15} className="absolute top-2.5 left-3 text-slate-400" />
                <Entrada
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Procurar peça…"
                  className="pl-9"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 px-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={soAbaixoMinimo}
                  onChange={(e) => setSoAbaixoMinimo(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Só o que está acabando
              </label>
            </div>
          </Cartao>

          <Cartao>
            {estoque.isLoading ? (
              <Carregando />
            ) : linhasEstoque.length === 0 ? (
              <Vazio
                icone={Boxes}
                titulo="Nenhuma peça cadastrada"
                descricao="Cadastre a peça e lance a primeira compra — o preço médio o sistema calcula sozinho."
              />
            ) : (
              <Tabela>
                <thead>
                  <tr>
                    <Th>Peça</Th>
                    <Th>Fábrica</Th>
                    <Th className="text-right">Tem quantos</Th>
                    <Th className="text-right">Mínimo</Th>
                    <Th className="text-right">Preço médio</Th>
                    <Th className="text-right">Total</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {linhasEstoque.map((e) => {
                    const abaixo = Number(e.quantidade) < Number(e.estoque_minimo)
                    return (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <Td>
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium text-slate-800">{e.peca?.nome}</p>
                              <p className="font-mono text-xs text-slate-400">{e.peca?.codigo}</p>
                            </div>
                            {e.peca?.critica && (
                              <Etiqueta cor="bg-red-100 text-red-700 ring-red-200">crítica</Etiqueta>
                            )}
                          </div>
                        </Td>
                        <Td className="text-slate-600">{e.unidade?.nome}</Td>
                        <Td className="text-right">
                          <span className={abaixo ? 'font-semibold text-red-600' : 'text-slate-800'}>
                            {numero(e.quantidade, 2)} {e.peca?.unidade_medida}
                          </span>
                        </Td>
                        <Td className="text-right text-slate-500">{numero(e.estoque_minimo, 2)}</Td>
                        <Td className="text-right text-slate-600">{moeda(e.custo_medio)}</Td>
                        <Td className="text-right font-medium">
                          {moeda(Number(e.quantidade) * Number(e.custo_medio))}
                        </Td>
                        <Td className="text-right">
                          {ehGestor && (
                            <button
                              onClick={() => {
                                setErro(null)
                                setFormMinimo({
                                  id: e.id,
                                  nome: e.peca?.nome,
                                  estoque_minimo: e.estoque_minimo,
                                  localizacao: e.localizacao || '',
                                })
                              }}
                              className="text-xs font-medium text-sky-600 hover:text-sky-700"
                            >
                              ajustar
                            </button>
                          )}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Tabela>
            )}
          </Cartao>
        </>
      ) : (
        <Cartao>
          <CartaoTitulo>Últimas 100 entradas e saídas</CartaoTitulo>
          {movimentos.isLoading ? (
            <Carregando />
          ) : (movimentos.data || []).length === 0 ? (
            <Vazio titulo="Nada movimentado ainda" descricao="Compras, saídas e acertos de contagem aparecem aqui." />
          ) : (
            <Tabela>
              <thead>
                <tr>
                  <Th>Quando</Th>
                  <Th>Peça</Th>
                  <Th>Tipo</Th>
                  <Th className="text-right">Qtd</Th>
                  <Th className="text-right">Preço da un.</Th>
                  <Th className="text-right">Ficou com</Th>
                  <Th>Nota</Th>
                </tr>
              </thead>
              <tbody>
                {movimentos.data.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <Td className="text-xs whitespace-nowrap text-slate-500">
                      {dataHora(m.criado_em)}
                    </Td>
                    <Td>
                      <p className="text-slate-700">{m.peca?.nome}</p>
                      <p className="text-xs text-slate-400">{m.unidade?.nome}</p>
                    </Td>
                    <Td>
                      <Etiqueta
                        cor={
                          ['entrada', 'devolucao'].includes(m.tipo)
                            ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                            : m.tipo === 'ajuste'
                              ? 'bg-sky-100 text-sky-700 ring-sky-200'
                              : 'bg-amber-100 text-amber-700 ring-amber-200'
                        }
                      >
                        {m.tipo}
                      </Etiqueta>
                    </Td>
                    <Td className="text-right">{numero(m.quantidade, 2)}</Td>
                    <Td className="text-right text-slate-600">{moeda(m.custo_unitario)}</Td>
                    <Td className="text-right text-slate-600">{numero(m.saldo_apos, 2)}</Td>
                    <Td className="text-xs text-slate-500">
                      {m.documento || (m.os_id ? 'OS' : '—')}
                      {m.fornecedor?.nome && (
                        <p className="text-slate-400">{m.fornecedor.nome}</p>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Cartao>
      )}

      {/* ------------------------------------------------------- modais */}
      <Modal
        aberto={modal === 'peca'}
        aoFechar={() => setModal(null)}
        titulo="Cadastrar peça"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>
              Cancelar
            </Botao>
            <Botao
              onClick={salvarPeca}
              carregando={criarPeca.isPending}
              disabled={!formPeca.nome.trim()}
            >
              Cadastrar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Código">
              <Entrada
                value={formPeca.codigo}
                onChange={(e) => setFormPeca((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="Ex.: ROL-6205"
              />
            </Campo>
            <Campo rotulo="Conta em">
              <Selecao
                value={formPeca.unidade_medida}
                onChange={(e) => setFormPeca((f) => ({ ...f, unidade_medida: e.target.value }))}
              >
                {['UN', 'PC', 'M', 'M2', 'KG', 'L', 'CX', 'PAR', 'ROLO'].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>
          <Campo rotulo="Nome *">
            <Entrada
              value={formPeca.nome}
              onChange={(e) => setFormPeca((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Rolamento 6205 ZZ"
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Marca">
              <Entrada
                value={formPeca.fabricante}
                onChange={(e) => setFormPeca((f) => ({ ...f, fabricante: e.target.value }))}
              />
            </Campo>
            <Campo rotulo="Categoria">
              <Entrada
                value={formPeca.categoria}
                onChange={(e) => setFormPeca((f) => ({ ...f, categoria: e.target.value }))}
                placeholder="rolamento, correia, filtro…"
              />
            </Campo>
          </div>
          <Campo rotulo="Onde costuma comprar">
            <Selecao
              value={formPeca.fornecedor_padrao_id}
              onChange={(e) =>
                setFormPeca((f) => ({ ...f, fornecedor_padrao_id: e.target.value }))
              }
            >
              <option value="">—</option>
              {(fornecedores.data || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-red-50 p-3 ring-1 ring-red-200 ring-inset">
            <input
              type="checkbox"
              checked={formPeca.critica}
              onChange={(e) => setFormPeca((f) => ({ ...f, critica: e.target.checked }))}
              className="mt-0.5 size-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm">
              <span className="font-medium text-red-800">Peça que não pode faltar</span>
              <span className="block text-xs text-red-600">
                Se acabar, a produção para.
              </span>
            </span>
          </label>
          <Erro erro={erro} />
        </div>
      </Modal>

      <Modal
        aberto={modal === 'movimento'}
        aoFechar={() => setModal(null)}
        titulo="Entrada ou saída de peça"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(null)}>
              Cancelar
            </Botao>
            <Botao
              onClick={salvarMov}
              carregando={criarMov.isPending}
              disabled={
                !formMov.peca_id || !formMov.unidade_id || !(Number(formMov.quantidade) > 0)
              }
            >
              Registrar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Qual peça *">
              <Selecao
                value={formMov.peca_id}
                onChange={(e) => setFormMov((f) => ({ ...f, peca_id: e.target.value }))}
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
            <Campo rotulo="Qual fábrica *">
              <Selecao
                value={formMov.unidade_id}
                onChange={(e) => setFormMov((f) => ({ ...f, unidade_id: e.target.value }))}
              >
                <option value="">Selecione…</option>
                {(unidades.data || []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>

          <Campo rotulo="O que aconteceu">
            <Selecao
              value={formMov.tipo}
              onChange={(e) => setFormMov((f) => ({ ...f, tipo: e.target.value }))}
            >
              {TIPOS_MOVIMENTO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </Selecao>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Quantas *"
              dica={formMov.tipo === 'ajuste' ? 'No acerto, coloque quanto você contou na prateleira' : undefined}
            >
              <Entrada
                type="number"
                step="0.001"
                min="0.001"
                value={formMov.quantidade}
                onChange={(e) => setFormMov((f) => ({ ...f, quantidade: e.target.value }))}
              />
            </Campo>
            <Campo
              rotulo="Preço da unidade (R$)"
              dica={
                formMov.tipo === 'saida'
                  ? 'Deixe vazio pra usar o preço médio de hoje'
                  : 'Entra na conta do preço médio'
              }
            >
              <Entrada
                type="number"
                step="0.0001"
                min="0"
                value={formMov.custo_unitario}
                onChange={(e) => setFormMov((f) => ({ ...f, custo_unitario: e.target.value }))}
              />
            </Campo>
          </div>

          {formMov.tipo === 'entrada' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Comprou de quem">
                <Selecao
                  value={formMov.fornecedor_id}
                  onChange={(e) => setFormMov((f) => ({ ...f, fornecedor_id: e.target.value }))}
                >
                  <option value="">—</option>
                  {(fornecedores.data || []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo rotulo="Nota fiscal">
                <Entrada
                  value={formMov.documento}
                  onChange={(e) => setFormMov((f) => ({ ...f, documento: e.target.value }))}
                />
              </Campo>
            </div>
          )}

          <Campo rotulo="Observação">
            <Area
              rows={2}
              value={formMov.observacao}
              onChange={(e) => setFormMov((f) => ({ ...f, observacao: e.target.value }))}
            />
          </Campo>

          <Erro erro={erro} />
        </div>
      </Modal>

      <Modal
        aberto={Boolean(formMinimo)}
        aoFechar={() => setFormMinimo(null)}
        titulo="Quando avisar que está acabando"
        largura="max-w-sm"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setFormMinimo(null)}>
              Cancelar
            </Botao>
            <Botao onClick={salvarMinimo} carregando={atualizarEstoque.isPending}>
              Salvar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{formMinimo?.nome}</p>
          <Campo rotulo="Avisar quando tiver menos de" dica="O sistema te avisa quando o saldo cair abaixo disso">
            <Entrada
              type="number"
              step="0.001"
              min="0"
              value={formMinimo?.estoque_minimo ?? ''}
              onChange={(e) => setFormMinimo((f) => ({ ...f, estoque_minimo: e.target.value }))}
              autoFocus
            />
          </Campo>
          <Campo rotulo="Onde fica guardada">
            <Entrada
              value={formMinimo?.localizacao ?? ''}
              onChange={(e) => setFormMinimo((f) => ({ ...f, localizacao: e.target.value }))}
              placeholder="Ex.: Estante B, prateleira 3"
            />
          </Campo>
          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
