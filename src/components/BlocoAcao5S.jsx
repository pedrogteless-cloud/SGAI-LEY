import { UserRound } from 'lucide-react'
import { Campo, Entrada, Selecao } from './ui'
import { PRIORIDADES_ACAO } from '../lib/constants'

/**
 * O pedaço do checklist 5S que transforma um item com ressalva em ação
 * com dono e prazo.
 *
 * É opcional de propósito: nesta fase de aprendizado o encarregado
 * primeiro aprende a enxergar o setor. Quando ele já sabe quem resolve,
 * preenche aqui e o problema entra no plano de ação — senão fica só
 * registrado, que continua sendo melhor do que não anotar.
 *
 * Basta preencher "quem resolve" OU "até quando" pra ação nascer; a
 * prioridade tem padrão (alta pra não conforme, média pra parcial), então
 * ninguém precisa decidir isso de pé no meio do galpão.
 */
export default function BlocoAcao5S({ resposta, pessoas, aoMudar }) {
  const vaiGerar = !!(resposta.acao_responsavel_id || resposta.acao_prazo)
  const prioridadePadrao = resposta.resposta === 'nao_conforme' ? 'Alta' : 'Média'

  return (
    <div
      className={`rounded-lg p-2.5 transition-colors ${
        vaiGerar ? 'bg-sky-50 ring-1 ring-sky-200 ring-inset' : 'bg-slate-50 ring-1 ring-slate-200 ring-inset'
      }`}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <UserRound size={13} strokeWidth={2} />
        Quem resolve e até quando
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {vaiGerar
          ? 'Isso vira uma ação no plano de ação do 5S e some da lista quando alguém concluir.'
          : 'Opcional. Se preencher um dos dois, o problema entra no plano de ação com dono e prazo.'}
      </p>
      <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
        <Campo rotulo="Quem resolve">
          <Selecao
            value={resposta.acao_responsavel_id}
            onChange={(e) => aoMudar('acao_responsavel_id', e.target.value)}
          >
            <option value="">Ninguém ainda</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Até quando">
          {/* Sem `min`: ação atrasada tem que continuar editável, senão
              não dá pra corrigir a data de uma pendência antiga. */}
          <Entrada
            type="date"
            value={resposta.acao_prazo}
            onChange={(e) => aoMudar('acao_prazo', e.target.value)}
          />
        </Campo>
        <Campo rotulo="Prioridade">
          <Selecao
            value={resposta.acao_prioridade}
            onChange={(e) => aoMudar('acao_prioridade', e.target.value)}
            disabled={!vaiGerar}
          >
            <option value="">{prioridadePadrao} (padrão)</option>
            {PRIORIDADES_ACAO.map((p) => (
              <option key={p.valor} value={p.valor}>{p.label}</option>
            ))}
          </Selecao>
        </Campo>
      </div>
    </div>
  )
}
