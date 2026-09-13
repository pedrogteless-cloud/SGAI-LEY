import { useEffect, useState } from 'react'

/**
 * Devolve a função que aplica a versão nova, quando existe uma esperando.
 *
 * Quem descobre é o registro do service worker (src/lib/pwa.js), que é
 * disparado uma vez só no main.jsx — fora do React. O recado chega aqui
 * por um evento na janela pra tela não precisar saber nada de service
 * worker.
 */
export function useAtualizacao() {
  const [aplicar, setAplicar] = useState(null)

  useEffect(() => {
    const aoAvisar = (evento) => {
      // setState com função guardaria a função como atualizador; por isso
      // o wrapper.
      setAplicar(() => evento.detail)
    }
    window.addEventListener('sgai:atualizacao', aoAvisar)
    return () => window.removeEventListener('sgai:atualizacao', aoAvisar)
  }, [])

  return aplicar
}
