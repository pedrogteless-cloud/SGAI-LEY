import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, PlayCircle, Search, Volume2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTabela } from '../hooks/useDados'
import { SONS, tocarSom } from '../lib/sons'
import { EVENTOS_ALERTA } from '../lib/eventosAlerta'
import { Cartao, CartaoTitulo, Carregando, Entrada, Erro, Selecao, useAviso } from '../components/ui'

function usePreferencias(perfilId) {
  const cliente = useQueryClient()
  const consulta = useTabela('alerta_preferencias', {
    filtros: [['perfil_id', 'eq', perfilId]],
    ativo: Boolean(perfilId),
  })

  const salvar = useMutation({
    mutationFn: async ({ evento, campos }) =>
      supabase
        .from('alerta_preferencias')
        .upsert({ perfil_id: perfilId, evento, ...campos }, { onConflict: 'perfil_id,evento' })
        .then(({ error }) => {
          if (error) throw new Error(error.message)
        }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['alerta_preferencias'] }),
  })

  return { consulta, salvar }
}

function useSilenciados(perfilId) {
  const cliente = useQueryClient()
  const consulta = useTabela('alerta_ativos_silenciados', {
    filtros: [['perfil_id', 'eq', perfilId]],
    ativo: Boolean(perfilId),
  })

  const alternar = useMutation({
    mutationFn: async ({ ativoId, silenciar }) =>
      silenciar
        ? supabase
            .from('alerta_ativos_silenciados')
            .insert({ perfil_id: perfilId, ativo_id: ativoId })
            .then(({ error }) => {
              if (error) throw new Error(error.message)
            })
        : supabase
            .from('alerta_ativos_silenciados')
            .delete()
            .eq('perfil_id', perfilId)
            .eq('ativo_id', ativoId)
            .then(({ error }) => {
              if (error) throw new Error(error.message)
            }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['alerta_ativos_silenciados'] }),
  })

  return { consulta, alternar }
}

const SITUACAO_ROTULO = {
  operando: 'Operando',
  parado: 'Parada',
  em_manutencao: 'Em manutenção',
  reserva: 'Reserva',
  baixado: 'Baixado',
}

export default function Alertas() {
  const { perfil } = useAuth()
  const [busca, setBusca] = useState('')
  const avisar = useAviso()

  const { consulta: prefs, salvar } = usePreferencias(perfil?.id)
  const { consulta: silenciados, alternar } = useSilenciados(perfil?.id)
  const ativos = useTabela('ativos', {
    select: 'id, nome, situacao',
    filtros: [['ativo', 'eq', true]],
    ordem: { coluna: 'nome' },
  })

  const mapaPrefs = useMemo(() => {
    const m = {}
    for (const p of prefs.data || []) m[p.evento] = p
    return m
  }, [prefs.data])

  const idsSilenciados = useMemo(
    () => new Set((silenciados.data || []).map((s) => s.ativo_id)),
    [silenciados.data]
  )

  const listaMaquinas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const base = ativos.data || []
    return termo ? base.filter((a) => a.nome.toLowerCase().includes(termo)) : base
  }, [ativos.data, busca])

  const definirCampo = (evento, campos) => {
    salvar.mutate(
      { evento, campos },
      { onError: (e) => avisar(`Não consegui salvar: ${e.message}`, 'erro') }
    )
  }

  if (!perfil) return <Carregando />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Alertas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Escolha o som de cada evento e quais máquinas você não quer ouvir. Vale para a TV do
          chão de fábrica e para qualquer tela sua com o SGAI aberto.
        </p>
      </div>

      <Cartao>
        <CartaoTitulo>Eventos</CartaoTitulo>
        <div className="divide-y divide-slate-100">
          {EVENTOS_ALERTA.map(({ evento, icone: Icone, cor, titulo, descricao, somPadrao }) => {
            const pref = mapaPrefs[evento]
            const ligado = pref ? pref.ativo : true
            const som = pref?.som || somPadrao
            return (
              <div key={evento} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <Icone size={19} className={`shrink-0 ${cor}`} />
                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm font-medium text-slate-800">{titulo}</p>
                  <p className="text-xs text-slate-400">{descricao}</p>
                </div>

                <Selecao
                  value={som}
                  disabled={!ligado}
                  onChange={(e) => definirCampo(evento, { som: e.target.value, ativo: ligado })}
                  className="!w-auto"
                >
                  {SONS.map((s) => (
                    <option key={s.valor} value={s.valor}>
                      {s.rotulo}
                    </option>
                  ))}
                </Selecao>

                <button
                  type="button"
                  onClick={() => tocarSom(som)}
                  title="Testar som"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Volume2 size={17} />
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={ligado}
                  onClick={() => definirCampo(evento, { som, ativo: !ligado })}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    ligado ? 'bg-sky-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                      ligado ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </div>
      </Cartao>

      <Cartao>
        <CartaoTitulo>Máquinas silenciadas</CartaoTitulo>
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="relative">
            <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
            <Entrada
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar máquina…"
              className="pl-8"
            />
          </div>
        </div>

        {ativos.error && <div className="p-4"><Erro erro={ativos.error} /></div>}
        {ativos.isLoading ? (
          <Carregando texto="Carregando máquinas…" />
        ) : (
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {listaMaquinas.map((m) => {
              const silenciada = idsSilenciados.has(m.id)
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{m.nome}</p>
                    <p className="text-xs text-slate-400">{SITUACAO_ROTULO[m.situacao] || m.situacao}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => alternar.mutate({ ativoId: m.id, silenciar: !silenciada })}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                      silenciada
                        ? 'bg-slate-100 text-slate-500 ring-slate-200'
                        : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {silenciada ? <Ban size={13} /> : <PlayCircle size={13} />}
                    {silenciada ? 'Silenciada' : 'Silenciar'}
                  </button>
                </div>
              )
            })}
            {!listaMaquinas.length && (
              <p className="p-8 text-center text-sm text-slate-400">Nenhuma máquina encontrada</p>
            )}
          </div>
        )}
      </Cartao>
    </div>
  )
}
