import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ClipboardList, Inbox, Boxes, Truck,
  Menu, X, LogOut, CalendarClock, LayoutGrid, MonitorPlay,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTabela } from '../hooks/useDados'

const ITENS = [
  { para: '/', rotulo: 'Resumo', icone: LayoutDashboard, fim: true },
  { para: '/solicitacoes', rotulo: 'Avisos', icone: Inbox, contador: 'solicitacoes' },
  { para: '/os', rotulo: 'Serviços', icone: ClipboardList, contador: 'os' },
  { para: '/ativos', rotulo: 'Máquinas', icone: Package },
  { para: '/planta', rotulo: 'Planta do galpão', icone: LayoutGrid },
  { para: '/tv', rotulo: 'TV do chão de fábrica', icone: MonitorPlay },
  { para: '/almoxarifado', rotulo: 'Peças', icone: Boxes, contador: 'estoque' },
  { para: '/preventiva', rotulo: 'Revisões', icone: CalendarClock },
  { para: '/fornecedores', rotulo: 'Fornecedores', icone: Truck },
]

function Contadores() {
  const solicitacoes = useTabela('solicitacoes_servico', {
    select: 'id',
    filtros: [['status', 'in', ['aberta', 'em_triagem']]],
  })
  const os = useTabela('vw_kpi_os_atrasadas', { select: 'id' })
  const estoque = useTabela('vw_kpi_estoque_baixo', { select: 'estoque_id' })

  return {
    solicitacoes: solicitacoes.data?.length || 0,
    os: os.data?.length || 0,
    estoque: estoque.data?.length || 0,
  }
}

export default function Layout() {
  const { perfil, sair } = useAuth()
  const navegar = useNavigate()
  const [menuAberto, setMenuAberto] = useState(false)
  const contadores = Contadores()

  const sairDoSistema = async () => {
    await sair()
    navegar('/entrar')
  }

  const navegacao = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {ITENS.map(({ para, rotulo, icone: Icone, fim, contador }) => {
        const n = contador ? contadores[contador] : 0
        return (
          <NavLink
            key={para}
            to={para}
            end={fim}
            onClick={() => setMenuAberto(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icone size={17} className="shrink-0" />
            <span className="flex-1">{rotulo}</span>
            {n > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
                {n}
              </span>
            )}
          </NavLink>
        )
      })}
    </nav>
  )

  const rodape = (
    <div className="border-t border-slate-200 p-3">
      <div className="mb-2 px-2">
        <p className="truncate text-sm font-medium text-slate-800">{perfil?.nome}</p>
        <p className="text-xs text-slate-400 capitalize">
          {perfil?.papel}
          {perfil?.unidade?.nome ? ` · ${perfil.unidade.nome}` : ''}
        </p>
      </div>
      <button
        onClick={sairDoSistema}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm
          font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <LogOut size={17} />
        Sair
      </button>
    </div>
  )

  const marca = (
    <div className="flex items-center gap-2.5 px-5 py-4">
      <div className="flex size-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-sky-400">
        S
      </div>
      <div>
        <p className="text-sm leading-tight font-bold text-slate-900">SGAI</p>
        <p className="text-[11px] leading-tight text-slate-400">Ley Colchões</p>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* Barra lateral fixa (desktop) */}
      <aside className="nao-imprimir fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        {marca}
        {navegacao}
        {rodape}
      </aside>

      {/* Gaveta (mobile) */}
      {menuAberto && (
        <div className="nao-imprimir fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuAberto(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-white">
            <div className="flex items-center justify-between pr-3">
              {marca}
              <button onClick={() => setMenuAberto(false)} className="p-2 text-slate-400">
                <X size={20} />
              </button>
            </div>
            {navegacao}
            {rodape}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="nao-imprimir sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setMenuAberto(true)} className="p-1 text-slate-600">
            <Menu size={22} />
          </button>
          <span className="text-sm font-bold text-slate-900">SGAI</span>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
