import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)

export function ProvedorAuth({ children }) {
  const [sessao, setSessao] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true

    const carregarPerfil = async (usuarioId) => {
      if (!usuarioId) return null
      const { data } = await supabase
        .from('perfis')
        .select('*, unidade:unidades(id, nome, sigla)')
        .eq('id', usuarioId)
        .maybeSingle()
      return data
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return
      setSessao(data.session)
      setPerfil(await carregarPerfil(data.session?.user?.id))
      setCarregando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, novaSessao) => {
      if (!vivo) return
      setSessao(novaSessao)
      setPerfil(await carregarPerfil(novaSessao?.user?.id))
      setCarregando(false)
    })

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const valor = {
    sessao,
    perfil,
    carregando,
    papel: perfil?.papel ?? null,
    ehGestor: perfil?.papel === 'gestor',
    ehTecnico: perfil?.papel === 'tecnico',
    podeVerCusto: perfil?.papel === 'gestor' || perfil?.papel === 'tecnico',
    entrar: (email, senha) => supabase.auth.signInWithPassword({ email, password: senha }),
    sair: () => supabase.auth.signOut(),
  }

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
