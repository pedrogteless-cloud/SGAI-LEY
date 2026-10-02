import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { montarDocx } from './relatorio5sWord'

/**
 * Gera o .docx de verdade e lê o XML de dentro.
 *
 * Um teste que só conferisse "gerou um blob" passaria com um arquivo
 * corrompido. Aqui o documento é descompactado e o texto é procurado
 * dentro dele — é o mais perto de abrir no Word que dá pra fazer sem Word.
 */

const FOTO = readFileSync('src/assets/logo-ley.jpg')

const setor = (id, nome, extra = {}) => ({
  id, setor_id: `st-${id}`, nota: null, nao_inspecionado: false,
  justificativa_nao_inspecionado: null, setor: { nome }, ...extra,
})

const DADOS = {
  relatorio: {
    id: 'r1',
    numero: 'RCF-2026-00011',
    data: '2026-09-22',
    turno: 'Dia',
    unidade: 'Eusébio',
    responsavel: 'Pedro Teles',
    status: 'concluida',
    aberta_em: '2026-09-22T17:35:00Z', // 14:35 em Fortaleza
    concluida_em: '2026-09-22T20:10:00Z', // 17:10
    observacao_inicial: 'Inspeção começou pela expedição.',
    conclusao_situacao: 'Dia tranquilo, sem parada de linha.',
    conclusao_atencao: 'Corte segue acumulando retalho na passagem.',
    conclusao_providencias: 'Bandeja nova na prensa até sexta.',
  },
  setores: [
    setor('s1', 'Corte', { nota: 3.2 }),
    setor('s2', 'Costura', { nota: 5 }),
    setor('s3', 'Expedição', { nao_inspecionado: true, justificativa_nao_inspecionado: 'Portão fechado pela obra' }),
    setor('s4', 'Montagem'),
  ],
  respostasPorSetor: {
    s1: [
      { item: 'seiri', resposta: 'nao_conforme', descricao_problema: 'Retalho na passagem', quadrante: '7C', sugestao: 'Tirar o retalho no fim do turno' },
      { item: 'seiso', resposta: 'parcial', descricao_problema: 'Pó embaixo da prensa', sugestao: null },
      { item: 'seiton', resposta: 'conforme' },
      { item: 'seiketsu', resposta: 'conforme' },
      { item: 'shitsuke', resposta: 'conforme' },
    ],
    s2: [
      { item: 'seiri', resposta: 'conforme' }, { item: 'seiton', resposta: 'conforme' },
      { item: 'seiso', resposta: 'conforme' }, { item: 'seiketsu', resposta: 'conforme' },
      { item: 'shitsuke', resposta: 'conforme' },
    ],
  },
  fotosPorSetor: {
    s1: [
      { id: 'f1', url: 'https://x/1.jpg' }, { id: 'f2', url: 'https://x/2.jpg' },
      { id: 'f3', url: 'https://x/3.jpg' }, { id: 'f4', url: 'https://x/4.jpg' },
    ],
    s3: [{ id: 'f5', url: 'https://x/5.jpg' }],
  },
}

let xml = ''
let zip = null
const fetchOriginal = globalThis.fetch

beforeAll(async () => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    blob: async () => ({ type: 'image/jpeg', arrayBuffer: async () => FOTO.buffer.slice(0) }),
  }))
  const blob = await montarDocx(DADOS)
  zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()))
  xml = await zip.file('word/document.xml').async('string')
})

afterAll(() => { globalThis.fetch = fetchOriginal })

// O XML quebra o texto em pedaços; procurar sem as tags é o que funciona.
const texto = () => xml.replace(/<[^>]+>/g, '')

describe('o arquivo em si', () => {
  it('é um .docx de verdade, com as peças que o Word espera', async () => {
    expect(zip.file('word/document.xml')).toBeTruthy()
    expect(zip.file('[Content_Types].xml')).toBeTruthy()
    expect(zip.file('word/_rels/document.xml.rels')).toBeTruthy()
  })
})

describe('cabeçalho preenchido sozinho', () => {
  it('traz unidade, turno, responsável e número', () => {
    const t = texto()
    expect(t).toContain('Eusébio')
    expect(t).toContain('Dia')
    expect(t).toContain('Pedro Teles')
    expect(t).toContain('RCF-2026-00011')
  })

  it('escreve a data com o dia da semana', () => {
    expect(texto()).toContain('22 de setembro de 2026 (terça-feira)')
  })

  // O horário vem de um timestamp UTC: 17:35Z é 14:35 na fábrica.
  it('mostra o horário de início no fuso de Fortaleza', () => {
    expect(texto()).toContain('14:35')
    expect(texto()).toContain('17:10')
  })
})

describe('resumo do dia', () => {
  it('conta cada situação e a nota média', () => {
    const t = texto()
    expect(t).toContain('Dos 4 setores previstos')
    expect(t).toContain('2 foram avaliados')
    expect(t).toContain('1 não pôde ser visitado')
    expect(t).toContain('1 ficou sem registro')
    expect(t).toContain('4,1 de 5') // (3,2 + 5) / 2
  })

  it('soma as ressalvas do dia', () => {
    expect(texto()).toContain('Foram apontadas 2 ressalvas')
  })

  it('leva a observação da abertura', () => {
    expect(texto()).toContain('Inspeção começou pela expedição.')
  })
})

describe('setor por setor', () => {
  it('escreve o resumo por extenso, não uma tabela de siglas', () => {
    const t = texto()
    expect(t).toContain('Retalho na passagem')
    expect(t).toContain('no quadrante 7C')
    expect(t).toContain('Pó embaixo da prensa')
  })

  it('diz o motivo de quem não foi visitado', () => {
    expect(texto()).toContain('Portão fechado pela obra')
  })

  it('não esquece o setor que ficou sem registro', () => {
    const t = texto()
    expect(t).toContain('Montagem')
    expect(t).toContain('ainda sem avaliação registrada')
  })

  it('leva a sugestão de quem sugeriu', () => {
    expect(texto()).toContain('Tirar o retalho no fim do turno')
  })

  it('elogia o setor conforme sem inventar ressalva', () => {
    expect(texto()).toContain('Os cinco pontos do 5S foram considerados conformes')
  })
})

describe('fotos', () => {
  it('embute as imagens no arquivo', () => {
    const imagens = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'))
    expect(imagens.length).toBeGreaterThan(0)
  })

  // O setor tinha 4 fotos e a cota deixa 2: as outras não podem sumir
  // caladas, porque o relatório é o que a pessoa vai levar pra reunião.
  it('declara por escrito as fotos que não couberam', () => {
    expect(texto()).toMatch(/Mais \d+ fotos? deste setor (está|estão) no sistema/)
  })
})

describe('fechamento', () => {
  it('leva a conclusão do dia', () => {
    const t = texto()
    expect(t).toContain('Dia tranquilo, sem parada de linha.')
    expect(t).toContain('Bandeja nova na prensa até sexta.')
  })

  it('deixa a linha de assinatura com o nome de quem inspecionou', () => {
    expect(texto()).toContain('Responsável pela inspeção')
  })
})

describe('quando a foto não baixa', () => {
  it('gera o documento assim mesmo, sem a imagem', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false }))
    const blob = await montarDocx(DADOS)
    const z = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()))
    const t = (await z.file('word/document.xml').async('string')).replace(/<[^>]+>/g, '')
    expect(t).toContain('Corte')
    // sem nenhuma imagem embutida, avisa que as fotos ficaram no sistema
    expect(t).toMatch(/fotos? deste setor (está|estão) no sistema/)
  })
})
