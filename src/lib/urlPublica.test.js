import { describe, it, expect } from 'vitest'
import { origemPublica, linkDoQR, enderecoTemporario } from './urlPublica'

const aqui = { origin: 'https://sgai-ley-a1b2c3d4e-pedrogteless-1901s-projects.vercel.app' }

describe('origemPublica', () => {
  it('usa o endereço fixo quando configurado, sem barra no fim', () => {
    expect(origemPublica({ VITE_URL_PUBLICA: ' https://sgai.leycolchoes.com.br/ ' }, aqui))
      .toBe('https://sgai.leycolchoes.com.br')
  })

  it('sem configuração, cai no endereço da página', () => {
    expect(origemPublica({}, aqui)).toBe(aqui.origin)
  })
})

describe('linkDoQR', () => {
  it('monta o link de reportar com o endereço fixo', () => {
    expect(linkDoQR('abc', { VITE_URL_PUBLICA: 'https://sgai-ley.vercel.app' }, aqui))
      .toBe('https://sgai-ley.vercel.app/reportar/abc')
  })

  it('sem token não monta link', () => {
    expect(linkDoQR(null, {}, aqui)).toBe('')
  })
})

describe('enderecoTemporario', () => {
  // O endereço do print do QR quebrado era desse tipo.
  it('reconhece deploy avulso da Vercel', () => {
    expect(enderecoTemporario('sgai-ley-a1b2c3d4e-pedrogteless-1901s-projects.vercel.app')).toBe(true)
  })

  it('reconhece deploy de branch', () => {
    expect(enderecoTemporario('sgai-ley-git-claude-sgai-ass-140033-pedrogteless-1901s-projects.vercel.app')).toBe(true)
  })

  it('aceita o endereço de produção e domínio próprio', () => {
    expect(enderecoTemporario('sgai-ley.vercel.app')).toBe(false)
    expect(enderecoTemporario('sgai-ley-pedrogteless-1901s-projects.vercel.app')).toBe(false)
    expect(enderecoTemporario('sgai.leycolchoes.com.br')).toBe(false)
    expect(enderecoTemporario('localhost')).toBe(false)
  })
})
