import { describe, it, expect } from 'vitest'
import {
  COLUNAS, seCruzam, prenderNaGrade, resolverSobreposicao, compactar,
  alturaDaGrade, vagaParaNovo, moverBloco, redimensionarBloco, removerBloco,
  ordemDeLeitura,
} from './painelGrade'

const bloco = (id, x, y, w, h, tipo = 'numero') => ({ id, x, y, w, h, tipo })

describe('seCruzam', () => {
  it('reconhece sobreposição de verdade', () => {
    expect(seCruzam(bloco('a', 0, 0, 4, 2), bloco('b', 2, 1, 4, 2))).toBe(true)
  })

  // Encostar não é sobrepor: dois blocos lado a lado são o caso normal.
  it('não confunde encostar com sobrepor', () => {
    expect(seCruzam(bloco('a', 0, 0, 4, 2), bloco('b', 4, 0, 4, 2))).toBe(false)
    expect(seCruzam(bloco('a', 0, 0, 4, 2), bloco('b', 0, 2, 4, 2))).toBe(false)
  })
})

describe('prenderNaGrade', () => {
  it('não deixa passar da última coluna', () => {
    expect(prenderNaGrade(bloco('a', 10, 0, 6, 2))).toMatchObject({ x: 6, w: 6 })
  })

  it('não aceita coordenada negativa', () => {
    expect(prenderNaGrade(bloco('a', -3, -2, 4, 2))).toMatchObject({ x: 0, y: 0 })
  })

  it('arredonda pra célula inteira', () => {
    expect(prenderNaGrade({ ...bloco('a', 0, 0, 4, 2), x: 2.6, y: 1.4 })).toMatchObject({ x: 3, y: 1 })
  })

  it('bloco mais largo que a grade encolhe até caber', () => {
    expect(prenderNaGrade(bloco('a', 0, 0, 20, 2)).w).toBe(COLUNAS)
  })
})

describe('resolverSobreposicao', () => {
  // O que a pessoa acabou de soltar fica onde ela soltou. Se o recém-solto
  // é que cedesse, arrastar viraria uma briga com a tela.
  it('mantém o bloco recém-solto no lugar e empurra o outro pra baixo', () => {
    const r = resolverSobreposicao([bloco('antigo', 0, 0, 6, 2), bloco('novo', 0, 0, 6, 2)], 'novo')
    const novo = r.find((b) => b.id === 'novo')
    const antigo = r.find((b) => b.id === 'antigo')
    expect(novo.y).toBe(0)
    expect(antigo.y).toBe(2)
  })

  it('empurra sempre pra baixo, nunca pro lado', () => {
    const r = resolverSobreposicao([bloco('a', 0, 0, 6, 2), bloco('b', 0, 0, 6, 2)], 'a')
    expect(r.find((x) => x.id === 'b').x).toBe(0)
  })

  it('deixa quieto o que já não se cruza', () => {
    const entrada = [bloco('a', 0, 0, 6, 2), bloco('b', 6, 0, 6, 2)]
    const r = resolverSobreposicao(entrada)
    expect(r.find((x) => x.id === 'b')).toMatchObject({ x: 6, y: 0 })
  })
})

describe('compactar', () => {
  // Apagar um bloco não pode deixar um buraco que obriga a rolar a tela.
  it('puxa pra cima fechando faixa vazia', () => {
    const r = compactar([bloco('a', 0, 0, 6, 2), bloco('b', 0, 7, 6, 2)])
    expect(r.find((x) => x.id === 'b').y).toBe(2)
  })

  it('não deixa um bloco atravessar o outro ao subir', () => {
    const r = compactar([bloco('a', 0, 0, 6, 2), bloco('b', 0, 5, 6, 2), bloco('c', 0, 9, 6, 2)])
    expect(r.map((x) => x.y)).toEqual([0, 2, 4])
  })

  it('sobe por coluna: o que está ao lado não atrapalha', () => {
    const r = compactar([bloco('a', 0, 0, 6, 2), bloco('b', 6, 4, 6, 2)])
    expect(r.find((x) => x.id === 'b').y).toBe(0)
  })
})

describe('vagaParaNovo', () => {
  it('o primeiro bloco vai pro canto', () => {
    expect(vagaParaNovo([], { w: 3, h: 2 })).toEqual({ x: 0, y: 0, w: 3, h: 2 })
  })

  // Três cartões de número seguidos têm que ficar lado a lado, que é como
  // a pessoa desenharia no papel.
  it('encaixa ao lado quando ainda sobra largura na linha', () => {
    const r = vagaParaNovo([bloco('a', 0, 0, 3, 2)], { w: 3, h: 2 })
    expect(r).toMatchObject({ x: 3, y: 0 })
  })

  it('desce quando a linha encheu', () => {
    const cheia = [bloco('a', 0, 0, 12, 2)]
    expect(vagaParaNovo(cheia, { w: 3, h: 2 })).toMatchObject({ x: 0, y: 2 })
  })

  it('acha buraco no meio em vez de ir sempre pro fim', () => {
    const r = vagaParaNovo([bloco('a', 0, 0, 3, 2), bloco('b', 6, 0, 6, 2)], { w: 3, h: 2 })
    expect(r).toMatchObject({ x: 3, y: 0 })
  })
})

describe('moverBloco', () => {
  it('leva o bloco pro destino e acomoda o resto', () => {
    const blocos = [bloco('a', 0, 0, 6, 2), bloco('b', 6, 0, 6, 2)]
    const r = moverBloco(blocos, 'b', { x: 0, y: 0 })
    expect(r.find((x) => x.id === 'b')).toMatchObject({ x: 0, y: 0 })
    expect(r.find((x) => x.id === 'a').y).toBe(2)
  })

  it('não deixa arrastar pra fora da grade', () => {
    const r = moverBloco([bloco('a', 0, 0, 4, 2)], 'a', { x: 30, y: -5 })
    expect(r[0]).toMatchObject({ x: COLUNAS - 4, y: 0 })
  })
})

describe('redimensionarBloco', () => {
  it('respeita o mínimo do tipo', () => {
    const r = redimensionarBloco([bloco('a', 0, 0, 6, 4, 'barras')], 'a', { w: 1, h: 1 })
    expect(r[0]).toMatchObject({ w: 3, h: 3 })
  })

  it('não deixa crescer além da borda', () => {
    const r = redimensionarBloco([bloco('a', 8, 0, 4, 2, 'numero')], 'a', { w: 12, h: 2 })
    expect(r[0].w).toBe(4)
  })

  it('empurra quem estava embaixo ao crescer', () => {
    const blocos = [bloco('a', 0, 0, 6, 2), bloco('b', 0, 2, 6, 2)]
    const r = redimensionarBloco(blocos, 'a', { w: 6, h: 4 })
    expect(r.find((x) => x.id === 'b').y).toBe(4)
  })
})

describe('removerBloco', () => {
  it('tira o bloco e fecha o buraco', () => {
    const blocos = [bloco('a', 0, 0, 6, 2), bloco('b', 0, 2, 6, 2), bloco('c', 0, 4, 6, 2)]
    const r = removerBloco(blocos, 'b')
    expect(r).toHaveLength(2)
    expect(r.map((x) => x.y)).toEqual([0, 2])
  })
})

describe('alturaDaGrade e ordemDeLeitura', () => {
  it('mede até o fim do bloco mais baixo', () => {
    expect(alturaDaGrade([bloco('a', 0, 0, 6, 2), bloco('b', 0, 4, 6, 3)])).toBe(7)
    expect(alturaDaGrade([])).toBe(0)
  })

  // É a ordem que o celular usa pra empilhar em uma coluna só.
  it('lê de cima pra baixo, da esquerda pra direita', () => {
    const r = ordemDeLeitura([bloco('c', 0, 4, 6, 2), bloco('b', 6, 0, 6, 2), bloco('a', 0, 0, 6, 2)])
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})
