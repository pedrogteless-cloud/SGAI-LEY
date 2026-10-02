/**
 * O que o construtor de painéis pode consultar.
 *
 * Este catálogo é a fronteira de segurança da funcionalidade. O bloco de um
 * painel nunca guarda SQL: guarda "qual fonte, qual campo, qual filtro", e a
 * tela monta a consulta pelo PostgREST a partir daqui. Fonte que não está
 * nesta lista não é consultável, campo que não está no `campos` não é
 * selecionável — e o RLS do Supabase continua valendo por cima de tudo,
 * porque a consulta sai com o login de quem está olhando.
 *
 * Cada `descricao` diz o recorte real da view. Isso não é enfeite: a
 * diferença entre "todas as OS" e "só as que ainda estão abertas" muda o
 * número que o gestor vai levar pra reunião.
 */

export const TIPOS_CAMPO = {
  texto: 'texto',
  numero: 'numero',
  data: 'data',
  booleano: 'booleano',
}

const t = (campo, rotulo) => ({ campo, rotulo, tipo: 'texto' })
const n = (campo, rotulo, extra = {}) => ({ campo, rotulo, tipo: 'numero', ...extra })
const d = (campo, rotulo) => ({ campo, rotulo, tipo: 'data' })
const b = (campo, rotulo) => ({ campo, rotulo, tipo: 'booleano' })

export const FONTES = [
  {
    chave: 'os',
    rotulo: 'Serviços (OS)',
    descricao: 'Toda a história de ordens de serviço, de qualquer status.',
    view: 'vw_painel_os',
    campoUnidade: 'unidade_id',
    campoDataPadrao: 'data_abertura',
    campos: [
      t('tipo', 'Tipo'), t('status', 'Situação'), t('prioridade', 'Prioridade'),
      t('unidade', 'Unidade'), t('setor', 'Setor'), t('categoria', 'Categoria'),
      t('ativo', 'Máquina'), t('ativo_codigo', 'Código da máquina'),
      t('criticidade', 'Importância'), t('responsavel', 'Responsável'),
      t('numero', 'Número'), t('titulo', 'Título'),
      d('data_abertura', 'Data de abertura'), d('mes_abertura', 'Mês de abertura'),
      d('concluida_em', 'Concluída em'),
      n('custo_total', 'Custo total', { formato: 'dinheiro' }),
      n('custo_pecas', 'Custo de peças', { formato: 'dinheiro' }),
      n('custo_servicos', 'Custo de serviços', { formato: 'dinheiro' }),
      n('custo_mao_obra', 'Custo de mão de obra', { formato: 'dinheiro' }),
      n('tempo_parada_min', 'Parada (min)'),
      n('horas_ate_concluir', 'Horas até concluir'),
    ],
  },
  {
    chave: 'os_abertas',
    rotulo: 'Serviços em aberto',
    descricao: 'Só o que ainda não foi concluído nem cancelado — o backlog de agora.',
    view: 'vw_kpi_backlog_os',
    campoDataPadrao: 'aberta_em',
    campos: [
      t('tipo', 'Tipo'), t('status', 'Situação'), t('prioridade', 'Prioridade'),
      t('unidade', 'Unidade'), t('setor', 'Setor'), t('ativo_nome', 'Máquina'),
      t('criticidade', 'Importância'), t('responsavel', 'Responsável'),
      t('numero', 'Número'), t('titulo', 'Título'),
      b('atrasada', 'Está atrasada'),
      d('aberta_em', 'Aberta em'),
      n('dias_aberta', 'Dias em aberto'),
      n('custo_total', 'Custo até agora', { formato: 'dinheiro' }),
    ],
  },
  {
    chave: 'maquinas',
    rotulo: 'Máquinas',
    descricao: 'Uma linha por máquina, com o custo e as paradas já acumulados.',
    view: 'vw_kpi_custo_por_ativo',
    campoDataPadrao: 'ultima_manutencao',
    campos: [
      t('nome', 'Máquina'), t('codigo', 'Código'), t('unidade', 'Unidade'),
      t('setor', 'Setor'), t('categoria', 'Categoria'), t('criticidade', 'Importância'),
      d('ultima_manutencao', 'Última manutenção'),
      n('custo_total', 'Custo total', { formato: 'dinheiro' }),
      n('custo_12m', 'Custo 12 meses', { formato: 'dinheiro' }),
      n('valor_aquisicao', 'Valor de compra', { formato: 'dinheiro' }),
      n('total_os', 'Total de serviços'),
      n('os_corretivas', 'Serviços corretivos'),
      n('parada_total_min', 'Parada total (min)'),
    ],
  },
  {
    chave: 'disponibilidade',
    rotulo: 'Disponibilidade e falhas',
    descricao: 'MTTR, MTBF e disponibilidade por máquina, nos últimos 12 meses.',
    view: 'vw_kpi_disponibilidade',
    campos: [
      t('nome', 'Máquina'), t('codigo', 'Código'), t('criticidade', 'Importância'),
      n('disponibilidade_pct', 'Disponibilidade (%)', { formato: 'porcento' }),
      n('mttr_horas', 'MTTR (h)'), n('mtbf_horas', 'MTBF (h)'),
      n('parada_horas_12m', 'Parada 12 meses (h)'),
    ],
  },
  {
    chave: 'estoque_baixo',
    rotulo: 'Peças abaixo do mínimo',
    descricao: 'Só as peças cuja quantidade já está abaixo do estoque mínimo.',
    view: 'vw_kpi_estoque_baixo',
    campoUnidade: 'unidade_id',
    campos: [
      t('nome', 'Peça'), t('codigo', 'Código'), t('unidade', 'Unidade'),
      t('fornecedor_padrao', 'Fornecedor'), b('critica', 'É crítica'),
      n('quantidade', 'Quantidade'), n('estoque_minimo', 'Mínimo'),
      n('faltante', 'Faltando'),
      n('custo_reposicao', 'Custo de reposição', { formato: 'dinheiro' }),
    ],
  },
  {
    chave: 'preventivas',
    rotulo: 'Revisões vencendo',
    descricao: 'Planos de preventiva com data ou horímetro se aproximando.',
    view: 'vw_kpi_preventivas_vencendo',
    campos: [
      t('plano', 'Plano'), t('ativo', 'Máquina'), t('codigo', 'Código'),
      t('unidade', 'Unidade'), t('criticidade', 'Importância'),
      t('situacao', 'Situação'), d('proxima_data', 'Próxima data'),
      n('dias_restantes', 'Dias restantes'),
    ],
  },
  {
    chave: 'acoes5s',
    rotulo: 'Ações do 5S',
    descricao: 'O plano de ação do chão de fábrica, aberto e concluído.',
    view: 'vw_acoes_chao',
    campoUnidade: 'unidade_id',
    campoDataPadrao: 'relatorio_data',
    campos: [
      t('status', 'Situação'), t('prioridade', 'Prioridade'),
      t('setor_nome', 'Setor'), t('unidade_nome', 'Unidade'),
      t('responsavel_nome', 'Responsável'), t('item_5s', 'Item do 5S'),
      t('quadrante', 'Quadrante'), t('descricao', 'O que fazer'),
      d('prazo', 'Prazo'), d('relatorio_data', 'Data do relatório'),
      d('concluida_em', 'Concluída em'),
      n('dias_atraso', 'Dias de atraso'),
    ],
  },
  {
    chave: 'avaliacoes5s',
    rotulo: 'Notas do 5S por setor',
    descricao: 'Uma linha por setor avaliado em cada relatório. Setor não visitado entra com nota vazia.',
    view: 'vw_relatorio_chao_setor_avaliacoes',
    campoUnidade: 'unidade_id',
    campoDataPadrao: 'relatorio_data',
    campos: [
      t('setor_nome', 'Setor'), t('turno', 'Turno'),
      t('relatorio_status', 'Situação do relatório'),
      b('nao_inspecionado', 'Não visitado'),
      d('relatorio_data', 'Data'),
      n('nota', 'Nota do 5S'),
    ],
  },
  {
    chave: 'checklist5s',
    rotulo: 'Respostas do checklist 5S',
    descricao: 'Uma linha por pergunta respondida: dá pra ver em qual dos 5S o setor mais engancha.',
    view: 'vw_relatorio_chao_setor_5s',
    campoUnidade: 'unidade_id',
    campoDataPadrao: 'relatorio_data',
    campos: [
      t('item', 'Item do 5S'), t('resposta', 'Resposta'),
      t('setor_nome', 'Setor'), t('turno', 'Turno'),
      t('quadrante', 'Quadrante'), t('descricao_problema', 'Problema'),
      d('relatorio_data', 'Data'),
    ],
  },
  {
    chave: 'residuos',
    rotulo: 'Desperdício e reaproveitamento',
    descricao: 'Uma linha por medição. A unidade de medida vem separada — kg, m³ e unidade nunca se somam.',
    view: 'vw_painel_residuos',
    campoUnidade: 'unidade_id',
    campoDataPadrao: 'data',
    campos: [
      t('material', 'Material'), t('material_categoria', 'Categoria do material'),
      t('tipo_movimentacao', 'Movimentação'), t('origem', 'Origem'),
      t('condicao', 'Condição'), t('destinacao', 'Destinação'),
      t('setor', 'Setor'), t('unidade', 'Unidade'), t('quadrante', 'Quadrante'),
      t('unidade_medida', 'Unidade de medida'),
      d('data', 'Data'), d('mes', 'Mês'),
      // A trava que dá nome à fonte: somar quantidade sem separar por
      // unidade de medida produz um número que não quer dizer nada.
      n('quantidade', 'Quantidade', { exigeAgrupamento: 'unidade_medida' }),
    ],
  },
  {
    chave: 'custo_mensal',
    rotulo: 'Custo por mês',
    descricao: 'Já somado por mês, unidade e tipo de serviço. Não inclui serviço cancelado.',
    view: 'vw_kpi_custo_mensal',
    campoUnidade: 'unidade_id',
    campoDataPadrao: 'mes',
    campos: [
      t('unidade', 'Unidade'), t('tipo', 'Tipo de serviço'),
      d('mes', 'Mês'),
      n('custo_total', 'Custo total', { formato: 'dinheiro' }),
      n('custo_pecas', 'Custo de peças', { formato: 'dinheiro' }),
      n('custo_servicos', 'Custo de serviços', { formato: 'dinheiro' }),
      n('custo_mao_obra', 'Custo de mão de obra', { formato: 'dinheiro' }),
      n('qtd_os', 'Quantidade de serviços'),
    ],
  },
  {
    chave: 'avisos',
    rotulo: 'Avisos do QR',
    descricao: 'O que o pessoal da produção reportou pela máquina, antes de virar serviço.',
    view: 'solicitacoes_servico',
    campoDataPadrao: 'criado_em',
    campos: [
      t('status', 'Situação'), t('prioridade', 'Prioridade'),
      t('origem', 'Origem'), t('solicitante_nome', 'Quem avisou'),
      t('numero', 'Número'), t('descricao', 'Descrição'),
      b('maquina_parada', 'Máquina parada'),
      d('criado_em', 'Recebido em'), d('triagem_em', 'Triado em'),
      n('audio_segundos', 'Áudio (segundos)'),
    ],
  },
]

export const M_FONTE = Object.fromEntries(FONTES.map((f) => [f.chave, f]))

export function fonteDe(chave) {
  return M_FONTE[chave] || null
}

export function campoDe(chaveFonte, nomeCampo) {
  return fonteDe(chaveFonte)?.campos.find((c) => c.campo === nomeCampo) || null
}

export const camposPorTipo = (chaveFonte, ...tipos) =>
  (fonteDe(chaveFonte)?.campos || []).filter((c) => tipos.includes(c.tipo))

/**
 * A lista de colunas que a consulta precisa pedir.
 *
 * Pede só o que o bloco usa em vez de `*`: num painel de TV com dez blocos
 * atualizando, a diferença entre trazer 6 colunas e 35 é sentida no 4G do
 * galpão. Colunas fora do catálogo são descartadas de propósito — é o que
 * garante que um painel editado à mão não vire consulta livre.
 */
export function selectDoBloco(chaveFonte, camposUsados) {
  const fonte = fonteDe(chaveFonte)
  if (!fonte) return null
  const validos = new Set(fonte.campos.map((c) => c.campo))
  const pedidos = [...new Set((camposUsados || []).filter((c) => c && validos.has(c)))]
  if (!pedidos.length) return fonte.campos[0]?.campo || null
  return pedidos.join(', ')
}
