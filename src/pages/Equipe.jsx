import { useState } from 'react'
import { Users, UserPlus, ShieldCheck, Info, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTabela, useUnidades, useInvalidar } from '../hooks/useDados'
import { data as fmtData } from '../lib/format'
import { PAPEIS, M_PAPEL } from '../lib/constants'
import {
  Botao, Cartao, CartaoTitulo, Campo, Entrada, Selecao, Etiqueta, Carregando, Vazio,
  Modal, Erro, useAviso, Segmentado,
} from '../components/ui'

/**
 * Quem usa o sistema e o que cada um pode.
 *
 * Só gestor abre. A tela mostra por extenso o que cada papel entrega,
 * porque "promover pra técnico" não diz nada pra quem está decidindo — e
 * permissão dada no escuro é a que ninguém revisa depois.
 */

const ABAS = [
  { valor: 'ativos', rotulo: 'Ativos' },
  { valor: 'inativos', rotulo: 'Inativos' },
]

const FORM_VAZIO = {
  nome: '', email: '', senha: '', papel: 'tecnico', unidade_id: '', telefone: '',
}

export default function Equipe() {
  const { ehGestor } = useAuth()
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const unidades = useUnidades()

  const [aba, setAba] = useState('ativos')
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const equipe = useTabela('vw_equipe', { ordem: { coluna: 'nome' }, ativo: ehGestor })

  if (!ehGestor) {
    return (
      <Cartao>
        <Vazio
          icone={ShieldCheck}
          titulo="Só gestor abre esta tela"
          descricao="Quem cria pessoa e muda permissão é o gestor. Se você precisa de outro acesso, peça a ele."
        />
      </Cartao>
    )
  }

  const lista = (equipe.data || []).filter((p) => (aba === 'ativos' ? p.ativo : !p.ativo))

  const criar = async () => {
    setErro(null)
    setEnviando(true)
    // A criação passa por função no servidor: criar conta exige a chave
    // de serviço, e essa chave não pode existir no navegador.
    const { data, error } = await supabase.functions.invoke('criar-usuario', {
      body: {
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha: form.senha,
        papel: form.papel,
        unidade_id: form.unidade_id || null,
        telefone: form.telefone.trim() || null,
      },
    })
    setEnviando(false)

    // O erro de verdade vem no corpo; o `error` do invoke só diz que o
    // status não foi 2xx, sem contar o porquê.
    const mensagem = data?.erro || (error ? 'Não deu pra criar agora. Tente de novo.' : null)
    if (mensagem) { setErro(new Error(mensagem)); return }

    setCriando(false)
    setForm(FORM_VAZIO)
    avisar(`${data.nome} entrou na equipe.`)
    invalidar('vw_equipe')
  }

  const salvarEdicao = async () => {
    setErro(null)
    setEnviando(true)
    const { data: linhas, error } = await supabase.rpc('atualizar_perfil', {
      p_perfil_id: editando.id,
      p_nome: editando.nome,
      p_papel: editando.papel,
      p_unidade_id: editando.unidade_id || null,
      p_limpar_unidade: !editando.unidade_id,
      p_ativo: editando.ativo,
      p_custo_hora: editando.custo_hora === '' ? null : Number(editando.custo_hora),
      p_telefone: editando.telefone || null,
    })
    setEnviando(false)
    if (error) { setErro(new Error(error.message)); return }
    const linha = linhas?.[0]
    if (linha?.mensagem) { setErro(new Error(linha.mensagem)); return }
    setEditando(null)
    avisar('Alterado.')
    invalidar('vw_equipe')
  }

  return (
    <div className="entra space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Equipe</h1>
          <p className="text-sm text-slate-500">Quem usa o sistema e o que cada um pode fazer</p>
        </div>
        <Botao onClick={() => { setErro(null); setForm(FORM_VAZIO); setCriando(true) }}>
          <UserPlus size={16} /> Nova pessoa
        </Botao>
      </div>

      <Segmentado valor={aba} aoMudar={setAba} opcoes={ABAS} className="w-full sm:w-auto" />

      {equipe.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Cartao>
          <Vazio
            icone={Users}
            titulo={aba === 'ativos' ? 'Ninguém ativo ainda' : 'Ninguém inativo'}
            descricao={aba === 'ativos' ? 'Crie a primeira pessoa no botão acima.' : 'Quem for desativado aparece aqui.'}
          />
        </Cartao>
      ) : (
        <Cartao>
          <ul className="divide-y divide-slate-100">
            {lista.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <span className="truncate">{p.nome}</span>
                    {p.sou_eu && (
                      <span className="shrink-0 text-[11px] font-normal text-slate-400">(você)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">{p.email}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                    <span>{p.unidade_nome || 'Todas as unidades'}</span>
                    <span>· desde {fmtData(p.criado_em)}</span>
                    {p.tem_pin && (
                      <span className="inline-flex items-center gap-0.5">
                        · <KeyRound size={10} /> PIN definido
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Etiqueta cor={M_PAPEL[p.papel]?.cor}>{M_PAPEL[p.papel]?.label || p.papel}</Etiqueta>
                  <Botao
                    tamanho="sm"
                    variante="secundario"
                    onClick={() => { setErro(null); setEditando({ ...p, custo_hora: p.custo_hora ?? '' }) }}
                  >
                    Editar
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {/* O que cada papel entrega, por extenso. Promover alguém sem saber
          o que está sendo dado é como se assina o que não se leu. */}
      <Cartao>
        <CartaoTitulo>O que cada papel pode</CartaoTitulo>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {PAPEIS.map((papel) => (
            <div key={papel.valor} className="rounded-lg p-3 ring-1 ring-slate-200 ring-inset">
              <Etiqueta cor={papel.cor}>{papel.label}</Etiqueta>
              <p className="mt-1.5 text-xs font-medium text-slate-700">{papel.resumo}</p>
              <ul className="mt-2 space-y-0.5">
                {papel.pode.map((item) => (
                  <li key={item} className="text-[11px] leading-snug text-slate-500">• {item}</li>
                ))}
              </ul>
              <ul className="mt-1.5 space-y-0.5 border-t border-slate-100 pt-1.5">
                {papel.naoPode.map((item) => (
                  <li key={item} className="text-[11px] leading-snug text-slate-400">✕ {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Cartao>

      <div className="flex max-w-3xl items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 ring-1 ring-slate-200 ring-inset">
        <Info size={15} className="mt-0.5 shrink-0" />
        Não existe apagar pessoa, só desativar. Quem sai deixa serviço lançado, relatório
        assinado e histórico na auditoria — apagar o cadastro deixaria tudo isso órfão.
        Desativado não entra mais, e o que ele fez continua com o nome dele.
      </div>

      {/* ------------------------------------------------- nova pessoa */}
      <Modal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Nova pessoa"
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
              placeholder="Ex.: Rogério Alves"
              autoFocus
            />
          </Campo>
          <Campo rotulo="E-mail *" dica="É com ele que a pessoa entra no sistema">
            <Entrada
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="rogerio@leycolchoes.com.br"
            />
          </Campo>
          <Campo rotulo="Senha provisória *" dica="Mínimo 8 caracteres — passe pra pessoa e peça pra ela trocar">
            <Entrada
              type="text"
              value={form.senha}
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
            />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Papel" dica={M_PAPEL[form.papel]?.resumo}>
              <Selecao value={form.papel} onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value }))}>
                {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.label}</option>)}
              </Selecao>
            </Campo>
            <Campo rotulo="Unidade" dica="Em branco vê as duas">
              <Selecao
                value={form.unidade_id}
                onChange={(e) => setForm((f) => ({ ...f, unidade_id: e.target.value }))}
              >
                <option value="">Todas as unidades</option>
                {(unidades.data || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </Selecao>
            </Campo>
          </div>
          <Campo rotulo="Telefone" dica="Opcional">
            <Entrada
              value={form.telefone}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
            />
          </Campo>
          <Erro erro={erro} />
        </div>
      </Modal>

      {/* ---------------------------------------------------- editar */}
      <Modal
        aberto={Boolean(editando)}
        aoFechar={() => setEditando(null)}
        titulo={editando?.nome || 'Editar'}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
            <Botao onClick={salvarEdicao} carregando={enviando}>Salvar</Botao>
          </>
        }
      >
        {editando && (
          <div className="space-y-3">
            <Campo rotulo="Nome">
              <Entrada
                value={editando.nome}
                onChange={(e) => setEditando((p) => ({ ...p, nome: e.target.value }))}
              />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                rotulo="Papel"
                dica={editando.sou_eu ? 'Você não pode mudar o seu próprio papel' : M_PAPEL[editando.papel]?.resumo}
              >
                <Selecao
                  value={editando.papel}
                  disabled={editando.sou_eu}
                  onChange={(e) => setEditando((p) => ({ ...p, papel: e.target.value }))}
                >
                  {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.label}</option>)}
                </Selecao>
              </Campo>
              <Campo rotulo="Unidade">
                <Selecao
                  value={editando.unidade_id || ''}
                  onChange={(e) => setEditando((p) => ({ ...p, unidade_id: e.target.value }))}
                >
                  <option value="">Todas as unidades</option>
                  {(unidades.data || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </Selecao>
              </Campo>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Telefone">
                <Entrada
                  value={editando.telefone || ''}
                  onChange={(e) => setEditando((p) => ({ ...p, telefone: e.target.value }))}
                />
              </Campo>
              <Campo rotulo="Custo por hora" dica="Entra no custo de mão de obra do serviço">
                <Entrada
                  type="text"
                  inputMode="decimal"
                  value={editando.custo_hora}
                  onChange={(e) => setEditando((p) => ({ ...p, custo_hora: e.target.value }))}
                />
              </Campo>
            </div>
            <Campo rotulo="Situação" dica={editando.sou_eu ? 'Você não pode desativar a si mesmo' : undefined}>
              <Selecao
                value={editando.ativo ? 'sim' : 'nao'}
                disabled={editando.sou_eu}
                onChange={(e) => setEditando((p) => ({ ...p, ativo: e.target.value === 'sim' }))}
              >
                <option value="sim">Ativo — entra no sistema</option>
                <option value="nao">Inativo — não entra mais</option>
              </Selecao>
            </Campo>
            <Erro erro={erro} />
          </div>
        )}
      </Modal>
    </div>
  )
}
