import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Plus, Users, Copy, Trash2, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTabela, useInvalidar, useUnidades } from '../hooks/useDados'
import { dataHora } from '../lib/format'
import {
  Botao, Cartao, Campo, Entrada, Area, Selecao, Etiqueta, Carregando, Vazio,
  Modal, Erro, useAviso, Segmentado,
} from '../components/ui'

/**
 * Os painéis que o próprio pessoal monta.
 *
 * A diferença pro Resumo e pros Relatórios: aquilo ali foi eu que decidi o
 * que mostrar. Aqui quem decide é quem usa — e cada um monta o que precisa
 * olhar todo dia, sem esperar alguém programar.
 */

const ABAS = [
  { valor: 'meus', rotulo: 'Meus painéis' },
  { valor: 'compartilhados', rotulo: 'Compartilhados comigo' },
]

export default function Paineis() {
  const { perfil } = useAuth()
  const navegar = useNavigate()
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const unidades = useUnidades()

  const [aba, setAba] = useState('meus')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [form, setForm] = useState({ nome: '', descricao: '', unidade_id: '' })

  const paineis = useTabela('vw_paineis', {
    select: 'id, nome, descricao, dono_id, dono_nome, unidade_nome, compartilhado, qtd_blocos, meu, atualizado_em',
    ordem: { coluna: 'atualizado_em', asc: false },
  })

  const lista = (paineis.data || []).filter((p) => (aba === 'meus' ? p.meu : !p.meu))

  const criar = async () => {
    setErro(null)
    if (!form.nome.trim()) { setErro(new Error('Dê um nome ao painel.')); return }
    setEnviando(true)
    const { data, error } = await supabase
      .from('paineis')
      .insert({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        unidade_id: form.unidade_id || null,
        dono_id: perfil.id,
        blocos: [],
      })
      .select('id')
      .single()
    setEnviando(false)
    if (error) { setErro(new Error(error.message)); return }
    setCriando(false)
    setForm({ nome: '', descricao: '', unidade_id: '' })
    invalidar('vw_paineis')
    navegar(`/paineis/${data.id}`)
  }

  const duplicar = async (painel) => {
    // Duplicar traz os blocos, mas o dono passa a ser quem duplicou — é
    // como alguém pega o painel do colega e ajusta pro setor dele sem
    // mexer no original.
    const { data: original, error: erroLeitura } = await supabase
      .from('vw_paineis').select('blocos, descricao, unidade_id').eq('id', painel.id).single()
    if (erroLeitura) { avisar('Não deu pra copiar esse painel.', 'erro'); return }

    const { data, error } = await supabase
      .from('paineis')
      .insert({
        nome: `${painel.nome} (cópia)`,
        descricao: original.descricao,
        unidade_id: original.unidade_id,
        dono_id: perfil.id,
        blocos: original.blocos,
      })
      .select('id').single()
    if (error) { avisar(error.message, 'erro'); return }
    invalidar('vw_paineis')
    navegar(`/paineis/${data.id}`)
  }

  const apagar = async (painel) => {
    if (!window.confirm(`Apagar o painel "${painel.nome}"? Isso não tem volta.`)) return
    const { error } = await supabase.from('paineis').delete().eq('id', painel.id)
    if (error) { avisar(error.message, 'erro'); return }
    avisar('Painel apagado.')
    invalidar('vw_paineis')
  }

  return (
    <div className="entra space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meus painéis</h1>
          <p className="text-sm text-slate-500">Monte a sua própria tela com o que você precisa olhar</p>
        </div>
        <Botao onClick={() => { setErro(null); setCriando(true) }}>
          <Plus size={16} /> Novo painel
        </Botao>
      </div>

      <Segmentado valor={aba} aoMudar={setAba} opcoes={ABAS} className="w-full sm:w-auto" />

      {paineis.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Cartao>
          <Vazio
            icone={LayoutDashboard}
            titulo={aba === 'meus' ? 'Você ainda não montou nenhum painel' : 'Ninguém compartilhou painel com você'}
            descricao={
              aba === 'meus'
                ? 'Um painel é uma tela sua: você escolhe os números, os gráficos e onde cada um fica.'
                : 'Quando alguém marcar um painel como compartilhado, ele aparece aqui.'
            }
            acao={aba === 'meus' && <Botao onClick={() => setCriando(true)}><Plus size={15} /> Criar o primeiro</Botao>}
          />
        </Cartao>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => (
            <Cartao key={p.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/paineis/${p.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 hover:text-sky-700">{p.nome}</p>
                  {p.descricao && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{p.descricao}</p>
                  )}
                </Link>
                {p.compartilhado && (
                  <Etiqueta cor="bg-indigo-100 text-indigo-700 ring-indigo-200">
                    <Users size={11} /> Compartilhado
                  </Etiqueta>
                )}
              </div>

              <p className="mt-2 text-[11px] text-slate-400">
                {p.qtd_blocos} bloco(s)
                {p.unidade_nome ? ` · ${p.unidade_nome}` : ''}
                {!p.meu ? ` · de ${p.dono_nome}` : ''}
              </p>
              <p className="text-[11px] text-slate-400">Mexido em {dataHora(p.atualizado_em)}</p>

              <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3">
                <Link to={`/paineis/${p.id}`} className="flex-1">
                  <Botao tamanho="sm" variante="secundario" className="w-full">
                    {p.meu ? <><Pencil size={13} /> Abrir</> : 'Ver'}
                  </Botao>
                </Link>
                <Botao tamanho="sm" variante="secundario" onClick={() => duplicar(p)} title="Duplicar pra mim">
                  <Copy size={13} />
                </Botao>
                {p.meu && (
                  <Botao tamanho="sm" variante="secundario" onClick={() => apagar(p)} title="Apagar">
                    <Trash2 size={13} />
                  </Botao>
                )}
              </div>
            </Cartao>
          ))}
        </div>
      )}

      <Modal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Novo painel"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setCriando(false)}>Cancelar</Botao>
            <Botao onClick={criar} carregando={enviando}>Criar</Botao>
          </>
        }
      >
        <div className="space-y-3">
          <Campo rotulo="Nome *">
            <Entrada
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Manutenção da semana"
              autoFocus
            />
          </Campo>
          <Campo rotulo="Pra que serve" dica="Opcional — ajuda quem for ver depois">
            <Area
              rows={2}
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </Campo>
          <Campo rotulo="Unidade" dica="Deixe em branco pra ver as duas juntas">
            <Selecao
              value={form.unidade_id}
              onChange={(e) => setForm((f) => ({ ...f, unidade_id: e.target.value }))}
            >
              <option value="">Todas as unidades</option>
              {(unidades.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </Selecao>
          </Campo>
          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
