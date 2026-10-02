import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderizar } from '../teste/utilitarios'

vi.mock('../lib/fotos', () => ({
  enviarFoto: vi.fn(),
  descartarFotos: vi.fn(),
}))

const { default: GaleriaFotos } = await import('./GaleriaFotos')

/** Finge celular (tem câmera) ou computador (não tem). */
const fingirAparelho = (temCamera) => {
  window.matchMedia = (consulta) => ({
    matches: consulta.includes('pointer: coarse') ? temCamera : false,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })
}

const entradas = (container) => [...container.querySelectorAll('input[type="file"]')]

beforeEach(() => fingirAparelho(true))

describe('GaleriaFotos — tirar ou escolher', () => {
  // O capture do HTML abre a câmera DIRETO e pula a galeria. Com um
  // input só, quem já tinha a foto no celular não conseguia anexar.
  it('tem um input pra câmera e outro pra galeria', () => {
    const { container } = renderizar(<GaleriaFotos valor={[]} aoMudar={() => {}} />)
    const inputs = entradas(container)
    expect(inputs).toHaveLength(2)
    expect(inputs.filter((i) => i.hasAttribute('capture'))).toHaveLength(1)
    expect(inputs.filter((i) => !i.hasAttribute('capture'))).toHaveLength(1)
  })

  it('no celular oferece os dois botões', () => {
    renderizar(<GaleriaFotos valor={[]} aoMudar={() => {}} />)
    expect(screen.getByText('Tirar')).toBeInTheDocument()
    expect(screen.getByText('Escolher')).toBeInTheDocument()
  })

  // Num computador o navegador ignora o capture: um botão "Tirar" que
  // na verdade abre o seletor de arquivo seria mentira.
  it('no computador não promete câmera', () => {
    fingirAparelho(false)
    renderizar(<GaleriaFotos valor={[]} aoMudar={() => {}} />)
    expect(screen.queryByText('Tirar')).toBeNull()
    expect(screen.getByText('Foto')).toBeInTheDocument()
  })

  it('a galeria aceita várias fotos, a câmera tira uma por vez', () => {
    const { container } = renderizar(<GaleriaFotos valor={[]} aoMudar={() => {}} />)
    const galeria = entradas(container).find((i) => !i.hasAttribute('capture'))
    expect(galeria.hasAttribute('multiple')).toBe(true)
  })

  it('respeita o limite de uma foto só', () => {
    const { container } = renderizar(<GaleriaFotos valor={[]} aoMudar={() => {}} maximo={1} />)
    const galeria = entradas(container).find((i) => !i.hasAttribute('capture'))
    expect(galeria.hasAttribute('multiple')).toBe(false)
  })

  it('some com os botões quando já bateu o limite', () => {
    renderizar(<GaleriaFotos valor={[{ url: 'a.jpg' }]} aoMudar={() => {}} maximo={1} />)
    expect(screen.queryByText('Tirar')).toBeNull()
    expect(screen.queryByText('Escolher')).toBeNull()
  })

  it('não oferece nada quando está desabilitada', () => {
    renderizar(<GaleriaFotos valor={[]} aoMudar={() => {}} desabilitado />)
    expect(screen.queryByText('Tirar')).toBeNull()
    expect(screen.queryByText('Escolher')).toBeNull()
  })

  it('mostra as fotos que já existem', () => {
    const { container } = renderizar(
      <GaleriaFotos valor={[{ url: 'a.jpg' }, { url: 'b.jpg' }]} aoMudar={() => {}} />
    )
    expect(container.querySelectorAll('img')).toHaveLength(2)
  })
})
