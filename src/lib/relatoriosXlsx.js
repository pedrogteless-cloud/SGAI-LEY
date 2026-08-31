import { supabase } from './supabase'

// exceljs é pesado (zip + XML) — só entra no bundle quando alguém realmente
// gera um relatório, não no carregamento inicial do app.
async function novoWorkbook() {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SGAI'
  return wb
}

// Mesma paleta do app (Tailwind): navy pro título, sky pra marca, e as
// mesmas cores de etiqueta que aparecem na tela (M_CRITICIDADE, M_PRIORIDADE…).
const NAVY = 'FF0F172A'
const SKY = 'FF0284C7'
const SKY_LIGHT = 'FFE0F2FE'
const SLATE_TEXT = 'FF1E293B'
const SLATE_MUTED = 'FF64748B'
const WHITE = 'FFFFFFFF'
const BAND = 'FFF1F5F9'
const BORDER_COLOR = 'FFE2E8F0'

const RED_BG = 'FFFEE2E2', RED_TX = 'FFB91C1C'
const AMBER_BG = 'FFFEF3C7', AMBER_TX = 'FFB45309'
const SLATE_BADGE_BG = 'FFF1F5F9', SLATE_BADGE_TX = 'FF475569'
const EMERALD_BG = 'FFD1FAE5', EMERALD_TX = 'FF047857'
const SKY_BADGE_BG = 'FFE0F2FE', SKY_BADGE_TX = 'FF0369A1'

const CRIT_BADGE = {
  A: [RED_BG, RED_TX, 'A — para a produção'],
  B: [AMBER_BG, AMBER_TX, 'B — atrapalha'],
  C: [SLATE_BADGE_BG, SLATE_BADGE_TX, 'C — pode esperar'],
}
const PRIOR_BADGE = {
  emergencia: [RED_BG, RED_TX, 'Emergência'],
  alta: [AMBER_BG, AMBER_TX, 'Urgente'],
  media: [SKY_BADGE_BG, SKY_BADGE_TX, 'Normal'],
  baixa: [SLATE_BADGE_BG, SLATE_BADGE_TX, 'Pode esperar'],
}
const PRAZO_DIAS = { emergencia: 1, alta: 3, media: 7, baixa: 15 }

const BORDA = {
  top: { style: 'thin', color: { argb: BORDER_COLOR } },
  left: { style: 'thin', color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
  right: { style: 'thin', color: { argb: BORDER_COLOR } },
}
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

function titulo(ws, texto, subtitulo, largura = 8) {
  const hoje = new Date().toLocaleDateString('pt-BR')
  const range = (r) => `A${r}:${String.fromCharCode(64 + largura)}${r}`
  ws.mergeCells(range(1))
  ws.getCell('A1').value = 'SGAI · Ley Colchões'
  ws.getCell('A1').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF38BDF8' } }
  ws.getRow(1).height = 20

  ws.mergeCells(range(2))
  ws.getCell('A2').value = texto
  ws.getCell('A2').font = { name: 'Arial', size: 16, bold: true, color: { argb: WHITE } }
  ws.getRow(2).height = 28

  ws.mergeCells(range(3))
  ws.getCell('A3').value = `${subtitulo}  ·  gerado em ${hoje}`
  ws.getCell('A3').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } }
  ws.getRow(3).height = 16

  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= largura; c++) {
      const cell = ws.getCell(r, c)
      cell.fill = fill(NAVY)
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    }
  }
  ws.getRow(4).height = 6
  return 5
}

function cabecalhoTabela(ws, linha, colunas) {
  colunas.forEach((nome, i) => {
    const cell = ws.getCell(linha, i + 1)
    cell.value = nome
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } }
    cell.fill = fill(SKY)
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = BORDA
  })
  ws.getRow(linha).height = 30
  ws.views = [{ state: 'frozen', ySplit: linha }]
}

function celula(ws, linha, col, valor, { zebra, bold, numFmt } = {}) {
  const cell = ws.getCell(linha, col)
  cell.value = valor
  cell.font = { name: 'Arial', size: 10, bold: !!bold, color: { argb: SLATE_TEXT } }
  cell.border = BORDA
  if (numFmt) cell.numFmt = numFmt
  if (zebra) cell.fill = fill(BAND)
  return cell
}

function moeda(ws, linha, col, valor, opts) {
  return celula(ws, linha, col, valor, { ...opts, numFmt: 'R$ #,##0.00;[RED]-R$ #,##0.00' })
}

function badge(ws, linha, col, texto, bg, tx) {
  const cell = ws.getCell(linha, col)
  cell.value = texto
  cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: tx } }
  cell.fill = fill(bg)
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  cell.border = BORDA
}

function linhaTotal(ws, linha, colFim, colunasSoma, rIni, rFim, rotuloCol = 1) {
  celula(ws, linha, rotuloCol, 'Total', { bold: true })
  for (let c = 1; c <= colFim; c++) {
    if (colunasSoma.includes(c)) {
      const letra = ws.getColumn(c).letter
      const cell = celula(ws, linha, c, { formula: `SUM(${letra}${rIni}:${letra}${rFim})` }, { bold: true, numFmt: 'R$ #,##0.00' })
      cell.fill = fill(SKY_LIGHT)
    } else if (c !== rotuloCol) {
      ws.getCell(linha, c).fill = fill(SKY_LIGHT)
      ws.getCell(linha, c).border = BORDA
    }
  }
}

function notaFonte(ws, linha, texto) {
  ws.getCell(linha, 1).value = texto
  ws.getCell(linha, 1).font = { name: 'Arial', size: 8, italic: true, color: { argb: SLATE_MUTED } }
}

function largurasColunas(ws, larguras) {
  larguras.forEach((w, i) => { ws.getColumn(i + 1).width = w })
}

const diasEntre = (a, b) => Math.floor((b - a) / 86400000)
const fmtData = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

async function baixar(workbook, nomeArquivo) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------- tipos disponíveis */

export const TIPOS_RELATORIO = [
  { id: 'custos', nome: 'Custos de Manutenção', temPeriodo: true, descricao: 'Gasto por mês, por máquina, por setor e ranking — no período escolhido' },
  { id: 'os', nome: 'Ordens de Serviço', temPeriodo: true, descricao: 'Serviços abertos no período, com situação e atraso' },
  { id: 'confiabilidade', nome: 'Confiabilidade (MTTR/MTBF)', temPeriodo: false, descricao: 'Janela fixa dos últimos 12 meses' },
  { id: 'estoque', nome: 'Estoque Crítico', temPeriodo: false, descricao: 'Situação do estoque agora' },
  { id: 'preventivas', nome: 'Preventivas a Vencer', temPeriodo: false, descricao: 'Revisões programadas chegando na data' },
  { id: 'resumo', nome: 'Resumo Executivo', temPeriodo: false, descricao: 'Comparativo entre unidades + últimos 7 dias' },
]

/* ------------------------------------------------------------- Custos --- */

async function gerarCustos({ inicio, fim }) {
  const { data, error } = await supabase
    .from('ordens_servico')
    .select(`id, numero, titulo, tipo, status, aberta_em, custo_pecas, custo_servicos, custo_mao_obra, custo_total,
      ativo:ativos(id, codigo, nome, criticidade, valor_aquisicao,
        unidade:unidades(nome), setor:setores(id, nome))`)
    .gte('aberta_em', inicio)
    .lte('aberta_em', `${fim}T23:59:59`)
    .order('aberta_em', { ascending: true })
  if (error) throw new Error(error.message)

  const wb = await novoWorkbook()
  const periodoTxto = `de ${fmtData(inicio)} até ${fmtData(fim)}`

  // --- por mês ---
  const porMes = {}
  for (const o of data) {
    const mes = o.aberta_em.slice(0, 7)
    porMes[mes] ??= { mes, qtd: 0, pecas: 0, servicos: 0, mao_obra: 0 }
    porMes[mes].qtd += 1
    porMes[mes].pecas += Number(o.custo_pecas)
    porMes[mes].servicos += Number(o.custo_servicos)
    porMes[mes].mao_obra += Number(o.custo_mao_obra)
  }
  const meses = Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes))

  const ws1 = wb.addWorksheet('Custo por Mês')
  let r = titulo(ws1, 'Relatório de Custos de Manutenção', `Quanto a fábrica gastou ${periodoTxto}`)
  cabecalhoTabela(ws1, r, ['Mês', 'Qtd. OS', 'Peças (R$)', 'Serviços externos (R$)', 'Mão de obra (R$)', 'Total (R$)'])
  const r0a = r + 1
  meses.forEach((m, i) => {
    const rr = r0a + i, zebra = i % 2 === 1
    celula(ws1, rr, 1, m.mes, { zebra })
    celula(ws1, rr, 2, m.qtd, { zebra })
    moeda(ws1, rr, 3, m.pecas, { zebra })
    moeda(ws1, rr, 4, m.servicos, { zebra })
    moeda(ws1, rr, 5, m.mao_obra, { zebra })
    const t = celula(ws1, rr, 6, { formula: `C${rr}+D${rr}+E${rr}` }, { zebra, bold: true, numFmt: 'R$ #,##0.00' })
  })
  const rlast1 = meses.length ? r0a + meses.length - 1 : r0a
  if (meses.length) linhaTotal(ws1, rlast1 + 1, 6, [3, 4, 5, 6], r0a, rlast1)
  else notaFonte(ws1, r0a, 'Nenhuma ordem de serviço aberta nesse período.')
  largurasColunas(ws1, [12, 10, 15, 20, 15, 14])
  notaFonte(ws1, rlast1 + 3, `Fonte: ordens_servico, filtrado por aberta_em entre ${inicio} e ${fim}.`)

  // --- por ativo ---
  const porAtivo = {}
  for (const o of data) {
    const a = o.ativo
    if (!a) continue
    porAtivo[a.id] ??= { ...a, qtd: 0, pecas: 0, servicos: 0, mao_obra: 0 }
    porAtivo[a.id].qtd += 1
    porAtivo[a.id].pecas += Number(o.custo_pecas)
    porAtivo[a.id].servicos += Number(o.custo_servicos)
    porAtivo[a.id].mao_obra += Number(o.custo_mao_obra)
  }
  const ativos = Object.values(porAtivo)
    .map((a) => ({ ...a, total: a.pecas + a.servicos + a.mao_obra }))
    .sort((a, b) => b.total - a.total)

  const ws2 = wb.addWorksheet('Custo por Máquina')
  r = titulo(ws2, 'Custo por Máquina', `Máquina a máquina, ${periodoTxto}`)
  cabecalhoTabela(ws2, r, ['Código', 'Máquina', 'Importância', 'Unidade', 'Setor', 'OS no período', 'Peças (R$)', 'Serviços (R$)', 'Mão de obra (R$)', 'Total (R$)'])
  const r0b = r + 1
  ativos.forEach((a, i) => {
    const rr = r0b + i, zebra = i % 2 === 1
    celula(ws2, rr, 1, a.codigo, { zebra })
    celula(ws2, rr, 2, a.nome, { zebra })
    const [bg, tx] = CRIT_BADGE[a.criticidade] || CRIT_BADGE.C
    badge(ws2, rr, 3, a.criticidade, bg, tx)
    celula(ws2, rr, 4, a.unidade?.nome || '—', { zebra })
    celula(ws2, rr, 5, a.setor?.nome || '—', { zebra })
    celula(ws2, rr, 6, a.qtd, { zebra })
    moeda(ws2, rr, 7, a.pecas, { zebra })
    moeda(ws2, rr, 8, a.servicos, { zebra })
    moeda(ws2, rr, 9, a.mao_obra, { zebra })
    celula(ws2, rr, 10, { formula: `G${rr}+H${rr}+I${rr}` }, { zebra, bold: true, numFmt: 'R$ #,##0.00' })
  })
  const rlast2 = ativos.length ? r0b + ativos.length - 1 : r0b
  if (ativos.length) linhaTotal(ws2, rlast2 + 1, 10, [7, 8, 9, 10], r0b, rlast2)
  else notaFonte(ws2, r0b, 'Nenhuma ordem de serviço aberta nesse período.')
  largurasColunas(ws2, [14, 30, 12, 14, 16, 12, 13, 14, 14, 14])
  notaFonte(ws2, rlast2 + 3, 'Ordenado do maior para o menor gasto no período.')

  // --- por setor ---
  const porSetor = {}
  for (const a of ativos) {
    const nome = a.setor?.nome || 'Sem setor'
    porSetor[nome] ??= { setor: nome, unidade: a.unidade?.nome || '—', qtd: 0, total: 0 }
    porSetor[nome].qtd += a.qtd
    porSetor[nome].total += a.total
  }
  const setores = Object.values(porSetor).sort((a, b) => b.total - a.total)

  const ws3 = wb.addWorksheet('Custo por Setor')
  r = titulo(ws3, 'Custo por Setor', `Onde a manutenção mais gastou, ${periodoTxto}`)
  cabecalhoTabela(ws3, r, ['Setor', 'Unidade', 'OS no período', 'Total (R$)', '% do total'])
  const r0c = r + 1
  setores.forEach((s, i) => {
    const rr = r0c + i, zebra = i % 2 === 1
    celula(ws3, rr, 1, s.setor, { zebra })
    celula(ws3, rr, 2, s.unidade, { zebra })
    celula(ws3, rr, 3, s.qtd, { zebra })
    moeda(ws3, rr, 4, s.total, { zebra })
    const rlastPct = r0c + setores.length - 1
    const p = celula(ws3, rr, 5, { formula: `IFERROR(D${rr}/SUM($D$${r0c}:$D$${rlastPct}),0)` }, { zebra, numFmt: '0.0%' })
  })
  largurasColunas(ws3, [20, 14, 14, 14, 12])
  if (!setores.length) notaFonte(ws3, r0c, 'Nenhuma ordem de serviço aberta nesse período.')

  // --- ranking ---
  const ws4 = wb.addWorksheet('Ranking')
  r = titulo(ws4, 'Ranking de Máquinas que Mais Custaram', `Top 15, ${periodoTxto}`)
  cabecalhoTabela(ws4, r, ['Posição', 'Código', 'Máquina', 'Setor', 'Importância', 'OS no período', 'Total (R$)'])
  const r0d = r + 1
  const top = ativos.slice(0, 15)
  top.forEach((a, i) => {
    const rr = r0d + i, zebra = i % 2 === 1
    celula(ws4, rr, 1, i + 1, { zebra })
    celula(ws4, rr, 2, a.codigo, { zebra })
    celula(ws4, rr, 3, a.nome, { zebra })
    celula(ws4, rr, 4, a.setor?.nome || '—', { zebra })
    const [bg, tx] = CRIT_BADGE[a.criticidade] || CRIT_BADGE.C
    badge(ws4, rr, 5, a.criticidade, bg, tx)
    celula(ws4, rr, 6, a.qtd, { zebra })
    moeda(ws4, rr, 7, a.total, { zebra })
  })
  largurasColunas(ws4, [9, 14, 30, 16, 13, 13, 14])
  if (!top.length) notaFonte(ws4, r0d, 'Nenhuma ordem de serviço aberta nesse período.')

  // --- RAV% ---
  const ws5 = wb.addWorksheet('RAV %')
  r = titulo(ws5, 'RAV — Custo sobre Valor do Ativo', `Referência: acima de 3–4% ao ano é sinal de avaliar a troca (proporcional ao período de ${diasEntre(new Date(inicio), new Date(fim)) + 1} dias)`)
  cabecalhoTabela(ws5, r, ['Código', 'Máquina', 'Setor', 'Importância', 'Valor de aquisição (R$)', 'Custo no período (R$)', 'RAV do período'])
  const r0e = r + 1
  ativos.forEach((a, i) => {
    const rr = r0e + i, zebra = i % 2 === 1
    celula(ws5, rr, 1, a.codigo, { zebra })
    celula(ws5, rr, 2, a.nome, { zebra })
    celula(ws5, rr, 3, a.setor?.nome || '—', { zebra })
    const [bg, tx] = CRIT_BADGE[a.criticidade] || CRIT_BADGE.C
    badge(ws5, rr, 4, a.criticidade, bg, tx)
    if (a.valor_aquisicao) moeda(ws5, rr, 5, a.valor_aquisicao, { zebra })
    else celula(ws5, rr, 5, 'não cadastrado', { zebra })
    moeda(ws5, rr, 6, a.total, { zebra })
    celula(ws5, rr, 7, { formula: `IFERROR(F${rr}/E${rr},"—")` }, { zebra, numFmt: '0.0%' })
  })
  largurasColunas(ws5, [14, 30, 16, 13, 20, 16, 14])
  if (!ativos.length) notaFonte(ws5, r0e, 'Nenhuma ordem de serviço aberta nesse período.')

  return { workbook: wb, nomeArquivo: `SGAI_Custos_${inicio}_a_${fim}.xlsx` }
}

/* --------------------------------------------------------- Ordens de Serviço */

async function gerarOS({ inicio, fim }) {
  const { data, error } = await supabase
    .from('ordens_servico')
    .select(`id, numero, titulo, status, prioridade, aberta_em, concluida_em, custo_total,
      ativo:ativos(codigo, nome, criticidade, setor:setores(nome), unidade:unidades(nome)),
      responsavel:responsavel_id(nome)`)
    .gte('aberta_em', inicio)
    .lte('aberta_em', `${fim}T23:59:59`)
    .order('aberta_em', { ascending: true })
  if (error) throw new Error(error.message)

  const agora = new Date()
  const linhas = data.map((o) => {
    const aberta = new Date(o.aberta_em)
    const emAberto = !['concluida', 'cancelada'].includes(o.status)
    const dias = diasEntre(aberta, emAberto ? agora : new Date(o.concluida_em || o.aberta_em))
    const atrasada = emAberto && dias > (PRAZO_DIAS[o.prioridade] ?? 7)
    return { ...o, dias, atrasada }
  })

  const wb = await novoWorkbook()
  const ws = wb.addWorksheet('Ordens de Serviço')
  const periodoTxto = `abertas de ${fmtData(inicio)} até ${fmtData(fim)}`
  let r = titulo(ws, 'Ordens de Serviço', periodoTxto, 11)
  cabecalhoTabela(ws, r, ['Número', 'Título', 'Máquina', 'Setor', 'Importância', 'Prioridade', 'Status', 'Responsável', 'Aberta em', 'Dias', 'Atrasada?'])
  const r0 = r + 1
  linhas.forEach((o, i) => {
    const rr = r0 + i, zebra = i % 2 === 1
    celula(ws, rr, 1, o.numero || '—', { zebra })
    celula(ws, rr, 2, o.titulo, { zebra })
    celula(ws, rr, 3, o.ativo?.nome || '—', { zebra })
    celula(ws, rr, 4, o.ativo?.setor?.nome || '—', { zebra })
    const [bgc, txc] = CRIT_BADGE[o.ativo?.criticidade] || CRIT_BADGE.C
    badge(ws, rr, 5, o.ativo?.criticidade || '—', bgc, txc)
    const [bgp, txp, lblp] = PRIOR_BADGE[o.prioridade] || PRIOR_BADGE.media
    badge(ws, rr, 6, lblp, bgp, txp)
    celula(ws, rr, 7, o.status, { zebra })
    celula(ws, rr, 8, o.responsavel?.nome || '—', { zebra })
    celula(ws, rr, 9, fmtData(o.aberta_em), { zebra })
    celula(ws, rr, 10, o.dias, { zebra })
    if (o.atrasada) badge(ws, rr, 11, 'Sim', RED_BG, RED_TX)
    else celula(ws, rr, 11, 'Não', { zebra })
  })
  largurasColunas(ws, [14, 32, 24, 16, 13, 13, 14, 16, 12, 8, 11])
  const rlast = linhas.length ? r0 + linhas.length - 1 : r0
  if (!linhas.length) notaFonte(ws, r0, 'Nenhuma ordem de serviço aberta nesse período.')
  notaFonte(ws, rlast + 3, `Fonte: ordens_servico · atraso calculado pelo prazo por prioridade (emergência 1 dia, urgente 3, normal 7, pode esperar 15).`)

  return { workbook: wb, nomeArquivo: `SGAI_Ordens_Servico_${inicio}_a_${fim}.xlsx` }
}

/* ---------------------------------------------------- relatórios de view fixa */

async function tabelaDeView(nomeView) {
  const { data, error } = await supabase.from(nomeView).select('*')
  if (error) throw new Error(error.message)
  return data
}

async function gerarConfiabilidade() {
  const wb = await novoWorkbook()
  const mttr = await tabelaDeView('vw_kpi_mttr_mtbf')
  const disp = await tabelaDeView('vw_kpi_disponibilidade')

  const ws1 = wb.addWorksheet('MTTR e MTBF')
  let r = titulo(ws1, 'Confiabilidade das Máquinas', 'MTTR e MTBF — janela fixa dos últimos 12 meses', 7)
  cabecalhoTabela(ws1, r, ['Código', 'Máquina', 'Importância', 'Falhas (12m)', 'Parada (h, 12m)', 'MTTR (h)', 'MTBF (h)'])
  let r0 = r + 1
  mttr.sort((a, b) => (b.falhas_12m || 0) - (a.falhas_12m || 0)).forEach((a, i) => {
    const rr = r0 + i, zebra = i % 2 === 1
    celula(ws1, rr, 1, a.codigo, { zebra }); celula(ws1, rr, 2, a.nome, { zebra })
    const [bg, tx] = CRIT_BADGE[a.criticidade] || CRIT_BADGE.C
    badge(ws1, rr, 3, a.criticidade, bg, tx)
    celula(ws1, rr, 4, a.falhas_12m ?? '—', { zebra })
    celula(ws1, rr, 5, a.parada_horas_12m ?? '—', { zebra })
    celula(ws1, rr, 6, a.mttr_horas ?? '—', { zebra })
    celula(ws1, rr, 7, a.mtbf_horas ?? '—', { zebra })
  })
  largurasColunas(ws1, [14, 30, 13, 13, 15, 11, 11])

  const ws2 = wb.addWorksheet('Disponibilidade')
  r = titulo(ws2, 'Disponibilidade das Máquinas', '% do tempo pronta para operar — 12 meses', 7)
  cabecalhoTabela(ws2, r, ['Código', 'Máquina', 'Importância', 'Parada (h, 12m)', 'Disponibilidade', 'MTTR (h)', 'MTBF (h)'])
  r0 = r + 1
  disp.sort((a, b) => a.disponibilidade_pct - b.disponibilidade_pct).forEach((a, i) => {
    const rr = r0 + i, zebra = i % 2 === 1
    celula(ws2, rr, 1, a.codigo, { zebra }); celula(ws2, rr, 2, a.nome, { zebra })
    const [bg, tx] = CRIT_BADGE[a.criticidade] || CRIT_BADGE.C
    badge(ws2, rr, 3, a.criticidade, bg, tx)
    celula(ws2, rr, 4, a.parada_horas_12m ?? '—', { zebra })
    const cell = celula(ws2, rr, 5, a.disponibilidade_pct != null ? a.disponibilidade_pct / 100 : '—', { zebra, numFmt: '0.0%' })
    if (a.disponibilidade_pct != null && a.disponibilidade_pct < 95) { cell.font = { name: 'Arial', bold: true, color: { argb: RED_TX } }; cell.fill = fill(RED_BG) }
    celula(ws2, rr, 6, a.mttr_horas ?? '—', { zebra })
    celula(ws2, rr, 7, a.mtbf_horas ?? '—', { zebra })
  })
  largurasColunas(ws2, [14, 30, 13, 15, 15, 11, 11])

  return { workbook: wb, nomeArquivo: 'SGAI_Confiabilidade.xlsx' }
}

async function gerarEstoque() {
  const wb = await novoWorkbook()
  const baixo = await tabelaDeView('vw_kpi_estoque_baixo')
  const criticas = await tabelaDeView('vw_kpi_pecas_criticas_risco')

  const ws1 = wb.addWorksheet('Abaixo do Mínimo')
  let r = titulo(ws1, 'Peças Abaixo do Estoque Mínimo', 'O que comprar antes que falte', 6)
  cabecalhoTabela(ws1, r, Object.keys(baixo[0] || { peca: 1, codigo: 1, unidade: 1, qtd_atual: 1, qtd_minima: 1 }))
  let r0 = r + 1
  baixo.forEach((linha, i) => {
    const rr = r0 + i, zebra = i % 2 === 1
    Object.values(linha).forEach((v, j) => celula(ws1, rr, j + 1, v ?? '—', { zebra }))
  })
  if (!baixo.length) notaFonte(ws1, r0, 'Nenhuma peça abaixo do mínimo — ou o mínimo ainda não foi cadastrado em Peças.')

  const ws2 = wb.addWorksheet('Peças Críticas em Risco')
  r = titulo(ws2, 'Peças Críticas em Risco', 'Ligadas a máquina importância A com estoque baixo', 6)
  cabecalhoTabela(ws2, r, Object.keys(criticas[0] || { peca: 1 }))
  r0 = r + 1
  criticas.forEach((linha, i) => {
    const rr = r0 + i, zebra = i % 2 === 1
    Object.values(linha).forEach((v, j) => celula(ws2, rr, j + 1, v ?? '—', { zebra }))
  })
  if (!criticas.length) notaFonte(ws2, r0, 'Nenhuma peça crítica em risco agora.')

  return { workbook: wb, nomeArquivo: 'SGAI_Estoque_Critico.xlsx' }
}

async function gerarPreventivas() {
  const wb = await novoWorkbook()
  const dados = await tabelaDeView('vw_kpi_preventivas_vencendo')
  const ws = wb.addWorksheet('Vencendo')
  const r = titulo(ws, 'Revisões Preventivas a Vencer', 'Agenda antes de virar corretiva', 6)
  cabecalhoTabela(ws, r, Object.keys(dados[0] || { ativo: 1 }))
  const r0 = r + 1
  dados.forEach((linha, i) => {
    const rr = r0 + i, zebra = i % 2 === 1
    Object.values(linha).forEach((v, j) => celula(ws, rr, j + 1, v ?? '—', { zebra }))
  })
  if (!dados.length) notaFonte(ws, r0, 'Nenhum plano de revisão preventiva cadastrado ainda.')
  return { workbook: wb, nomeArquivo: 'SGAI_Preventivas.xlsx' }
}

async function gerarResumo() {
  const wb = await novoWorkbook()
  const comp = await tabelaDeView('vw_kpi_comparativo_unidades')
  const semana = await tabelaDeView('vw_kpi_resumo_semanal')

  const ws1 = wb.addWorksheet('Comparativo entre Unidades')
  let r = titulo(ws1, 'Resumo Executivo', 'Números de hoje, unidade por unidade', 7)
  cabecalhoTabela(ws1, r, ['Unidade', 'Máquinas', 'Importância A', 'OS (12m)', 'OS em aberto', 'Parada (h)', 'Custo 12m (R$)'])
  let r0 = r + 1
  comp.sort((a, b) => b.custo_12m - a.custo_12m).forEach((u, i) => {
    const rr = r0 + i, zebra = i % 2 === 1
    celula(ws1, rr, 1, u.unidade, { zebra }); celula(ws1, rr, 2, u.qtd_ativos, { zebra })
    celula(ws1, rr, 3, u.ativos_criticos, { zebra }); celula(ws1, rr, 4, u.total_os, { zebra })
    celula(ws1, rr, 5, u.os_abertas, { zebra }); celula(ws1, rr, 6, u.parada_horas, { zebra })
    moeda(ws1, rr, 7, u.custo_12m, { zebra })
  })
  largurasColunas(ws1, [16, 12, 14, 11, 13, 13, 15])

  const ws2 = wb.addWorksheet('Últimos 7 Dias')
  r = titulo(ws2, 'Resumo da Semana', 'O que mudou nos últimos 7 dias, por unidade', 7)
  cabecalhoTabela(ws2, r, ['Unidade', 'OS abertas', 'OS concluídas', 'Custo (R$)', 'Avisos pendentes', 'Peças em falta', 'OS atrasadas'])
  r0 = r + 1
  semana.sort((a, b) => b.custo_semana - a.custo_semana).forEach((u, i) => {
    const rr = r0 + i, zebra = i % 2 === 1
    celula(ws2, rr, 1, u.unidade, { zebra }); celula(ws2, rr, 2, u.os_abertas_semana, { zebra })
    celula(ws2, rr, 3, u.os_concluidas_semana, { zebra }); moeda(ws2, rr, 4, u.custo_semana, { zebra })
    celula(ws2, rr, 5, u.solicitacoes_pendentes, { zebra }); celula(ws2, rr, 6, u.itens_estoque_baixo, { zebra })
    celula(ws2, rr, 7, u.os_atrasadas, { zebra })
  })
  largurasColunas(ws2, [16, 12, 15, 14, 16, 14, 13])

  return { workbook: wb, nomeArquivo: 'SGAI_Resumo_Executivo.xlsx' }
}

/* ------------------------------------------------------------------ ponto único */

export async function gerarEBaixarRelatorio(tipoId, { inicio, fim } = {}) {
  let resultado
  switch (tipoId) {
    case 'custos': resultado = await gerarCustos({ inicio, fim }); break
    case 'os': resultado = await gerarOS({ inicio, fim }); break
    case 'confiabilidade': resultado = await gerarConfiabilidade(); break
    case 'estoque': resultado = await gerarEstoque(); break
    case 'preventivas': resultado = await gerarPreventivas(); break
    case 'resumo': resultado = await gerarResumo(); break
    default: throw new Error('Tipo de relatório desconhecido')
  }
  await baixar(resultado.workbook, resultado.nomeArquivo)
}
