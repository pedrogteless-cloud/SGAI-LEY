import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorAuth, useAuth } from './hooks/useAuth'
import { Carregando, ProvedorAviso } from './components/ui'
import Layout from './components/Layout'

import Entrar from './pages/Entrar'
import Painel from './pages/Painel'
import Ativos from './pages/Ativos'
import AtivoDetalhe from './pages/AtivoDetalhe'
import AtivoForm from './pages/AtivoForm'
import ImportarAtivos from './pages/ImportarAtivos'
import Solicitacoes from './pages/Solicitacoes'
import OrdensServico from './pages/OrdensServico'
import OSDetalhe from './pages/OSDetalhe'
import Almoxarifado from './pages/Almoxarifado'
import Fornecedores from './pages/Fornecedores'
import Preventiva from './pages/Preventiva'
import Planta from './pages/Planta'
import ReportarQR from './pages/ReportarQR'
import ChaoDeFabrica from './pages/ChaoDeFabrica'

const cliente = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30_000, retry: 1 },
  },
})

function RotaProtegida({ children }) {
  const { sessao, perfil, carregando } = useAuth()

  if (carregando) return <Carregando texto="Entrando…" />
  if (!sessao) return <Navigate to="/entrar" replace />

  if (perfil && perfil.papel === 'operador') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="text-base font-semibold text-slate-800">Acesso pelo QR da máquina</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Seu perfil é de operador. Para reportar um problema, escaneie o QR code fixado no
            equipamento — não precisa entrar no sistema.
          </p>
        </div>
      </div>
    )
  }

  return children
}

export default function App() {
  return (
    <QueryClientProvider client={cliente}>
      <ProvedorAviso>
        <ProvedorAuth>
          <BrowserRouter>
            <Routes>
              <Route path="/entrar" element={<Entrar />} />
              <Route path="/reportar/:token" element={<ReportarQR />} />

              <Route
                element={
                  <RotaProtegida>
                    <Layout />
                  </RotaProtegida>
                }
              >
                <Route index element={<Painel />} />
                <Route path="ativos" element={<Ativos />} />
                <Route path="ativos/novo" element={<AtivoForm />} />
                <Route path="ativos/importar" element={<ImportarAtivos />} />
                <Route path="ativos/:id" element={<AtivoDetalhe />} />
                <Route path="ativos/:id/editar" element={<AtivoForm />} />
                <Route path="solicitacoes" element={<Solicitacoes />} />
                <Route path="os" element={<OrdensServico />} />
                <Route path="os/:id" element={<OSDetalhe />} />
                <Route path="almoxarifado" element={<Almoxarifado />} />
                <Route path="preventiva" element={<Preventiva />} />
                <Route path="planta" element={<Planta />} />
                <Route path="fornecedores" element={<Fornecedores />} />
                <Route path="tv" element={<ChaoDeFabrica />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ProvedorAuth>
      </ProvedorAviso>
    </QueryClientProvider>
  )
}
