import { describe, it, expect } from 'vitest'
import { caminhoDaUrlPublica, caminhoDaFoto } from './fotos'

const BASE = 'https://vblhvshhjtxsshdqoxit.supabase.co/storage/v1/object/public/fotos/'

describe('caminhoDaUrlPublica', () => {
  it('tira o caminho de uma URL pública do bucket', () => {
    expect(caminhoDaUrlPublica(`${BASE}0f0f-1111.jpg`)).toBe('0f0f-1111.jpg')
  })

  it('ignora a query string que o Supabase às vezes anexa', () => {
    expect(caminhoDaUrlPublica(`${BASE}0f0f-1111.jpg?t=123`)).toBe('0f0f-1111.jpg')
  })

  it('devolve o caminho decodificado', () => {
    expect(caminhoDaUrlPublica(`${BASE}pasta%20com%20espaco/a.png`)).toBe('pasta com espaco/a.png')
  })

  it('não confunde URL de outro bucket com foto', () => {
    const audio = 'https://x.supabase.co/storage/v1/object/public/audios/a.webm'
    expect(caminhoDaUrlPublica(audio)).toBeNull()
  })

  it('aguenta valor vazio, nulo ou que não é texto', () => {
    expect(caminhoDaUrlPublica('')).toBeNull()
    expect(caminhoDaUrlPublica(null)).toBeNull()
    expect(caminhoDaUrlPublica(undefined)).toBeNull()
    expect(caminhoDaUrlPublica(42)).toBeNull()
  })
})

describe('caminhoDaFoto', () => {
  it('prefere o storage_path gravado', () => {
    const foto = { storage_path: 'gravado.jpg', url: `${BASE}outro.jpg` }
    expect(caminhoDaFoto(foto)).toBe('gravado.jpg')
  })

  // As fotos salvas antes de storage_path passar a ser preenchido só têm
  // a URL — é por elas que a leitura pela URL continua existindo.
  it('cai pra URL quando a foto é antiga e não tem caminho', () => {
    expect(caminhoDaFoto({ url: `${BASE}antiga.jpg` })).toBe('antiga.jpg')
  })

  it('devolve nulo quando não dá pra saber o caminho', () => {
    expect(caminhoDaFoto(null)).toBeNull()
    expect(caminhoDaFoto({ url: 'https://exemplo.com/foto.jpg' })).toBeNull()
  })
})
