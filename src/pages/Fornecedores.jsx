import { useMemo, useState } from 'react'
import { Plus, Search, Truck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTabela, useInserir, useAtualizar, useInvalidar } from '../hooks/useDados'
import { moeda, data } from '../lib/format'
import { TIPOS_SERVICO } from '../lib/constants'
import {
  Botao, Cartao, Etiqueta, Carregando, Vazio, Tabela, Th, Td, Entrada, Modal,
  Campo, Area, Erro, useAviso,
} from '../components/ui'

const VAZIO = {
  nome: '', razao_social: '', cnpj: '', contato: '', telefone: '', email: '',
  cidade: '', uf: '', observacoes: '',
}

export default function Fornecedores() {
  const avisar = useAviso()
  const invalidar = useInvalidar()

  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [servicos, setServicos] = useState([])
  const [erro, setErro] = useState(null)

  const fornecedores = useTabela('fornecedores', {
    select: '*, servicos:fornecedor_servicos(tipo_servico)',
    filtros: [['ativo', 'eq', true]],
    ordem: { coluna: 'nome' },
  })
  const gastos = useTabela('vw_kpi_gasto_fornecedor')

  const criar = useInserir('fornecedores')
  const atualizar = useAtualizar('fornecedores')

  const porFornecedor = useMemo(
    () => Object.fromEntries((gastos.data || []).map((g) => [g.fornecedor_id, g])),
    [gastos.data]
  )

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return fornecedores.data || []
    return (fornecedores.data || []).filter((f) =>
      [f.nome, f.razao_social, f.cnpj, f.cidade]
        .filter(Boolean)
        .some((c) => c.toLowerCase().includes(termo))
    )
  }, [fornecedores.data, busca])

  const abrir = (f = null) => {
    setErro(null)
    setEditando(f)
    setForm(
      f
        ? Object.fromEntries(Object.keys(VAZIO).map((k) => [k, f[k] ?? '']))
        : VAZIO
    )
    setServicos(f?.servicos?.map((s) => s.tipo_servico) || [])
    setModal(true)
  }

  const alternarServico = (t) =>
    setServicos((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))

  const salvar = async () => {
    setErro(null)
    const dados = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim?.() === '' ? null : v])
    )
    try {
      const f = editando
        ? await atualizar.mutateAsync({ id: editando.id, ...dados })
        : await criar.mutateAsync(dados)

      await supabase.from('fornecedor_servicos').delete().eq('fornecedor_id', f.id)
      if (servicos.length) {
        await supabase
          .from('fornecedor_servicos')
          .insert(servicos.map((t) => ({ fornecedor_id: f.id, tipo_servico: t })))
      }

      setModal(false)
      invalidar('fornecedores', 'vw_kpi_gasto_fornecedor')
      avisar(editando ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.')
    } catch (e) {
      setErro(e)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fornecedores</h1>
          <p className="text-sm text-slate-500">{lista.length} cadastrados</p>
        </div>
        <Botao onClick={() => abrir()}>
          <Plus size={15} /> Novo fornecedor
        </Botao>
      </div>

      <Cartao className="p-3">
        <div className="relative">
          <Search size={15} className="absolute top-2.5 left-3 text-slate-400" />
          <Entrada
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, CNPJ, cidade…"
            className="pl-9"
          />
        </div>
      </Cartao>

      <Cartao>
        {fornecedores.isLoading ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio
            icone={Truck}
            titulo="Nenhum fornecedor"
            descricao="Cadastre quem faz torno, retífica, solda e venda de peça."
            acao={
              <Botao onClick={() => abrir()}>
                <Plus size={15} /> Cadastrar
              </Botao>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Fornecedor</Th>
                <Th>Serviços</Th>
                <Th>Contato</Th>
                <Th className="text-right">Serviços prestados</Th>
                <Th className="text-right">Gasto total</Th>
                <Th className="text-right">Última</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => {
                const g = porFornecedor[f.id]
                return (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-medium text-slate-800">{f.nome}</p>
                      <p className="text-xs text-slate-400">
                        {[f.cidade, f.uf].filter(Boolean).join('/') || f.cnpj || '—'}
                      </p>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {(f.servicos || []).slice(0, 3).map((s) => (
                          <Etiqueta key={s.tipo_servico}>{s.tipo_servico}</Etiqueta>
                        ))}
                        {(f.servicos || []).length > 3 && (
                          <Etiqueta>+{f.servicos.length - 3}</Etiqueta>
                        )}
                      </div>
                    </Td>
                    <Td className="text-slate-600">
                      <p>{f.contato || '—'}</p>
                      <p className="text-xs text-slate-400">{f.telefone}</p>
                    </Td>
                    <Td className="text-right text-slate-600">{g?.qtd_servicos || 0}</Td>
                    <Td className="text-right font-medium">{moeda(g?.gasto_total)}</Td>
                    <Td className="text-right text-xs text-slate-500">
                      {g?.ultima_transacao ? data(g.ultima_transacao) : '—'}
                    </Td>
                    <Td className="text-right">
                      <button
                        onClick={() => abrir(f)}
                        className="text-xs font-medium text-sky-600 hover:text-sky-700"
                      >
                        editar
                      </button>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        )}
      </Cartao>

      <Modal
        aberto={modal}
        aoFechar={() => setModal(false)}
        titulo={editando ? 'Editar fornecedor' : 'Novo fornecedor'}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(false)}>
              Cancelar
            </Botao>
            <Botao
              onClick={salvar}
              carregando={criar.isPending || atualizar.isPending}
              disabled={!form.nome.trim()}
            >
              Salvar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Nome *">
            <Entrada
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Razão social">
              <Entrada
                value={form.razao_social}
                onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))}
              />
            </Campo>
            <Campo rotulo="CNPJ">
              <Entrada
                value={form.cnpj}
                onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
              />
            </Campo>
            <Campo rotulo="Pessoa de contato">
              <Entrada
                value={form.contato}
                onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
              />
            </Campo>
            <Campo rotulo="Telefone">
              <Entrada
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </Campo>
            <Campo rotulo="E-mail">
              <Entrada
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Campo>
            <div className="grid grid-cols-3 gap-2">
              <Campo rotulo="Cidade" className="col-span-2">
                <Entrada
                  value={form.cidade}
                  onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                />
              </Campo>
              <Campo rotulo="UF">
                <Entrada
                  maxLength={2}
                  value={form.uf}
                  onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))}
                />
              </Campo>
            </div>
          </div>

          <Campo rotulo="Tipos de serviço">
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_SERVICO.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => alternarServico(t)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ring-inset ${
                    servicos.includes(t)
                      ? 'bg-sky-100 text-sky-700 ring-sky-300'
                      : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Campo>

          <Campo rotulo="Observações">
            <Area
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </Campo>

          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
