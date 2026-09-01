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
import logoLey from '../assets/logo-ley.jpg'

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
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-1">
      {GRUPOS.map((grupo, i) => (
        <div key={grupo.titulo || `g${i}`} className="flex flex-col gap-0.5">
          {grupo.titulo && (
            <p className="px-3 pb-1.5 text-[10px] font-bold tracking-[0.1em] text-slate-400 uppercase">
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
                style={{ transitionTimingFunction: 'var(--ease-mola)' }}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm
                   transition-all duration-200 ${
                    isActive
                      ? 'bg-sky-50 font-semibold text-sky-700'
                      : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Fio vertical na borda esquerda do item ativo: marca
                        onde você está sem precisar gritar com cor. */}
                    <span
                      aria-hidden
                      className={`absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-sky-500
                        transition-all duration-300 ${isActive ? 'opacity-100' : 'scale-y-0 opacity-0'}`}
                      style={{ transitionTimingFunction: 'var(--ease-mola)' }}
                    />
                    <Icone
                      size={17}
                      strokeWidth={isActive ? 2.2 : 1.85}
                      className="shrink-0 transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
                    />
                    <span className="flex-1 truncate">{rotulo}</span>
                    {n > 0 && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700 tabular-nums">
                        {n}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      ))}
    </nav>
  )

  const iniciais = (perfil?.nome || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  const botaoRodape = `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
    text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900
    active:scale-[0.98]`

  const rodape = (
    <div className="p-3" style={{ borderTop: '1px solid var(--traco)' }}>
      <div className="mb-2 flex items-center gap-2.5 px-2 py-1">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br
            from-sky-500 to-indigo-600 text-[11px] font-bold text-white"
          style={{ boxShadow: '0 2px 6px -1px rgb(2 132 199 / 0.45)' }}
        >
          {iniciais}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{perfil?.nome}</p>
          <p className="truncate text-xs text-slate-400 capitalize">
            {perfil?.papel}
            {perfil?.unidade?.nome ? ` · ${perfil.unidade.nome}` : ''}
          </p>
        </div>
      </div>
      {(ehGestor || ehTecnico) && (
        <button
          onClick={() => setPinAberto(true)}
          className={`mb-0.5 ${botaoRodape}`}
          title="PIN pra lançar gasto pelo QR da máquina"
        >
          <KeyRound size={17} strokeWidth={1.85} /> PIN de campo
        </button>
      )}
      <button
        onClick={() => setEscuro((valor) => !valor)}
        className={`mb-0.5 ${botaoRodape}`}
        title={escuro ? 'Usar modo claro' : 'Usar modo escuro'}
      >
        {escuro ? <Sun size={17} strokeWidth={1.85} /> : <Moon size={17} strokeWidth={1.85} />}
        {escuro ? 'Modo claro' : 'Modo escuro'}
      </button>
      <button onClick={sairDoSistema} className={botaoRodape}>
        <LogOut size={17} strokeWidth={1.85} />
        Sair
      </button>
    </div>
  )

  const marca = (
    <div className="flex items-center gap-2.5 px-5 py-4">
      {/* A logo é azul-marinho sobre branco. No tema escuro ela ganha uma
          placa branca em vez de ser recolorida: cor de marca não se
          inverte, se emoldura. */}
      <img src={logoLey} alt="Ley Colchões" className="marca-logo h-7 w-auto" />
      <div className="h-6 w-px" style={{ backgroundColor: 'var(--traco-forte)' }} />
      <p className="text-xs font-bold tracking-[0.08em] text-slate-400">SGAI</p>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* Barra lateral fixa (desktop) */}
      <aside
        className="nao-imprimir fixed inset-y-0 left-0 hidden w-60 flex-col lg:flex"
        style={{ backgroundColor: 'var(--sup-cartao)', borderRight: '1px solid var(--traco)' }}
      >
        {marca}
        {navegacao}
        {rodape}
      </aside>

      {/* Gaveta (mobile) */}
      {menuAberto && (
        <div className="nao-imprimir fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[3px]"
            style={{ animation: 'sgai-entra 0.2s ease-out both' }}
            onClick={() => setMenuAberto(false)}
          />
          <aside
            className="relative flex h-full w-[17rem] flex-col overflow-y-auto"
            style={{
              backgroundColor: 'var(--sup-cartao)',
              boxShadow: 'var(--alt-4)',
              animation: 'sgai-gaveta 0.32s var(--ease-mola) both',
            }}
          >
            <div className="flex items-center justify-between pr-3">
              {marca}
              <button
                onClick={() => setMenuAberto(false)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100"
                aria-label="Fechar menu"
              >
                <X size={20} />
              </button>
            </div>
            {navegacao}
            {rodape}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Header do celular: fundo translúcido com desfoque, então o
            conteúdo passa por baixo em vez de sumir atrás de uma faixa. */}
        <header
          className="nao-imprimir sticky top-0 z-30 flex items-center gap-3 px-4 py-3
            backdrop-blur-xl lg:hidden"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--sup-cartao) 82%, transparent)',
            borderBottom: '1px solid var(--traco)',
          }}
        >
          <button
            onClick={() => setMenuAberto(true)}
            className="-m-1 rounded-lg p-1 text-slate-600 transition-transform active:scale-90"
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold text-slate-900">{paginaAtual}</span>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <DefinirPin aberto={pinAberto} aoFechar={() => setPinAberto(false)} />
    </div>
  )
}
