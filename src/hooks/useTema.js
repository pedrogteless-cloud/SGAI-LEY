import { useEffect, useState } from 'react'

/**
 * Diz se o tema escuro está ligado, acompanhando a troca ao vivo.
 *
 * Serve pra desenho em SVG e gráfico do recharts, que pintam com cor no
 * atributo e não enxergam CSS — o resto da interface resolve isso com as
 * classes `.dark` e não precisa deste hook.
 */
export function useTemaEscuro() {
  const [escuro, setEscuro] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setEscuro(document.documentElement.classList.contains('dark'))
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return escuro
}

/** Cores da estrutura da planta (piso, parede, pilar, cota, grade). */
export function usePaletaPlanta() {
  const escuro = useTemaEscuro()
  return escuro
    ? {
        piso: '#0e1626',
        parede: '#64748b',
        hachura: '#3b4a63',
        grade: '#2b3a52',
        pilar: '#64748b',
        cota: '#64748b',
        texto: '#94a3b8',
        contraste: '#f8fafc',
        realce: '#0f172a',
      }
    : {
        piso: '#ffffff',
        parede: '#334155',
        hachura: '#cbd5e1',
        grade: '#cbd5e1',
        pilar: '#334155',
        cota: '#94a3b8',
        texto: '#64748b',
        contraste: '#0f172a',
        realce: '#ffffff',
      }
}
