import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Inbox, ArrowRight, X } from 'lucide-react'
import { useTabela, useRpc, useTecnicos, useInvalidar } from '../hooks/useDados'
import { dataHora } from '../lib/format'
import {
  M_STATUS_SOLIC, M_PRIORIDADE, PRIORIDADES, TIPOS_OS,
} from '../lib/constants'
import {
  Botao, Cartao, Etiqueta, Carregando, Vazio, Modal, Campo, Entrada, Selecao, Area, Erro, useAviso,
} from '../components/ui'
import OuvirAudio from '../components/OuvirAudio'

export default function Solicitacoes() {
  const navegar = useNavigate()
  const avisar = useAviso()
  const invalidar = useInvalidar()

  const [filtro, setFiltro] = useState('pendentes')
  const [triagem, setTriagem] = useState(null)
  const [rejeicao, setRejeicao] = useState(null)
  const [erro, setErro] = useState(null)

  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState('corretiva')
  const [prioridade, setPrioridade] = useState('media')
  const [responsavel, setResponsavel] = useState('')
  const [motivo, setMotivo] = useState('')

  const tecnicos = useTecnicos()
  const solicitacoes = useTabela('solicitacoes_servico', {
    select: `*, ativo:ativos(id, codigo, nome, criticidade,
             setor:setores(nome), unidade:unidades(nome))`,
    filtros: filtro === 'pendentes' ? [['status', 'in', ['aberta', 'em_triagem']]] : [],
    ordem: { coluna: 'criado_em', asc: false },
  })

  const converter = useRpc('converter_solicitacao_em_os', [
    'solicitacoes_servico', 'ordens_servico', 'vw_kpi_backlog_os',
  ])
  const rejeitar = useRpc('rejeitar_solicitacao', ['solicitacoes_servico'])

  const abrirTriagem = (s) => {
    setErro(null)
    setTitulo((s.descricao || `Problema relatado por áudio · ${s.ativo?.nome ?? ''}`).slice(0, 120))
    setTipo('corretiva')
    setPrioridade(s.prioridade)
    setResponsavel('')
    setTriagem(s)
  }

  const confirmarTriagem = async () => {
    setErro(null)
    try {
      const osId = await converter.mutateAsync({
        p_solicitacao: triagem.id,
        p_titulo: titulo.trim(),
        p_tipo: tipo,
        p_prioridade: prioridade,
        p_responsavel: responsavel || null,
      })
      setTriagem(null)
      avisar('Serviço aberto.')
      invalidar('solicitacoes_servico', 'ordens_servico')
      navegar(`/os/${osId}`)
    } catch (e) {
      setErro(e)
    }
  }

  const confirmarRejeicao = async () => {
    setErro(null)
    try {
      await rejeitar.mutateAsync({ p_solicitacao: rejeicao.id, p_motivo: motivo.trim() })
      setRejeicao(null)
      setMotivo('')
      avisar('Aviso recusado.')
    } catch (e) {
      setErro(e)
    }
  }

  const lista = solicitacoes.data || []

  return (
    <div className="entra space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Avisos de problema</h1>
          <p className="text-sm text-slate-500">
            O que a produção avisou pelo QR — você decide o que vira serviço
          </p>
        </div>
        <Selecao
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-auto min-w-44"
        >
          <option value="pendentes">Esperando você olhar</option>
          <option value="todas">Todos</option>
        </Selecao>
      </div>

      {solicitacoes.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Cartao>
          <Vazio
            icone={Inbox}
            titulo="Nada esperando"
            descricao="Quando alguém ler o QR de uma máquina e avisar um problema, aparece aqui."
          />
        </Cartao>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lista.map((s) => (
            <Cartao key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      {s.numero}
                    </span>
                    <Etiqueta cor={M_STATUS_SOLIC[s.status]?.cor}>
                      {M_STATUS_SOLIC[s.status]?.label}
                    </Etiqueta>
                    <Etiqueta cor={M_PRIORIDADE[s.prioridade]?.cor}>
                      {M_PRIORIDADE[s.prioridade]?.label}
                    </Etiqueta>
                    {s.maquina_parada && (
                      <Etiqueta cor="bg-red-100 text-red-700 ring-red-200">máquina parada</Etiqueta>
                    )}
                  </div>

                  <Link
                    to={`/ativos/${s.ativo?.id}`}
                    className="mt-2 block font-medium text-slate-800 hover:text-sky-700"
                  >
                    {s.ativo?.nome}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {s.ativo?.codigo} · {s.ativo?.setor?.nome || s.ativo?.unidade?.nome}
                  </p>

                  {s.descricao && <p className="mt-2 text-sm text-slate-600">{s.descricao}</p>}
                  {s.audio_url && (
                    <div className="mt-2">
                      <OuvirAudio url={s.audio_url} segundos={s.audio_segundos} />
                      {!s.descricao && (
                        <p className="mt-1.5 text-xs text-slate-400">
                          Sem texto — o relato está no áudio
                        </p>
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    {dataHora(s.criado_em)}
                    {s.solicitante_nome ? ` · por ${s.solicitante_nome}` : ''}
                  </p>
                  {s.motivo_rejeicao && (
                    <p className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
                      Recusado: {s.motivo_rejeicao}
                    </p>
                  )}
                </div>
              </div>

              {['aberta', 'em_triagem'].includes(s.status) && (
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                  <Botao tamanho="sm" onClick={() => abrirTriagem(s)}>
                    Virar serviço <ArrowRight size={14} />
                  </Botao>
                  <Botao
                    tamanho="sm"
                    variante="secundario"
                    onClick={() => {
                      setErro(null)
                      setMotivo('')
                      setRejeicao(s)
                    }}
                  >
                    <X size={14} /> Recusar
                  </Botao>
                </div>
              )}
            </Cartao>
          ))}
        </div>
      )}

      <Modal
        aberto={Boolean(triagem)}
        aoFechar={() => setTriagem(null)}
        titulo="Abrir serviço"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setTriagem(null)}>
              Cancelar
            </Botao>
            <Botao
              onClick={confirmarTriagem}
              carregando={converter.isPending}
              disabled={!titulo.trim()}
            >
              Abrir OS
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{triagem?.ativo?.nome}</p>
            {triagem?.descricao && <p className="mt-1">{triagem.descricao}</p>}
            {triagem?.audio_url && (
              <div className="mt-2">
                <OuvirAudio url={triagem.audio_url} segundos={triagem.audio_segundos} />
              </div>
            )}
          </div>

          <Campo rotulo="Nome do serviço">
            <Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Que tipo de serviço">
              <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS_OS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Urgência">
              <Selecao value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                {PRIORIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.label}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>

          <Campo rotulo="Quem vai fazer" dica="Pode deixar pra decidir depois">
            <Selecao value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">— decido depois —</option>
              {(tecnicos.data || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Erro erro={erro} />
        </div>
      </Modal>

      <Modal
        aberto={Boolean(rejeicao)}
        aoFechar={() => setRejeicao(null)}
        titulo="Recusar aviso"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setRejeicao(null)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              onClick={confirmarRejeicao}
              carregando={rejeitar.isPending}
              disabled={!motivo.trim()}
            >
              Recusar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Por que não é caso de serviço?" dica="Fica registrado">
            <Area
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: não era defeito, só faltava regular a máquina"
              autoFocus
            />
          </Campo>
          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
