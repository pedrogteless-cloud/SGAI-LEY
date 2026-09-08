import { supabase } from './supabase'
import { moeda, numero, data as fmtDataBr } from './format'

/**
 * Versão "documento" dos mesmos relatórios que já saem em Excel — pensada
 * pra imprimir ou anexar num e-mail, não pra reprocessar dado. Por isso é
 * mais enxuta que a planilha (uma tabela principal por assunto, não as 4
 * ou 5 abas de recorte que o Excel tem): o Excel é pra quem vai analisar
 * número, o PDF é pra quem só precisa ler o resultado.
 */

const PRAZO_DIAS = { emergencia: 1, alta: 3, media: 7, baixa: 15 }
const LABEL_CRIT = { A: 'A — para a produção', B: 'B — atrapalha', C: 'C — pode esperar' }
const LABEL_PRIOR = { emergencia: 'Emergência', alta: 'Urgente', media: 'Normal', baixa: 'Pode esperar' }

const diasEntre = (a, b) => Math.floor((b - a) / 86400000)
const fmtData = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

async function tabelaDeView(nomeView) {
  const { data, error } = await supabase.from(nomeView).select('*')
  if (error) throw new Error(error.message)
  return data
}

// Pras views cujo formato varia (estoque, preventivas), os títulos de
// coluna vêm do próprio nome da coluna no banco — capitalizado e sem
// underline, só pra não sair "estoque_minimo" cru na folha impressa.
function colunasDe(linhas) {
  return Object.keys(linhas[0] || {})
}
function rotuloColuna(chave) {
  return chave.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}
function linhasDinamicas(dados) {
  const chaves = colunasDe(dados)
  return { colunas: chaves.map(rotuloColuna), linhas: dados.map((l) => chaves.map((c) => l[c] ?? '—')) }
}

async function dadosCustos({ inicio, fim }) {
  const { data, error } = await supabase
    .from('ordens_servico')
    .select(`id, custo_pecas, custo_servicos, custo_mao_obra,
      ativo:ativos(id, codigo, nome, criticidade, unidade:unidades(nome), setor:setores(nome))`)
    .gte('aberta_em', inicio)
    .lte('aberta_em', `${fim}T23:59:59`)
  if (error) throw new Error(error.message)

  const porAtivo = {}
  for (const o of data) {
    const a = o.ativo
    if (!a) continue
    porAtivo[a.id] ??= { ...a, qtd: 0, total: 0 }
    porAtivo[a.id].qtd += 1
    porAtivo[a.id].total += Number(o.custo_pecas) + Number(o.custo_servicos) + Number(o.custo_mao_obra)
  }
  const ativos = Object.values(porAtivo).sort((a, b) => b.total - a.total)
  const totalGeral = ativos.reduce((s, a) => s + a.total, 0)

  return {
    titulo: 'Custos de Manutenção',
    subtitulo: `De ${fmtData(inicio)} até ${fmtData(fim)} · total no período: ${moeda(totalGeral)}`,
    tabelas: [{
      titulo: 'Custo por máquina',
      colunas: ['Código', 'Máquina', 'Setor', 'Unidade', 'Importância', 'OS no período', 'Total (R$)'],
      linhas: ativos.map((a) => [
        a.codigo, a.nome, a.setor?.nome || '—', a.unidade?.nome || '—',
        LABEL_CRIT[a.criticidade] || a.criticidade, a.qtd, moeda(a.total),
      ]),
    }],
  }
}

async function dadosOS({ inicio, fim }) {
  const { data, error } = await supabase
    .from('ordens_servico')
    .select(`numero, titulo, status, prioridade, aberta_em, concluida_em, custo_total,
      ativo:ativos(nome, setor:setores(nome)), responsavel:responsavel_id(nome)`)
    .gte('aberta_em', inicio)
    .lte('aberta_em', `${fim}T23:59:59`)
    .order('aberta_em', { ascending: true })
  if (error) throw new Error(error.message)

  const agora = new Date()
  return {
    titulo: 'Ordens de Serviço',
    subtitulo: `Abertas de ${fmtData(inicio)} até ${fmtData(fim)} · ${data.length} serviço(s)`,
    tabelas: [{
      titulo: 'Serviços do período',
      colunas: ['Número', 'Título', 'Máquina', 'Setor', 'Status', 'Prioridade', 'Aberta em', 'Dias', 'Atrasada?'],
      linhas: data.map((o) => {
        const aberta = new Date(o.aberta_em)
        const emAberto = !['concluida', 'cancelada'].includes(o.status)
        const dias = diasEntre(aberta, emAberto ? agora : new Date(o.concluida_em || o.aberta_em))
        const atrasada = emAberto && dias > (PRAZO_DIAS[o.prioridade] ?? 7)
        return [
          o.numero || '—', o.titulo, o.ativo?.nome || '—', o.ativo?.setor?.nome || '—',
          o.status, LABEL_PRIOR[o.prioridade] || o.prioridade, fmtData(o.aberta_em), dias,
          atrasada ? 'Sim' : 'Não',
        ]
      }),
    }],
  }
}

async function dadosConfiabilidade() {
  const mttr = await tabelaDeView('vw_kpi_mttr_mtbf')
  const disp = await tabelaDeView('vw_kpi_disponibilidade')
  return {
    titulo: 'Confiabilidade (MTTR / MTBF)',
    subtitulo: 'Janela fixa dos últimos 12 meses',
    tabelas: [
      {
        titulo: 'MTTR e MTBF por máquina',
        colunas: ['Código', 'Máquina', 'Importância', 'Falhas (12m)', 'Parada (h)', 'MTTR (h)', 'MTBF (h)'],
        linhas: [...mttr].sort((a, b) => (b.falhas_12m || 0) - (a.falhas_12m || 0)).map((a) => [
          a.codigo, a.nome, LABEL_CRIT[a.criticidade] || a.criticidade,
          a.falhas_12m ?? '—', a.parada_horas_12m ?? '—', a.mttr_horas ?? '—', a.mtbf_horas ?? '—',
        ]),
      },
      {
        titulo: 'Disponibilidade (piores primeiro)',
        colunas: ['Código', 'Máquina', 'Importância', 'Disponibilidade', 'Parada (h)'],
        linhas: [...disp].sort((a, b) => a.disponibilidade_pct - b.disponibilidade_pct).map((a) => [
          a.codigo, a.nome, LABEL_CRIT[a.criticidade] || a.criticidade,
          a.disponibilidade_pct != null ? `${numero(a.disponibilidade_pct, 1)}%` : '—',
          a.parada_horas_12m ?? '—',
        ]),
      },
    ],
  }
}

async function dadosEstoque() {
  const baixo = await tabelaDeView('vw_kpi_estoque_baixo')
  const criticas = await tabelaDeView('vw_kpi_pecas_criticas_risco')
  return {
    titulo: 'Estoque Crítico',
    subtitulo: 'Situação agora',
    tabelas: [
      { titulo: 'Abaixo do estoque mínimo', ...linhasDinamicas(baixo) },
      { titulo: 'Peças críticas em risco', ...linhasDinamicas(criticas) },
    ],
  }
}

async function dadosPreventivas() {
  const dados = await tabelaDeView('vw_kpi_preventivas_vencendo')
  return {
    titulo: 'Revisões Preventivas a Vencer',
    subtitulo: 'Agenda antes de virar corretiva',
    tabelas: [{ titulo: 'Revisões programadas', ...linhasDinamicas(dados) }],
  }
}

async function dadosResumo() {
  const comp = await tabelaDeView('vw_kpi_comparativo_unidades')
  const semana = await tabelaDeView('vw_kpi_resumo_semanal')
  return {
    titulo: 'Resumo Executivo',
    subtitulo: `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    tabelas: [
      {
        titulo: 'Comparativo entre unidades',
        colunas: ['Unidade', 'Máquinas', 'Importância A', 'OS (12m)', 'OS em aberto', 'Parada (h)', 'Custo 12m (R$)'],
        linhas: [...comp].sort((a, b) => b.custo_12m - a.custo_12m).map((u) => [
          u.unidade, u.qtd_ativos, u.ativos_criticos, u.total_os, u.os_abertas, u.parada_horas, moeda(u.custo_12m),
        ]),
      },
      {
        titulo: 'Últimos 7 dias',
        colunas: ['Unidade', 'OS abertas', 'OS concluídas', 'Custo (R$)', 'Avisos pendentes', 'Peças em falta', 'OS atrasadas'],
        linhas: [...semana].sort((a, b) => b.custo_semana - a.custo_semana).map((u) => [
          u.unidade, u.os_abertas_semana, u.os_concluidas_semana, moeda(u.custo_semana),
          u.solicitacoes_pendentes, u.itens_estoque_baixo, u.os_atrasadas,
        ]),
      },
    ],
  }
}

const GERADORES = {
  custos: dadosCustos,
  os: dadosOS,
  confiabilidade: dadosConfiabilidade,
  estoque: dadosEstoque,
  preventivas: dadosPreventivas,
  resumo: dadosResumo,
}

export async function buscarDadosImpressao(tipoId, { inicio, fim } = {}) {
  const gerar = GERADORES[tipoId]
  if (!gerar) throw new Error('Tipo de relatório desconhecido.')
  return gerar({ inicio, fim })
}
