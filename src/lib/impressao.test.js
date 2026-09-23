import { describe, it, expect, vi, afterEach } from 'vitest'
import { esperarImagens } from './impressao'

afterEach(() => vi.useRealTimers())

function raizCom(...imagens) {
  const raiz = document.createElement('div')
  for (const completa of imagens) {
    const img = document.createElement('img')
    Object.defineProperty(img, 'complete', { value: completa, configurable: true })
    raiz.appendChild(img)
  }
  return raiz
}

describe('esperarImagens', () => {
  it('resolve na hora quando não há imagem', async () => {
    await expect(esperarImagens(document.createElement('div'))).resolves.toBeUndefined()
    await expect(esperarImagens(null)).resolves.toBeUndefined()
  })

  it('resolve na hora quando todas já carregaram', async () => {
    await expect(esperarImagens(raizCom(true, true))).resolves.toBeUndefined()
  })

  it('espera a pendente carregar', async () => {
    const raiz = raizCom(true, false)
    let pronto = false
    const espera = esperarImagens(raiz).then(() => { pronto = true })
    await Promise.resolve()
    expect(pronto).toBe(false)
    raiz.querySelectorAll('img')[1].dispatchEvent(new Event('load'))
    await espera
    expect(pronto).toBe(true)
  })

  // Foto quebrada não pode impedir a impressão do resto.
  it('segue quando a imagem falha', async () => {
    const raiz = raizCom(false)
    const espera = esperarImagens(raiz)
    raiz.querySelector('img').dispatchEvent(new Event('error'))
    await expect(espera).resolves.toBeDefined()
  })

  it('desiste depois do teto', async () => {
    vi.useFakeTimers()
    const espera = esperarImagens(raizCom(false), 5000)
    vi.advanceTimersByTime(5000)
    await expect(espera).resolves.toBeUndefined()
  })
})
