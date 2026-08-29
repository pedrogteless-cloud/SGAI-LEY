import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Clock3, Maximize, RefreshCw, Wrench } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useTabela } from '../hooks/useDados'
import { M_PRIORIDADE, M_STATUS_OS } from '../lib/constants'
import { Carregando, Erro, Etiqueta } from '../components/ui'

const STATUS_ATIVOS = ['aberta', 'aprovada', 'em_execucao', 'pausada']

function tempoDesde(data) {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 60000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  return horas < 24 ? `${horas} h` : `${Math.floor(horas / 24)} d`
}

export default function ChaoDeFabrica() {
  const cliente = useQueryClient()
  const [agora, setAgora] = useState(Date.now())
  const ordens = useTabela('ordens_servico', { select: 'id, numero, titulo, status, prioridade, aberta_em, ativo:ativos(nome)', filtros: [['status', 'in', STATUS_ATIVOS]], ordem: { coluna: 'aberta_em', asc: true } })
  const ativos = useTabela('ativos', { select: 'id, nome, situacao', filtros: [['situacao', 'in', ['parado', 'em_manutencao']]], ordem: { coluna: 'nome' } })
  const avisos = useTabela('solicitacoes_servico', { select: 'id, numero, descricao, criado_em, ativo:ativos(nome)', filtros: [['status', 'in', ['aberta', 'em_triagem']]], ordem: { coluna: 'criado_em', asc: true } })

  useEffect(() => {
    const atualizar = () => {
      setAgora(Date.now())
      cliente.invalidateQueries({ queryKey: ['ordens_servico'] })
      cliente.invalidateQueries({ queryKey: ['ativos'] })
      cliente.invalidateQueries({ queryKey: ['solicitacoes_servico'] })
    }
    const canal = supabase.channel('tv-chao-de-fabrica')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ativos' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_servico' }, atualizar)
      .subscribe()
    const relogio = window.setInterval(() => setAgora(Date.now()), 60000)
    return () => { window.clearInterval(relogio); supabase.removeChannel(canal) }
  }, [cliente])

  const lista = ordens.data || []
  const resumo = useMemo(() => ({ abertas: lista.length, andamento: lista.filter((o) => o.status === 'em_execucao').length, pausadas: lista.filter((o) => o.status === 'pausada').length, paradas: ativos.data?.length || 0 }), [lista, ativos.data, agora])
  if (ordens.isLoading || ativos.isLoading || avisos.isLoading) return <Carregando texto="Carregando chão de fábrica…" />
  if (ordens.error || ativos.error || avisos.error) return <Erro erro={ordens.error || ativos.error || avisos.error} />

  return (
    <div className="min-h-[calc(100vh-3rem)] space-y-5 bg-slate-950 p-1 text-white sm:p-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">SGAI · Ley Colchões</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Chão de fábrica</h1><p className="mt-1 text-sm text-slate-400">Acompanhamento em tempo real · atualização automática</p></div><button onClick={() => document.documentElement.requestFullscreen?.()} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15" title="Abrir em tela cheia"><Maximize size={16} /> Tela cheia</button></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[[Activity, 'Serviços abertos', resumo.abertas, 'text-sky-400'], [Wrench, 'Em andamento', resumo.andamento, 'text-amber-400'], [Clock3, 'Pausados', resumo.pausadas, 'text-orange-400'], [AlertTriangle, 'Máquinas paradas', resumo.paradas, 'text-red-400']].map(([Icon, label, value, color]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[.06] p-4"><Icon size={20} className={color} /><p className="mt-3 text-sm text-slate-400">{label}</p><p className="text-3xl font-bold">{value}</p></div>)}</div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]"><section className="rounded-xl border border-white/10 bg-white/[.06]"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="font-semibold">Fila da manutenção</h2><RefreshCw size={16} className="text-emerald-400" /></div><div className="divide-y divide-white/10">{lista.length === 0 ? <p className="p-8 text-center text-slate-400">Nenhum serviço pendente</p> : lista.map((o) => <div key={o.id} className="flex items-center gap-3 px-4 py-3"><div className={`size-2 shrink-0 rounded-full ${o.prioridade === 'emergencia' ? 'bg-red-400' : o.status === 'pausada' ? 'bg-orange-400' : 'bg-amber-400'}`} /><div className="min-w-0 flex-1"><p className="truncate font-medium">{o.numero || 'Serviço'} · {o.titulo}</p><p className="truncate text-xs text-slate-400">{o.ativo?.nome || 'Máquina não informada'} · aberto há {tempoDesde(o.aberta_em)}</p></div><Etiqueta cor="bg-white/10 text-slate-200 ring-white/10">{M_STATUS_OS[o.status]?.label || o.status}</Etiqueta><Etiqueta cor={M_PRIORIDADE[o.prioridade]?.cor}>{M_PRIORIDADE[o.prioridade]?.label || o.prioridade}</Etiqueta></div>)}</div></section><section className="rounded-xl border border-white/10 bg-white/[.06]"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="font-semibold">Alertas recentes</h2><span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">{avisos.data?.length || 0}</span></div><div className="divide-y divide-white/10">{(avisos.data || []).slice(0, 6).map((a) => <div key={a.id} className="flex gap-3 px-4 py-3"><AlertTriangle size={17} className="mt-0.5 shrink-0 text-red-400" /><div className="min-w-0"><p className="truncate text-sm font-medium">{a.ativo?.nome || 'Aviso de máquina'}</p><p className="truncate text-xs text-slate-400">{a.descricao || 'Solicitação aguardando triagem'} · {tempoDesde(a.criado_em)}</p></div></div>)}{!avisos.data?.length && <p className="p-8 text-center text-slate-400"><CheckCircle2 className="mx-auto mb-2 text-emerald-400" />Tudo tranquilo</p>}</div></section></div>
      <p className="px-2 text-right text-xs text-slate-500">Última sincronização: agora · sinal em tempo real ativo</p>
    </div>
  )
}
