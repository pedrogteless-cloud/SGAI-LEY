import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ClipboardList, Inbox, Boxes, Truck,
  Menu, X, LogOut, CalendarClock, LayoutGrid, MonitorPlay, BellRing, FileSpreadsheet, Moon, Sun,
  KeyRound,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTabela } from '../hooks/useDados'
import DefinirPin from './DefinirPin'

// Agrupado por assunto, não por ordem de criação — assim quem procura
// "onde mexo nas peças" ou "onde vejo a planta" acha mais rápido do
// que numa lista corrida de 11 itens.
const GRUPOS = [
  {
    titulo: null,
    itens: [{ para: '/', rotulo: 'Resumo', icone: LayoutDashboard, fim: true }],
  },
  {
    titulo: 'Atendimento',
    itens: [
      { para: '/solicitacoes', rotulo: 'Avisos', icone: Inbox, contador: 'solicitacoes' },
      { para: '/os', rotulo: 'Serviços', icone: ClipboardList, contador: 'os' },
      { para: '/preventiva', rotulo: 'Revisões', icone: CalendarClock },
    ],
  },
  {
    titulo: 'Ativos',
    itens: [
      { para: '/ativos', rotulo: 'Máquinas', icone: Package },
      { para: '/planta', rotulo: 'Planta do galpão', icone: LayoutGrid },
      { para: '/tv', rotulo: 'TV do chão de fábrica', icone: MonitorPlay },
    ],
  },
  {
    titulo: 'Estoque',
    itens: [
      { para: '/almoxarifado', rotulo: 'Peças', icone: Boxes, contador: 'estoque' },
      { para: '/fornecedores', rotulo: 'Fornecedores', icone: Truck },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [
      { para: '/alertas', rotulo: 'Alertas', icone: BellRing },
      { para: '/relatorios', rotulo: 'Relatórios', icone: FileSpreadsheet },
    ],
  },
]

const ITENS = GRUPOS.flatMap((g) => g.itens)

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
  const { perfil, ehGestor, ehTecnico, sair } = useAuth()
  const navegar = useNavigate()
  const local = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)
  const [pinAberto, setPinAberto] = useState(false)
  const [escuro, setEscuro] = useState(() => localStorage.getItem('sgai-tema') === 'escuro')
  const contadores = Contadores()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', escuro)
    localStorage.setItem('sgai-tema', escuro ? 'escuro' : 'claro')
  }, [escuro])

  useEffect(() => {
    setMenuAberto(false)
  }, [local.pathname])

  const sairDoSistema = async () => {
    await sair()
    navegar('/entrar')
  }

  const paginaAtual =
    [...ITENS].sort((a, b) => b.para.length - a.para.length)
      .find((item) => (item.fim ? local.pathname === item.para : local.pathname.startsWith(item.para)))
      ?.rotulo || 'SGAI'

  const navegacao = (
    <nav className="flex flex-1 flex-col gap-3 px-3">
      {GRUPOS.map((grupo, i) => (
        <div key={grupo.titulo || `g${i}`} className="flex flex-col gap-0.5">
          {grupo.titulo && (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              {grupo.titulo}
            </p>
          )}
          {grupo.itens.map(({ para, rotulo, icone: Icone, fim, contador }) => {
            const n = contador ? contadores[contador] : 0
            return (
              <NavLink
                key={para}
                to={para}
                end={fim}
                viewTransition
                onClick={() => setMenuAberto(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                   transition-colors duration-150 ${
                    isActive
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icone size={17} className="shrink-0 transition-transform duration-150 group-hover:scale-110" />
                <span className="flex-1">{rotulo}</span>
                {n > 0 && (
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
                    {n}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      ))}
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
      {(ehGestor || ehTecnico) && (
        <button
          onClick={() => setPinAberto(true)}
          className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          title="PIN pra lançar gasto pelo QR da máquina"
        >
          <KeyRound size={17} /> PIN de campo
        </button>
      )}
      <button onClick={() => setEscuro((valor) => !valor)} className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900" title={escuro ? 'Usar modo claro' : 'Usar modo escuro'}>
        {escuro ? <Sun size={17} /> : <Moon size={17} />} {escuro ? 'Modo claro' : 'Modo escuro'}
      </button>
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
          <aside className="relative flex h-full w-64 flex-col overflow-y-auto bg-white">
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
          <span className="text-sm font-bold text-slate-900">{paginaAtual}</span>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <DefinirPin aberto={pinAberto} aoFechar={() => setPinAberto(false)} />
    </div>
  )
}
