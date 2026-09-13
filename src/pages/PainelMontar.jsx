import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Save, Eye, Pencil, Users, RotateCcw, Check,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRegistro, useInvalidar, useUnidades } from '../hooks/useDados'
import { hojeISO } from '../lib/tempo'
import { limitesPeriodo, PERIODOS } from '../lib/chaoIndicadores'
import { vagaParaNovo, removerBloco, TAMANHO_PADRAO } from '../lib/painelGrade'
import GradePainel from '../components/painel/GradePainel'
import BlocoConteudo from '../components/painel/BlocoConteudo'
import EditorBloco, { TIPOS_BLOCO } from '../components/painel/EditorBloco'
import {
  Botao, Cartao, Carregando, Vazio, Selecao, Entrada, Etiqueta, useAviso,
} from '../components/ui'

/**
 * O montador de um painel.
 *
 * Dois modos no mesmo lugar: montando (arrasta, edita, salva) e vendo
 * (só os dados). Quem não é dono só vê — compartilhar dá vista, não
 * caneta, senão dois gestores arrastando o mesmo bloco se sobrescreveriam
 * em silêncio, já que o layout salva como documento inteiro.
 */

const novoBloco = (tipo, blocos) => {
  const tamanho = TAMANHO_PADRAO[tipo] || { w: 4, h: 3 }
  return {
    // crypto.randomUUID existe em todo navegador que roda este app e
    // evita id repetido quando dois blocos nascem no mesmo milissegundo.
    id: crypto.randomUUID(),
    tipo,
    titulo: TIPOS_BLOCO.find((t) => t.valor === tipo)?.rotulo || 'Bloco',
    operacao: tipo === 'lista' || tipo === 'texto' ? undefined : 'contar',
    filtros: [],
    colunas: [],
    ...vagaParaNovo(blocos, tamanho),
  }
}

export default function PainelMontar() {
  const { id } = useParams()
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const unidades = useUnidades()

  const painel = useRegistro('vw_paineis', id)
  const registro = painel.data

  const [blocos, setBlocos] = useState(null)
  const [montando, setMontando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [sujo, setSujo] = useState(false)

  const [periodo, setPeriodo] = useState('mes')
  const [personalizado, setPersonalizado] = useState({ inicio: '', fim: hojeISO() })
  const [unidadeId, setUnidadeId] = useState('')

  // O layout salvo vira estado local uma vez; a partir daí quem manda é a
  // tela, senão um refetch no meio da montagem desfaria o que a pessoa
  // acabou de arrastar.
  useEffect(() => {
    if (registro && blocos === null) {
      setBlocos(Array.isArray(registro.blocos) ? registro.blocos : [])
      setUnidadeId(registro.unidade_id || '')
    }
  }, [registro, blocos])

  const limites = useMemo(() => limitesPeriodo(periodo, personalizado), [periodo, personalizado])
  const contexto = useMemo(
    () => ({ unidadeId: unidadeId || null, inicio: limites.inicio, fim: limites.fim }),
    [unidadeId, limites]
  )

  const meu = registro?.meu
  const mudarBlocos = (proximos) => { setBlocos(proximos); setSujo(true) }

  const salvar = async () => {
    setSalvando(true)
    const { error } = await supabase
      .from('paineis')
      .update({ blocos, unidade_id: unidadeId || null })
      .eq('id', id)
    setSalvando(false)
    if (error) { avisar(error.message, 'erro'); return }
    setSujo(false)
    avisar('Painel salvo.')
    invalidar('vw_paineis')
  }

  const alternarCompartilhado = async () => {
    const { error } = await supabase
      .from('paineis').update({ compartilhado: !registro.compartilhado }).eq('id', id)
    if (error) { avisar(error.message, 'erro'); return }
    avisar(registro.compartilhado ? 'Painel voltou a ser só seu.' : 'Painel compartilhado — os outros podem ver.')
    invalidar('vw_paineis')
    painel.refetch?.()
  }

  const descartar = () => {
    setBlocos(Array.isArray(registro.blocos) ? registro.blocos : [])
    setSujo(false)
    setMontando(false)
  }

  if (painel.isLoading) return <Carregando />
  // A ordem importa: checar `blocos === null` antes de checar se o painel
  // existe deixava a tela em "Carregando" pra sempre quando o painel tinha
  // sido apagado — o efeito que preenche `blocos` nunca rodaria.
  if (!registro) {
    return (
      <Cartao>
        <Vazio
          titulo="Painel não encontrado"
          descricao="Ele pode ter sido apagado, ou deixou de ser compartilhado com você."
          acao={<Link to="/paineis"><Botao variante="secundario">Voltar</Botao></Link>}
        />
      </Cartao>
    )
  }
  if (blocos === null) return <Carregando />

  return (
    <div className="entra space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/paineis" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
            <ArrowLeft size={13} /> Painéis
          </Link>
          <h1 className="mt-0.5 flex items-center gap-2 text-xl font-bold text-slate-900">
            <span className="truncate">{registro.nome}</span>
            {registro.compartilhado && (
              <Etiqueta cor="bg-indigo-100 text-indigo-700 ring-indigo-200">
                <Users size={11} /> Compartilhado
              </Etiqueta>
            )}
          </h1>
          {registro.descricao && <p className="text-sm text-slate-500">{registro.descricao}</p>}
          {!meu && (
            <p className="mt-0.5 text-xs text-slate-400">
              Painel de {registro.dono_nome} — você pode ver e duplicar, mas não mexer.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {meu && (
            <>
              <Botao
                variante="secundario"
                onClick={() => setMontando((m) => !m)}
                title={montando ? 'Ver como fica' : 'Mexer no painel'}
              >
                {montando ? <><Eye size={15} /> Ver</> : <><Pencil size={15} /> Montar</>}
              </Botao>
              {sujo && (
                <>
                  <Botao variante="secundario" onClick={descartar} title="Voltar como estava salvo">
                    <RotateCcw size={15} />
                  </Botao>
                  <Botao onClick={salvar} carregando={salvando}><Save size={15} /> Salvar</Botao>
                </>
              )}
              {!sujo && montando && (
                <Botao variante="secundario" onClick={alternarCompartilhado}>
                  <Users size={15} /> {registro.compartilhado ? 'Deixar privado' : 'Compartilhar'}
                </Botao>
              )}
            </>
          )}
        </div>
      </div>

      {/* Período e unidade valem pro painel inteiro: mudar aqui reflete em
          todo bloco que tenha data ou unidade, sem reconfigurar um por um. */}
      <Cartao className="flex flex-wrap items-center gap-2 p-3">
        <Selecao value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-auto">
          {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
        </Selecao>
        {periodo === 'personalizado' && (
          <>
            <Entrada
              type="date" className="w-auto" max={hojeISO()} value={personalizado.inicio}
              onChange={(e) => setPersonalizado((p) => ({ ...p, inicio: e.target.value }))}
            />
            <Entrada
              type="date" className="w-auto" max={hojeISO()} value={personalizado.fim}
              onChange={(e) => setPersonalizado((p) => ({ ...p, fim: e.target.value }))}
            />
          </>
        )}
        <Selecao
          value={unidadeId}
          onChange={(e) => { setUnidadeId(e.target.value); if (meu) setSujo(true) }}
          className="w-auto"
        >
          <option value="">Todas as unidades</option>
          {(unidades.data || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </Selecao>
        <span className="ml-auto text-xs text-slate-400">
          {blocos.length} bloco(s){sujo ? ' · não salvo' : ''}
        </span>
      </Cartao>

      {montando && (
        <Cartao className="p-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">Adicionar bloco</p>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_BLOCO.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => {
                  const bloco = novoBloco(t.valor, blocos)
                  mudarBlocos([...blocos, bloco])
                  setEditando(bloco)
                }}
                title={t.dica}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5
                  text-xs font-medium text-slate-700 transition hover:bg-sky-100 hover:text-sky-700"
              >
                <Plus size={13} /> {t.rotulo}
              </button>
            ))}
          </div>
        </Cartao>
      )}

      {blocos.length === 0 ? (
        <Cartao>
          <Vazio
            icone={Plus}
            titulo="Painel em branco"
            descricao={
              meu
                ? 'Entre em "Montar" e escolha os blocos. Depois é só arrastar cada um pro lugar que quiser.'
                : 'O dono ainda não colocou nada aqui.'
            }
            acao={meu && !montando && <Botao onClick={() => setMontando(true)}><Pencil size={15} /> Montar</Botao>}
          />
        </Cartao>
      ) : (
        <GradePainel
          blocos={blocos}
          aoMudar={mudarBlocos}
          montando={montando && meu}
          aoEditar={setEditando}
          aoDuplicar={(b) => {
            const copia = { ...b, id: crypto.randomUUID(), ...vagaParaNovo(blocos, { w: b.w, h: b.h }) }
            mudarBlocos([...blocos, copia])
          }}
          aoRemover={(b) => mudarBlocos(removerBloco(blocos, b.id))}
          renderizar={(bloco) => <BlocoConteudo bloco={bloco} contexto={contexto} />}
        />
      )}

      <EditorBloco
        bloco={editando}
        aberto={Boolean(editando)}
        aoFechar={() => setEditando(null)}
        aoSalvar={(atualizado) => {
          mudarBlocos(blocos.map((b) => (b.id === atualizado.id ? atualizado : b)))
          setEditando(null)
        }}
      />

      {/* Barra de salvar presa embaixo: no celular o botão lá de cima já
          saiu da tela quando a pessoa termina de mexer. */}
      {sujo && meu && (
        <div className="nao-imprimir area-segura-base fixed inset-x-0 bottom-0 z-30 flex items-center
          justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <span className="text-xs text-slate-500">Você mexeu no painel</span>
          <div className="flex gap-2">
            <Botao tamanho="sm" variante="secundario" onClick={descartar}>Descartar</Botao>
            <Botao tamanho="sm" onClick={salvar} carregando={salvando}><Check size={14} /> Salvar</Botao>
          </div>
        </div>
      )}
    </div>
  )
}
