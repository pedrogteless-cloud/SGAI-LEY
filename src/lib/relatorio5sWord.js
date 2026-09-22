import { supabase } from './supabase'
import {
  dataPorExtenso, horaDe, situacaoDoSetor, resumoDoSetor, sugestoesDoSetor,
  orcamentoDeFotos, numerosDoDia, fraseDoResumo, fraseDaNotaMedia,
  fraseDasRessalvas, fraseFotosRestantes,
} from './relatorio5s'

/**
 * O relatório do 5S de um dia, em Word.
 *
 * Word e não PDF porque o documento é assinado e arquivado: quem recebe
 * às vezes precisa acrescentar uma observação antes de mandar adiante, e
 * num PDF isso não dá.
 *
 * O teto de três páginas é levado a sério — quem pediu vai imprimir. O
 * que cabe: uma página de capa com cabeçalho e o resumo do dia, e duas de
 * detalhe por setor. Foto é o que estoura, então a cota é calculada antes
 * (ver orcamentoDeFotos) e o que não coube é declarado por escrito, nunca
 * omitido em silêncio.
 */

// Cores do sistema, pra o documento não parecer de outro lugar.
const AZUL = '0284C7'
const ESCURO = '0F172A'
const CINZA = '64748B'
const CINZA_CLARO = 'E2E8F0'
const AMBAR = 'B45309'
const VERDE = '047857'
const VERMELHO = 'B91C1C'

// Calibri em vez da fonte da tela: Inter não existe na máquina de quem
// abre o arquivo, e o Word trocaria por outra qualquer, desalinhando tudo.
const FONTE = 'Calibri'

const LARGURA_UTIL_CM = 17 // A4 (21cm) menos 2cm de margem de cada lado

/* --------------------------------------------------------------- dados */

export async function buscarRelatorio5S({ data, unidadeId }) {
  let q = supabase
    .from('vw_relatorio_chao_resumo')
    .select('*')
    .eq('data', data)
    .order('aberta_em', { ascending: true })
  if (unidadeId) q = q.eq('unidade_id', unidadeId)

  const { data: relatorios, error } = await q
  if (error) throw new Error(error.message)
  if (!relatorios?.length) throw new Error('Não há relatório do 5S nessa data.')

  const relatorio = relatorios[0]

  const [setores, midias, conclusao] = await Promise.all([
    supabase
      .from('relatorio_chao_setores')
      .select('id, setor_id, nota, nao_inspecionado, justificativa_nao_inspecionado, setor:setores(nome)')
      .eq('relatorio_id', relatorio.id),
    supabase
      .from('relatorio_chao_midias')
      .select('id, setor_avaliacao_id, setor_5s_id, url')
      .eq('relatorio_id', relatorio.id),
    supabase
      .from('relatorios_chao')
      .select('observacao_inicial, conclusao_situacao, conclusao_atencao, conclusao_providencias')
      .eq('id', relatorio.id)
      .single(),
  ])

  if (setores.error) throw new Error(setores.error.message)
  if (midias.error) throw new Error(midias.error.message)

  // As respostas só dá pra pedir depois de saber os ids dos setores —
  // por isso fica fora do Promise.all de cima.
  const idsSetores = (setores.data || []).map((s) => s.id)
  const { data: respostasData, error: erroResp } = idsSetores.length
    ? await supabase
        .from('relatorio_chao_setor_5s')
        .select('id, setor_avaliacao_id, item, resposta, descricao_problema, quadrante, sugestao')
        .in('setor_avaliacao_id', idsSetores)
    : { data: [], error: null }
  if (erroResp) throw new Error(erroResp.message)

  const porSetor = {}
  for (const r of respostasData || []) {
    (porSetor[r.setor_avaliacao_id] ||= []).push(r)
  }
  // Fotos do setor inteiro: as que não apontam pra um item do checklist.
  const fotosPorSetor = {}
  for (const m of midias.data || []) {
    if (m.setor_avaliacao_id && m.setor_5s_id == null) {
      (fotosPorSetor[m.setor_avaliacao_id] ||= []).push(m)
    }
  }

  const listaSetores = [...(setores.data || [])].sort((a, b) =>
    (a.setor?.nome || '').localeCompare(b.setor?.nome || '', 'pt-BR')
  )

  return {
    relatorio: { ...relatorio, ...(conclusao.data || {}) },
    setores: listaSetores,
    respostasPorSetor: porSetor,
    fotosPorSetor,
  }
}

/* -------------------------------------------------------------- imagens */

/**
 * Baixa a foto e mede pra caber na caixa sem distorcer.
 *
 * Falhar aqui não pode derrubar o relatório inteiro: sem internet na foto
 * (ou bucket fora do ar) o documento sai sem ela e diz isso no lugar.
 */
async function baixarFoto(url, larguraMaxPx, alturaMaxPx) {
  try {
    const resposta = await fetch(url)
    if (!resposta.ok) return null
    const blob = await resposta.blob()
    const bytes = new Uint8Array(await blob.arrayBuffer())

    let largura = larguraMaxPx
    let altura = alturaMaxPx
    try {
      const bitmap = await createImageBitmap(blob)
      const escala = Math.min(larguraMaxPx / bitmap.width, alturaMaxPx / bitmap.height)
      largura = Math.round(bitmap.width * escala)
      altura = Math.round(bitmap.height * escala)
      bitmap.close?.()
    } catch {
      // Sem createImageBitmap fica a caixa cheia: pior enquadramento,
      // melhor que nenhuma foto.
    }
    const tipo = blob.type.includes('png') ? 'png' : 'jpg'
    return { bytes, largura, altura, tipo }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------ documento */

export async function montarDocx(dados) {
  const d = await import('docx')
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,
    Table, TableRow, TableCell, WidthType, ImageRun, Header, Footer, PageNumber, ShadingType,
  } = d

  const { relatorio, setores, respostasPorSetor, fotosPorSetor } = dados
  const numeros = numerosDoDia(setores, respostasPorSetor)

  const texto = (t, o = {}) => new TextRun({ text: t, font: FONTE, ...o })
  const p = (filhos, o = {}) => new Paragraph({ children: filhos, ...o })

  const linhaRotulo = (rotulo, valor) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 32, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [p([texto(rotulo, { bold: true, size: 18, color: CINZA })])],
        }),
        new TableCell({
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [p([texto(valor ?? '—', { size: 20, color: ESCURO })])],
        }),
      ],
    })

  const semBorda = {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: CINZA_CLARO },
    insideVertical: { style: BorderStyle.NONE },
  }

  /* ----------------------------------------------------------- cabeçalho */
  const corpo = [
    p([texto('RELATÓRIO DIÁRIO DO 5S', { bold: true, size: 32, color: ESCURO })], {
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 40 },
    }),
    p([texto('Chão de fábrica · Ley Colchões', { size: 20, color: CINZA })], {
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 8 } },
    }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: semBorda,
      rows: [
        linhaRotulo('Unidade', relatorio.unidade),
        linhaRotulo('Data', dataPorExtenso(relatorio.data)),
        linhaRotulo('Turno', relatorio.turno),
        linhaRotulo('Responsável', relatorio.responsavel),
        linhaRotulo('Início da inspeção', horaDe(relatorio.aberta_em)),
        linhaRotulo(
          'Conclusão',
          relatorio.concluida_em ? horaDe(relatorio.concluida_em) : 'Em andamento'
        ),
        linhaRotulo('Nº do relatório', relatorio.numero),
      ],
    }),
  ]

  /* -------------------------------------------------------- resumo do dia */
  corpo.push(
    p([texto('Resumo do dia', { bold: true, size: 24, color: AZUL })], {
      spacing: { before: 360, after: 120 },
    })
  )

  corpo.push(
    p([texto(`${fraseDoResumo(numeros)} ${fraseDaNotaMedia(numeros.notaMedia)}`, { size: 20, color: ESCURO })], {
      spacing: { after: 80 },
    }),
    p([texto(fraseDasRessalvas(numeros.ressalvas), { size: 20, color: ESCURO })], {
      spacing: { after: 160 },
    })
  )

  if ((relatorio.observacao_inicial || '').trim()) {
    corpo.push(
      p([texto('Observação da abertura: ', { bold: true, size: 20, color: CINZA }),
         texto(relatorio.observacao_inicial.trim(), { size: 20, color: ESCURO })],
        { spacing: { after: 160 } })
    )
  }

  /* --------------------------------------------- quadro geral dos setores */
  const corDaSituacao = (s) =>
    situacaoDoSetor(s) === 'nao_visitado' ? AMBAR
      : situacaoDoSetor(s) === 'nao_avaliado' ? CINZA
        : Number(s.nota) < 2.5 ? VERMELHO : Number(s.nota) < 4 ? AMBAR : VERDE

  const rotuloSituacao = (s) =>
    situacaoDoSetor(s) === 'nao_visitado' ? 'Não visitado'
      : situacaoDoSetor(s) === 'nao_avaliado' ? 'Sem registro'
        : `${Number(s.nota).toFixed(1).replace('.', ',')} de 5`

  corpo.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: semBorda,
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['Setor', 'Situação', 'Ressalvas'].map((t, i) =>
            new TableCell({
              width: { size: i === 0 ? 58 : 21, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [p([texto(t, { bold: true, size: 18, color: CINZA })])],
            })
          ),
        }),
        ...setores.map((s) => {
          const ressalvas = (respostasPorSetor[s.id] || []).filter(
            (r) => ['parcial', 'nao_conforme'].includes(r.resposta)
          ).length
          return new TableRow({
            children: [
              new TableCell({
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [p([texto(s.setor?.nome || '—', { size: 20, color: ESCURO })])],
              }),
              new TableCell({
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [p([texto(rotuloSituacao(s), { size: 20, bold: true, color: corDaSituacao(s) })])],
              }),
              new TableCell({
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [p([texto(ressalvas ? String(ressalvas) : '—', { size: 20, color: ESCURO })])],
              }),
            ],
          })
        }),
      ],
    })
  )

  /* ------------------------------------------------------ setor por setor */
  const fotosDisponiveis = setores.map((s) => ({ id: s.id, fotos: (fotosPorSetor[s.id] || []).length }))
  const cota = orcamentoDeFotos(fotosDisponiveis, { total: 6, porSetor: 2 })

  corpo.push(
    p([texto('Setor por setor', { bold: true, size: 24, color: AZUL })], {
      spacing: { before: 400, after: 160 },
      pageBreakBefore: true,
    })
  )

  // Caixa da foto: duas lado a lado, deixando margem dentro da largura
  // útil. Medido: com foto do tamanho da coluna inteira, nove setores
  // batiam exatamente nas três páginas — sem folga pra uma descrição mais
  // longa ou um setor a mais. Menor cabe e continua dando pra enxergar.
  const LARGURA_FOTO_PX = Math.round(7.0 * 37.8)
  const ALTURA_FOTO_PX = Math.round(4.7 * 37.8)

  for (const s of setores) {
    const respostas = respostasPorSetor[s.id] || []
    const fotos = fotosPorSetor[s.id] || []
    const quantasFotos = cota[s.id] || 0

    corpo.push(
      p([texto(s.setor?.nome || '—', { bold: true, size: 22, color: ESCURO })], {
        spacing: { before: 240, after: 60 },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: corDaSituacao(s), space: 8 } },
      }),
      p([texto(resumoDoSetor(s, respostas), { size: 20, color: ESCURO })], { spacing: { after: 80 } })
    )

    const sugestao = sugestoesDoSetor(respostas)
    if (sugestao) {
      corpo.push(
        p([texto('O que foi sugerido: ', { bold: true, size: 18, color: CINZA }),
           texto(sugestao, { size: 18, color: ESCURO })], { spacing: { after: 80 } })
      )
    }

    if (fotos.length) {
      const usadas = []
      for (const foto of fotos.slice(0, quantasFotos)) {
        const imagem = await baixarFoto(foto.url, LARGURA_FOTO_PX, ALTURA_FOTO_PX)
        if (imagem) usadas.push(imagem)
      }

      if (usadas.length) {
        corpo.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: semBorda,
            rows: [
              new TableRow({
                children: usadas.map((img) =>
                  new TableCell({
                    width: { size: Math.floor(100 / usadas.length), type: WidthType.PERCENTAGE },
                    margins: { top: 40, bottom: 40, left: 0, right: 80 },
                    children: [
                      new Paragraph({
                        children: [new ImageRun({
                          data: img.bytes,
                          type: img.tipo,
                          transformation: { width: img.largura, height: img.altura },
                        })],
                      }),
                    ],
                  })
                ),
              }),
            ],
          })
        )
      }

      // O que não coube é declarado, não some calado.
      const aviso = fraseFotosRestantes(fotos.length - usadas.length, usadas.length > 0)
      if (aviso) {
        corpo.push(
          p([texto(aviso, { size: 16, italics: true, color: CINZA })], { spacing: { after: 80 } })
        )
      }
    }
  }

  /* ------------------------------------------------------------ conclusão */
  const temConclusao = ['conclusao_situacao', 'conclusao_atencao', 'conclusao_providencias']
    .some((c) => (relatorio[c] || '').trim())

  if (temConclusao) {
    corpo.push(
      p([texto('Conclusão do dia', { bold: true, size: 24, color: AZUL })], {
        spacing: { before: 400, after: 120 },
      })
    )
    const blocos = [
      ['Situação geral', relatorio.conclusao_situacao],
      ['Pontos de atenção', relatorio.conclusao_atencao],
      ['Providências', relatorio.conclusao_providencias],
    ]
    for (const [rotulo, valor] of blocos) {
      if (!(valor || '').trim()) continue
      corpo.push(
        p([texto(`${rotulo}: `, { bold: true, size: 20, color: CINZA }),
           texto(valor.trim(), { size: 20, color: ESCURO })], { spacing: { after: 100 } })
      )
    }
  }

  /* ------------------------------------------------------------ assinatura */
  corpo.push(
    p([texto('_'.repeat(42), { size: 20, color: CINZA })], { spacing: { before: 500, after: 40 } }),
    p([texto(relatorio.responsavel || 'Responsável pela inspeção', { size: 20, color: ESCURO })]),
    p([texto('Responsável pela inspeção', { size: 16, color: CINZA })])
  )

  const doc = new Document({
    creator: relatorio.responsavel || 'SGAI',
    title: `Relatório do 5S — ${relatorio.numero}`,
    description: `Inspeção 5S de ${dataPorExtenso(relatorio.data)}`,
    styles: { default: { document: { run: { font: FONTE, size: 20, color: ESCURO } } } },
    sections: [{
      properties: {
        page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
      },
      headers: {
        default: new Header({
          children: [p([texto(`SGAI · Relatório do 5S · ${relatorio.numero}`, { size: 16, color: CINZA })], {
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              texto('Página ', { size: 16, color: CINZA }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONTE, size: 16, color: CINZA }),
              texto(' de ', { size: 16, color: CINZA }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONTE, size: 16, color: CINZA }),
            ],
          })],
        }),
      },
      children: corpo,
    }],
  })

  return Packer.toBlob(doc)
}

/* --------------------------------------------------------------- baixar */

export async function gerarEBaixarRelatorio5S({ data, unidadeId }) {
  const dados = await buscarRelatorio5S({ data, unidadeId })
  const blob = await montarDocx(dados)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Relatorio-5S-${dados.relatorio.numero || data}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return dados.relatorio
}
