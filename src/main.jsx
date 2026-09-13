import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { registrarServiceWorker } from './lib/pwa'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Só em produção: em desenvolvimento um service worker no meio do caminho
// serve arquivo velho e faz o hot reload parecer quebrado.
if (import.meta.env.PROD) {
  registrarServiceWorker((aplicar) => {
    window.dispatchEvent(new CustomEvent('sgai:atualizacao', { detail: aplicar }))
  })
}
