import { useEffect, useState } from 'react'

/**
 * Se o aparelho está com rede.
 *
 * `navigator.onLine` mente em um sentido só: false é confiável (não tem
 * rede mesmo), true significa apenas "tem alguma interface conectada" —
 * pode ser o wi-fi do galpão sem saída pra internet. Por isso a tela usa
 * isto pra avisar, nunca pra decidir se manda ou não manda: quem sabe se
 * deu certo é a resposta do Supabase.
 */
export function useConexao() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  )

  useEffect(() => {
    const ligou = () => setOnline(true)
    const caiu = () => setOnline(false)
    window.addEventListener('online', ligou)
    window.addEventListener('offline', caiu)
    return () => {
      window.removeEventListener('online', ligou)
      window.removeEventListener('offline', caiu)
    }
  }, [])

  return online
}
