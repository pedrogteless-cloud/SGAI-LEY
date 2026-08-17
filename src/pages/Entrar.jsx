import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Botao, Campo, Entrada, Erro } from '../components/ui'

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
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-sky-400">
            S
          </div>
          <h1 className="text-xl font-bold text-slate-900">SGAI</h1>
          <p className="text-sm text-slate-500">Gestão de Ativos Industriais · Ley Colchões</p>
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
          Operador não precisa entrar — é só escanear o QR da máquina.
        </p>
      </div>
    </div>
  )
}
