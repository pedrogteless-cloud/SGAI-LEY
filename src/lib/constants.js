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

const mapa = (lista) => Object.fromEntries(lista.map((i) => [i.valor, i]))

export const M_CRITICIDADE = mapa(CRITICIDADES)
export const M_SITUACAO = mapa(SITUACOES_ATIVO)
export const M_STATUS_OS = mapa(STATUS_OS)
export const M_PRIORIDADE = mapa(PRIORIDADES)
export const M_STATUS_SOLIC = mapa(STATUS_SOLICITACAO)
export const M_TIPO_OS = mapa(TIPOS_OS)
