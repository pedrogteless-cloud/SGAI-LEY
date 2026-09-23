import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Botao, Campo, Entrada, Erro } from '../components/ui'
import logoLey from '../assets/logo-ley.jpg'

export default function Entrar() {
  const { sessao, entrar, carregando } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  if (!carregando && sessao) return <Navigate to="/" replace />

  const enviar = async (e) => {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { error } = await entrar(email.trim(), senha)
    if (error) {
      setErro(
        new Error(
          error.message === 'Invalid login credentials'
            ? 'E-mail ou senha incorretos.'
            : error.message
        )
      )
    }
    setEnviando(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src={logoLey} alt="Ley Colchões" className="mx-auto mb-3 h-10 w-auto" />
          <h1 className="text-xl font-bold text-slate-900">SGAI</h1>
          <p className="text-sm text-slate-500">Controle de máquinas e manutenção</p>
        </div>

        <form
          onSubmit={enviar}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <Campo rotulo="E-mail">
            <Entrada
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              placeholder="voce@leycolchoes.com.br"
            />
          </Campo>

          <Campo rotulo="Senha">
            <Entrada
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Campo>

          <Erro erro={erro} />

          <Botao type="submit" carregando={enviando} className="w-full" tamanho="lg">
            Entrar
          </Botao>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Quem trabalha na produção não precisa de senha — é só ler o QR da máquina.
        </p>
      </div>
    </div>
  )
}
