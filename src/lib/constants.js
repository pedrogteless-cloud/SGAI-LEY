/**
 * Rótulos que aparecem na tela.
 *
 * O `valor` é o que está gravado no banco e não muda — quem lê relatório ou
 * consulta o Postgres continua vendo 'corretiva', 'em_execucao', 'baixado'.
 * O `label` é escrito no jeito que o pessoal da fábrica fala.
 */

export const CRITICIDADES = [
  { valor: 'A', label: 'A — para a produção', cor: 'bg-red-100 text-red-700 ring-red-200' },
  { valor: 'B', label: 'B — atrapalha, mas dá pra tocar', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'C', label: 'C — dá pra esperar', cor: 'bg-slate-100 text-slate-600 ring-slate-200' },
]

export const SITUACOES_ATIVO = [
  { valor: 'operando', label: 'Funcionando', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { valor: 'parado', label: 'Parada', cor: 'bg-red-100 text-red-700 ring-red-200' },
  { valor: 'em_manutencao', label: 'Em conserto', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'reserva', label: 'De reserva', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'baixado', label: 'Fora de uso', cor: 'bg-slate-100 text-slate-500 ring-slate-200' },
]

export const STATUS_OS = [
  { valor: 'aberta', label: 'Esperando liberação', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'aprovada', label: 'Liberada', cor: 'bg-indigo-100 text-indigo-700 ring-indigo-200' },
  { valor: 'em_execucao', label: 'Em andamento', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'pausada', label: 'Parada no meio', cor: 'bg-orange-100 text-orange-700 ring-orange-200' },
  { valor: 'concluida', label: 'Pronta', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { valor: 'cancelada', label: 'Cancelada', cor: 'bg-slate-100 text-slate-500 ring-slate-200' },
]

export const TIPOS_OS = [
  { valor: 'corretiva', label: 'Conserto' },
  { valor: 'preventiva', label: 'Revisão' },
  { valor: 'preditiva', label: 'Inspeção' },
  { valor: 'melhoria', label: 'Melhoria' },
  { valor: 'instalacao', label: 'Instalação' },
]

export const PRIORIDADES = [
  { valor: 'baixa', label: 'Pode esperar', cor: 'bg-slate-100 text-slate-600 ring-slate-200' },
  { valor: 'media', label: 'Normal', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'alta', label: 'Urgente', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'emergencia', label: 'Parou a produção', cor: 'bg-red-100 text-red-700 ring-red-200' },
]

export const STATUS_SOLICITACAO = [
  { valor: 'aberta', label: 'Esperando', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'em_triagem', label: 'Olhando', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'convertida', label: 'Virou serviço', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { valor: 'rejeitada', label: 'Recusado', cor: 'bg-slate-100 text-slate-500 ring-slate-200' },
]

export const TIPOS_PARTIDA = [
  { valor: 'direta', label: 'Direta' },
  { valor: 'estrela_triangulo', label: 'Estrela-triângulo' },
  { valor: 'soft_starter', label: 'Soft-starter' },
  { valor: 'inversor', label: 'Inversor de frequência' },
  { valor: 'compensadora', label: 'Compensadora' },
  { valor: 'nao_aplicavel', label: 'Não tem' },
]

export const TIPOS_MOVIMENTO = [
  { valor: 'entrada', label: 'Chegou peça (compra)' },
  { valor: 'saida', label: 'Saiu peça' },
  { valor: 'devolucao', label: 'Voltou peça' },
  { valor: 'ajuste', label: 'Acerto de contagem' },
]

export const TIPOS_SERVICO = [
  'torno', 'retifica', 'solda', 'usinagem', 'eletrica', 'eletronica',
  'hidraulica', 'pneumatica', 'refrigeracao', 'calibracao', 'laudo', 'peca', 'outro',
]

/* --------------------------------------- Chão de fábrica: desperdícios */

export const STATUS_RELATORIO_CHAO = [
  { valor: 'aberta', label: 'Aberta', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'em_andamento', label: 'Em andamento', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'concluida', label: 'Concluída', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { valor: 'reaberta', label: 'Reaberta', cor: 'bg-orange-100 text-orange-700 ring-orange-200' },
  { valor: 'cancelada', label: 'Cancelada', cor: 'bg-slate-100 text-slate-500 ring-slate-200' },
]

export const TIPOS_MOVIMENTACAO_RESIDUO = [
  { valor: 'geracao', label: 'Geração de resíduo', grupo: 'desperdicio' },
  { valor: 'identificado_reaproveitavel', label: 'Identificado como reaproveitável', grupo: 'reaproveitamento' },
  { valor: 'separado', label: 'Separado', grupo: 'reaproveitamento' },
  { valor: 'enviado_moagem', label: 'Enviado para moagem', grupo: 'reaproveitamento' },
  { valor: 'moido', label: 'Material moído', grupo: 'reaproveitamento' },
  { valor: 'reutilizacao_interna', label: 'Reutilização interna concluída', grupo: 'reaproveitamento' },
  { valor: 'venda_reciclagem', label: 'Venda ou reciclagem externa', grupo: 'reaproveitamento' },
  { valor: 'descarte', label: 'Descarte', grupo: 'reaproveitamento' },
  { valor: 'ajuste_positivo', label: 'Ajuste positivo', grupo: 'reaproveitamento' },
  { valor: 'ajuste_negativo', label: 'Ajuste negativo', grupo: 'reaproveitamento' },
]

export const ETAPAS_REAPROVEITAMENTO = TIPOS_MOVIMENTACAO_RESIDUO.filter(
  (t) => t.grupo === 'reaproveitamento' && !t.valor.startsWith('ajuste')
)

export const ORIGENS_RESIDUO = [
  { valor: 'producao', label: 'Produção' },
  { valor: 'corte', label: 'Corte' },
  { valor: 'colagem', label: 'Colagem' },
  { valor: 'montagem', label: 'Montagem' },
  { valor: 'reforma_colchoes', label: 'Reforma de colchões' },
  { valor: 'devolucao', label: 'Devolução ou produto defeituoso' },
  { valor: 'manutencao', label: 'Manutenção' },
  { valor: 'estoque', label: 'Estoque' },
  { valor: 'outro', label: 'Outro' },
]

export const CONDICOES_RESIDUO = [
  { valor: 'limpo', label: 'Limpo e aproveitável', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { valor: 'parcialmente_aproveitavel', label: 'Parcialmente aproveitável', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'contaminado', label: 'Contaminado', cor: 'bg-red-100 text-red-700 ring-red-200' },
  { valor: 'sem_aproveitamento', label: 'Sem possibilidade de aproveitamento', cor: 'bg-slate-100 text-slate-500 ring-slate-200' },
  { valor: 'aguardando_avaliacao', label: 'Aguardando avaliação', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
]

export const DESTINACOES_RESIDUO = [
  { valor: 'estoque_residuos', label: 'Estoque de resíduos' },
  { valor: 'separacao', label: 'Separação' },
  { valor: 'moagem', label: 'Moagem' },
  { valor: 'reutilizacao_interna', label: 'Reutilização interna' },
  { valor: 'venda_reciclagem', label: 'Venda ou reciclagem' },
  { valor: 'descarte', label: 'Descarte' },
  { valor: 'aguardando_definicao', label: 'Aguardando definição' },
]

export const MOTIVOS_RESIDUO_SUGERIDOS = [
  'Retalho normal do processo', 'Erro de medida', 'Corte incorreto', 'Defeito de espumação',
  'Densidade fora do padrão', 'Deformação', 'Contaminação com cola', 'Troca de produto',
  'Armazenamento inadequado', 'Material abandonado', 'Material sem identificação', 'Outro',
]

export const UNIDADES_MEDIDA_RESIDUO = [
  { valor: 'kg', label: 'kg' },
  { valor: 'unidade', label: 'unidade' },
  { valor: 'conjunto', label: 'conjunto' },
  { valor: 'm3', label: 'm³' },
  { valor: 'big_bag', label: 'big bag' },
]

// Checklist 5S — uma pergunta simples por S. Fase de aprendizado: sem
// cobrança, sem ranking, só o encarregado aprendendo a observar e o
// setor criando uma linha de base. A nota não é escolhida à mão: sai
// automática da soma das respostas (ver src/lib/chaoIndicadores.js).
export const ITENS_5S = [
  { item: 'seiri', titulo: 'Seiri — Utilização', pergunta: 'Existem materiais, objetos ou resíduos desnecessários no setor?' },
  { item: 'seiton', titulo: 'Seiton — Organização', pergunta: 'Ferramentas e materiais estão nos locais corretos e identificados?' },
  { item: 'seiso', titulo: 'Seiso — Limpeza', pergunta: 'Piso, máquinas e bancadas estão limpos?' },
  { item: 'seiketsu', titulo: 'Seiketsu — Padronização', pergunta: 'Demarcações, placas e padrões estão sendo respeitados?' },
  { item: 'shitsuke', titulo: 'Shitsuke — Disciplina', pergunta: 'O setor está mantendo a organização sem precisar de cobrança constante?' },
]

// Plano de ação: o pedaço que faz o problema achado no 5S virar conserto
// com dono e prazo, em vez de só ficar registrado.
export const STATUS_ACAO_CHAO = [
  { valor: 'aberta', label: 'Aberta', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'em_andamento', label: 'Em andamento', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'concluida', label: 'Concluída', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { valor: 'cancelada', label: 'Cancelada', cor: 'bg-slate-100 text-slate-500 ring-slate-200' },
]

export const PRIORIDADES_ACAO = [
  { valor: 'baixa', label: 'Baixa', cor: 'bg-slate-100 text-slate-600 ring-slate-200' },
  { valor: 'media', label: 'Média', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'alta', label: 'Alta', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'emergencia', label: 'Emergência', cor: 'bg-red-100 text-red-700 ring-red-200' },
]

export const RESPOSTAS_5S = [
  { valor: 'conforme', label: 'Conforme', pontos: 2, cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { valor: 'parcial', label: 'Parcial', pontos: 1, cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'nao_conforme', label: 'Não conforme', pontos: 0, cor: 'bg-red-100 text-red-700 ring-red-200' },
  { valor: 'nao_inspecionado', label: 'Não inspecionado', pontos: null, cor: 'bg-slate-100 text-slate-500 ring-slate-200' },
]

// Cor e rótulo da nota geral do setor (1 a 5, calculada) — por faixa, já
// que agora é um número com casa decimal, não mais uma das 5 opções fixas.
export function corDaNota5s(nota) {
  if (nota == null) return 'bg-slate-100 text-slate-500 ring-slate-200'
  if (nota < 2.5) return 'bg-red-100 text-red-700 ring-red-200'
  if (nota < 4) return 'bg-amber-100 text-amber-700 ring-amber-200'
  return 'bg-emerald-100 text-emerald-700 ring-emerald-200'
}
export function labelDaNota5s(nota) {
  if (nota == null) return '—'
  if (nota < 2.5) return 'Crítico'
  if (nota < 4) return 'Regular'
  return 'Bom'
}

/* ------------------------------------------------- pessoas e permissões */

// Os três papéis são o modelo de permissão de verdade: é o que o RLS do
// banco enxerga. A descrição existe pra tela não obrigar ninguém a
// adivinhar o que está entregando ao promover alguém.
export const PAPEIS = [
  {
    valor: 'operador',
    label: 'Operador',
    cor: 'bg-slate-100 text-slate-600 ring-slate-200',
    resumo: 'Avisa problema pelo QR da máquina',
    pode: ['Abrir aviso lendo o QR, falando ou escrevendo'],
    naoPode: ['Entrar no sistema', 'Ver custo de qualquer coisa'],
  },
  {
    valor: 'tecnico',
    label: 'Técnico',
    cor: 'bg-sky-100 text-sky-700 ring-sky-200',
    resumo: 'Executa o serviço e registra o que fez',
    pode: [
      'Entrar no sistema e ver as máquinas',
      'Tocar serviço, marcar passo, lançar peça e hora',
      'Fazer o checklist 5S e abrir ação',
      'Montar painéis pra si',
    ],
    naoPode: ['Liberar custo', 'Mexer em permissão', 'Ver a auditoria'],
  },
  {
    valor: 'gestor',
    label: 'Gestor',
    cor: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
    resumo: 'Tudo do técnico, mais dinheiro e pessoas',
    pode: [
      'Tudo o que o técnico faz',
      'Lançar e liberar custo, planejar revisão',
      'Criar pessoa e mudar permissão',
      'Ver a auditoria de quem fez o quê',
    ],
    naoPode: ['Mudar o próprio papel nem se desativar (trava contra se trancar de fora)'],
  },
]

// O que a auditoria mostra no lugar do nome cru da tabela.
export const M_TABELA_AUDITORIA = {
  perfis: 'Pessoa',
  unidades: 'Unidade',
  setores: 'Setor',
  ativos: 'Máquina',
  categorias_ativo: 'Categoria de máquina',
  quadros_eletricos: 'Quadro elétrico',
  ordens_servico: 'Serviço',
  solicitacoes_servico: 'Aviso',
  pecas: 'Peça',
  estoque: 'Estoque',
  fornecedores: 'Fornecedor',
  planos_preventiva: 'Plano de revisão',
  plano_templates: 'Modelo de revisão',
  relatorios_chao: 'Relatório do chão de fábrica',
  relatorio_chao_setores: 'Setor no relatório',
  acoes_chao: 'Ação do 5S',
  materiais_residuo: 'Material de resíduo',
  metas_chao: 'Meta',
  configuracoes: 'Configuração',
  residuo_lancamentos: 'Lançamento de resíduo',
}

export const M_OPERACAO_AUDITORIA = {
  insert: { label: 'Criou', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  update: { label: 'Alterou', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  delete: { label: 'Apagou', cor: 'bg-red-100 text-red-700 ring-red-200' },
  criar_usuario: { label: 'Criou pessoa', cor: 'bg-indigo-100 text-indigo-700 ring-indigo-200' },
}

// Nome de campo em português, pra auditoria não falar em snake_case.
export const M_CAMPO_AUDITORIA = {
  nome: 'nome', email: 'e-mail', telefone: 'telefone', papel: 'papel',
  unidade_id: 'unidade', ativo: 'situação (ativo/inativo)', custo_hora: 'custo por hora',
  pin_hash: 'PIN de campo', status: 'situação', prioridade: 'prioridade',
  responsavel_id: 'responsável', prazo: 'prazo', descricao: 'descrição',
  custo_total: 'custo total', quantidade: 'quantidade', nota: 'nota',
  observacao: 'observação', criticidade: 'importância', situacao: 'situação',
  setor_id: 'setor', categoria_id: 'categoria', titulo: 'título',
}

const mapa = (lista) => Object.fromEntries(lista.map((i) => [i.valor, i]))

export const M_PAPEL = mapa(PAPEIS)
export const M_CRITICIDADE = mapa(CRITICIDADES)
export const M_SITUACAO = mapa(SITUACOES_ATIVO)
export const M_STATUS_OS = mapa(STATUS_OS)
export const M_PRIORIDADE = mapa(PRIORIDADES)
export const M_STATUS_SOLIC = mapa(STATUS_SOLICITACAO)
export const M_TIPO_OS = mapa(TIPOS_OS)
export const M_STATUS_CHAO = mapa(STATUS_RELATORIO_CHAO)
export const M_TIPO_MOVIMENTACAO = mapa(TIPOS_MOVIMENTACAO_RESIDUO)
export const M_ORIGEM_RESIDUO = mapa(ORIGENS_RESIDUO)
export const M_CONDICAO_RESIDUO = mapa(CONDICOES_RESIDUO)
export const M_DESTINACAO_RESIDUO = mapa(DESTINACOES_RESIDUO)
export const M_UNIDADE_RESIDUO = mapa(UNIDADES_MEDIDA_RESIDUO)
export const M_RESPOSTA_5S = mapa(RESPOSTAS_5S)
export const M_STATUS_ACAO_CHAO = mapa(STATUS_ACAO_CHAO)
export const M_PRIORIDADE_ACAO = mapa(PRIORIDADES_ACAO)
export const M_ITEM_5S = Object.fromEntries(ITENS_5S.map((i) => [i.item, i]))
