export const CRITICIDADES = [
  { valor: 'A', label: 'A — para a linha', cor: 'bg-red-100 text-red-700 ring-red-200' },
  { valor: 'B', label: 'B — atrapalha', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'C', label: 'C — contornável', cor: 'bg-slate-100 text-slate-600 ring-slate-200' },
]

export const SITUACOES_ATIVO = [
  { valor: 'operando', label: 'Operando', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { valor: 'parado', label: 'Parado', cor: 'bg-red-100 text-red-700 ring-red-200' },
  { valor: 'em_manutencao', label: 'Em manutenção', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'reserva', label: 'Reserva', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'baixado', label: 'Baixado', cor: 'bg-slate-100 text-slate-500 ring-slate-200' },
]

export const STATUS_OS = [
  { valor: 'aberta', label: 'Aberta', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'aprovada', label: 'Aprovada', cor: 'bg-indigo-100 text-indigo-700 ring-indigo-200' },
  { valor: 'em_execucao', label: 'Em execução', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'pausada', label: 'Pausada', cor: 'bg-orange-100 text-orange-700 ring-orange-200' },
  { valor: 'concluida', label: 'Concluída', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { valor: 'cancelada', label: 'Cancelada', cor: 'bg-slate-100 text-slate-500 ring-slate-200' },
]

export const TIPOS_OS = [
  { valor: 'corretiva', label: 'Corretiva' },
  { valor: 'preventiva', label: 'Preventiva' },
  { valor: 'preditiva', label: 'Preditiva' },
  { valor: 'melhoria', label: 'Melhoria' },
  { valor: 'instalacao', label: 'Instalação' },
]

export const PRIORIDADES = [
  { valor: 'baixa', label: 'Baixa', cor: 'bg-slate-100 text-slate-600 ring-slate-200' },
  { valor: 'media', label: 'Média', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'alta', label: 'Alta', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'emergencia', label: 'Emergência', cor: 'bg-red-100 text-red-700 ring-red-200' },
]

export const STATUS_SOLICITACAO = [
  { valor: 'aberta', label: 'Aberta', cor: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { valor: 'em_triagem', label: 'Em triagem', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { valor: 'convertida', label: 'Virou OS', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { valor: 'rejeitada', label: 'Rejeitada', cor: 'bg-slate-100 text-slate-500 ring-slate-200' },
]

export const TIPOS_PARTIDA = [
  { valor: 'direta', label: 'Direta' },
  { valor: 'estrela_triangulo', label: 'Estrela-triângulo' },
  { valor: 'soft_starter', label: 'Soft-starter' },
  { valor: 'inversor', label: 'Inversor de frequência' },
  { valor: 'compensadora', label: 'Compensadora' },
  { valor: 'nao_aplicavel', label: 'Não se aplica' },
]

export const TIPOS_MOVIMENTO = [
  { valor: 'entrada', label: 'Entrada (compra)' },
  { valor: 'saida', label: 'Saída manual' },
  { valor: 'devolucao', label: 'Devolução' },
  { valor: 'ajuste', label: 'Ajuste de inventário' },
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
