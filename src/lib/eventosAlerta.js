import { AlertTriangle, BellRing, PauseCircle, Siren } from 'lucide-react'

// Fonte única dos 4 eventos que a TV do chão de fábrica sabe anunciar.
// Usado pela tela de configuração (Alertas.jsx) e por quem toca o som (ChaoDeFabrica.jsx).
export const EVENTOS_ALERTA = [
  {
    evento: 'emergencia',
    icone: Siren,
    cor: 'text-red-500',
    titulo: 'Emergência',
    descricao: 'Serviço ou aviso aberto com prioridade emergência',
    somPadrao: 'sirene',
  },
  {
    evento: 'maquina_parada',
    icone: AlertTriangle,
    cor: 'text-orange-500',
    titulo: 'Máquina parou',
    descricao: 'Uma máquina muda para "parado" agora',
    somPadrao: 'grave',
  },
  {
    evento: 'nova_solicitacao',
    icone: BellRing,
    cor: 'text-sky-500',
    titulo: 'Novo aviso',
    descricao: 'Operador abriu uma nova solicitação de serviço',
    somPadrao: 'sino',
  },
  {
    evento: 'os_pausada',
    icone: PauseCircle,
    cor: 'text-amber-500',
    titulo: 'Serviço pausado',
    descricao: 'Uma ordem de serviço em andamento foi pausada',
    somPadrao: 'suave',
  },
]

export const SOM_PADRAO = Object.fromEntries(EVENTOS_ALERTA.map((e) => [e.evento, e.somPadrao]))
