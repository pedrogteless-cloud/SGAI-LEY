import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fonteDe, selectDoBloco } from '../lib/painelFontes'
import { camposDoBloco, validarBloco, M_COMPARADOR } from '../lib/painelDados'

/**
 * Busca os dados de um bloco de painel.
 *
 * Hook próprio em vez do useTabela geral por dois motivos concretos:
 *
 * 1. Os filtros do bloco precisam ir pro banco, não ficar só no cliente.
 *    Com teto de linhas, filtrar depois de trazer daria resposta errada —
 *    o que a pessoa procura pode estar fora das primeiras N linhas.
 *    "Está vazio" em particular vira `is null`, que o useTabela descarta
 *    justamente por ter valor nulo.
 * 2. Pede a contagem total junto, pra tela conseguir dizer "mostrando
 *    2.000 de 7.431" em vez de desenhar um gráfico incompleto calado.
 */

/** Teto de linhas por bloco. Dez blocos numa TV já são 20 mil linhas. */
export const TETO_LINHAS = 2000

/** Do comparador da tela pro operador do PostgREST. */
const OPERADOR = {
  igual: 'eq',
  diferente: 'neq',
  maior: 'gt',
  maior_igual: 'gte',
  menor: 'lt',
  menor_igual: 'lte',
  contem: 'ilike',
}

function aplicarFiltroNaConsulta(consulta, filtro) {
  const { campo, comparador, valor } = filtro
  if (comparador === 'vazio') return consulta.is(campo, null)
  if (comparador === 'preenchido') return consulta.not(campo, 'is', null)

  const op = OPERADOR[comparador]
  if (!op) return consulta
  if (op === 'ilike') return consulta.ilike(campo, `%${valor}%`)
  return consulta[op](campo, valor)
}

export function useDadosDoBloco(bloco, { unidadeId, inicio, fim } = {}) {
  const fonte = fonteDe(bloco?.fonte)
  const validacao = validarBloco(bloco)
  const campos = camposDoBloco(bloco)

  // O período e a unidade do painel entram como campo de verdade, então
  // precisam vir no select mesmo que o bloco não mostre nenhum dos dois.
  const campoData = fonte?.campoDataPadrao
  const usaPeriodo = Boolean(campoData && (inicio || fim))
  const select = selectDoBloco(bloco?.fonte, [
    ...campos,
    ...(usaPeriodo ? [campoData] : []),
    ...(unidadeId && fonte?.campoUnidade ? [fonte.campoUnidade] : []),
  ])

  const filtrosValidos = (bloco?.filtros || []).filter(
    (f) => f?.campo && f?.comparador && (!M_COMPARADOR[f.comparador]?.precisaValor || f.valor !== '')
  )

  const ativo = Boolean(fonte) && validacao.ok && bloco?.tipo !== 'texto'

  const consulta = useQuery({
    queryKey: ['painel-bloco', fonte?.view, select, filtrosValidos, unidadeId, inicio, fim],
    enabled: ativo,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase.from(fonte.view).select(select, { count: 'exact' })

      if (unidadeId && fonte.campoUnidade) q = q.eq(fonte.campoUnidade, unidadeId)
      if (usaPeriodo && inicio) q = q.gte(campoData, inicio)
      if (usaPeriodo && fim) q = q.lte(campoData, fim)
      for (const f of filtrosValidos) q = aplicarFiltroNaConsulta(q, f)

      q = q.limit(TETO_LINHAS)

      const { data, error, count } = await q
      if (error) throw new Error(error.message)
      return { linhas: data || [], total: count ?? (data || []).length }
    },
  })

  return {
    ...consulta,
    linhas: consulta.data?.linhas || [],
    total: consulta.data?.total ?? 0,
    // A tela precisa saber pra avisar, não pra esconder.
    truncado: (consulta.data?.total ?? 0) > (consulta.data?.linhas.length ?? 0),
    validacao,
    fonte,
  }
}
