import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Recycle } from 'lucide-react'
import { useTabela, useInserir, useAtualizar } from '../hooks/useDados'
import { UNIDADES_MEDIDA_RESIDUO } from '../lib/constants'
import {
  Botao, Cartao, Etiqueta, Carregando, Vazio, Tabela, Th, Td, Entrada, Selecao,
  Modal, Campo, Erro, useAviso,
} from '../components/ui'

const VAZIO = { nome: '', categoria: '', unidade_principal: 'kg', permite_reaproveitamento: true }

export default function MateriaisResiduo() {
  const avisar = useAviso()
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState(null)

  const materiais = useTabela('materiais_residuo', { ordem: { coluna: 'nome' } })
  const criar = useInserir('materiais_residuo')
  const atualizar = useAtualizar('materiais_residuo')

  const abrir = (m = null) => {
    setErro(null)
    setEditando(m)
    setForm(
      m
        ? { nome: m.nome, categoria: m.categoria, unidade_principal: m.unidade_principal, permite_reaproveitamento: m.permite_reaproveitamento }
        : VAZIO
    )
    setModal(true)
  }

  const salvar = async () => {
    setErro(null)
    if (!form.nome.trim() || !form.categoria.trim()) {
      setErro(new Error('Nome e categoria são obrigatórios.'))
      return
    }
    try {
      const dados = { ...form, nome: form.nome.trim(), categoria: form.categoria.trim() }
      if (editando) await atualizar.mutateAsync({ id: editando.id, ...dados })
      else await criar.mutateAsync(dados)
      setModal(false)
      avisar(editando ? 'Material atualizado.' : 'Material cadastrado.')
    } catch (e) {
      setErro(e)
    }
  }

  const alternarAtivo = (m) => atualizar.mutate({ id: m.id, ativo: !m.ativo })

  return (
    <div className="entra space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/desperdicios">
            <Botao variante="fantasma" tamanho="sm"><ArrowLeft size={16} /></Botao>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Materiais controlados</h1>
            <p className="text-sm text-slate-500">Cadastro usado nos lançamentos de desperdício e reaproveitamento</p>
          </div>
        </div>
        <Botao onClick={() => abrir()}>
          <Plus size={15} /> Novo material
        </Botao>
      </div>

      <Cartao>
        {materiais.isLoading ? (
          <Carregando />
        ) : (materiais.data || []).length === 0 ? (
          <Vazio icone={Recycle} titulo="Nenhum material cadastrado" />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Material</Th>
                <Th>Categoria</Th>
                <Th>Unidade principal</Th>
                <Th>Reaproveitável</Th>
                <Th>Situação</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {materiais.data.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{m.nome}</Td>
                  <Td className="text-slate-600">{m.categoria}</Td>
                  <Td className="text-slate-600">
                    {UNIDADES_MEDIDA_RESIDUO.find((u) => u.valor === m.unidade_principal)?.label}
                  </Td>
                  <Td>
                    <Etiqueta cor={m.permite_reaproveitamento ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}>
                      {m.permite_reaproveitamento ? 'Sim' : 'Não'}
                    </Etiqueta>
                  </Td>
                  <Td>
                    <button onClick={() => alternarAtivo(m)}>
                      <Etiqueta cor={m.ativo ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}>
                        {m.ativo ? 'Ativo' : 'Inativo'}
                      </Etiqueta>
                    </button>
                  </Td>
                  <Td className="text-right">
                    <button onClick={() => abrir(m)} className="text-xs font-medium text-sky-600 hover:text-sky-700">
                      editar
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>

      <Modal
        aberto={modal}
        aoFechar={() => setModal(false)}
        titulo={editando ? 'Editar material' : 'Novo material'}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(false)}>Cancelar</Botao>
            <Botao onClick={salvar} carregando={criar.isPending || atualizar.isPending}>Salvar</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Nome *">
            <Entrada value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </Campo>
          <Campo rotulo="Categoria *" dica="Texto livre — ex.: Espuma, Tecido, EPS">
            <Entrada value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />
          </Campo>
          <Campo rotulo="Unidade principal">
            <Selecao value={form.unidade_principal} onChange={(e) => setForm((f) => ({ ...f, unidade_principal: e.target.value }))}>
              {UNIDADES_MEDIDA_RESIDUO.map((u) => <option key={u.valor} value={u.valor}>{u.label}</option>)}
            </Selecao>
          </Campo>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.permite_reaproveitamento}
              onChange={(e) => setForm((f) => ({ ...f, permite_reaproveitamento: e.target.checked }))}
            />
            Permite reaproveitamento
          </label>
          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
