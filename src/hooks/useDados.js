import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/** Desembrulha a resposta do Supabase, transformando erro em exceção. */
const ok = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

/** Consulta genérica a uma tabela ou view. */
export function useTabela(tabela, { select = '*', filtros = [], ordem, limite, ativo = true } = {}) {
  return useQuery({
    queryKey: [tabela, select, filtros, ordem, limite],
    enabled: ativo,
    queryFn: async () => {
      let q = supabase.from(tabela).select(select)
      for (const [coluna, operador, valor] of filtros) {
        if (valor === undefined || valor === null || valor === '') continue
        q = q[operador](coluna, valor)
      }
      if (ordem) q = q.order(ordem.coluna, { ascending: ordem.asc ?? true })
      if (limite) q = q.limit(limite)
      return ok(await q)
    },
  })
}

export function useRegistro(tabela, id, select = '*') {
  return useQuery({
    queryKey: [tabela, 'registro', id, select],
    enabled: Boolean(id),
    queryFn: async () => ok(await supabase.from(tabela).select(select).eq('id', id).single()),
  })
}

/** Invalida todas as consultas das tabelas informadas. */
export function useInvalidar() {
  const qc = useQueryClient()
  return (...tabelas) => tabelas.forEach((t) => qc.invalidateQueries({ queryKey: [t] }))
}

export function useInserir(tabela, invalidar = []) {
  const inv = useInvalidar()
  return useMutation({
    mutationFn: async (linha) => ok(await supabase.from(tabela).insert(linha).select().single()),
    onSuccess: () => inv(tabela, ...invalidar),
  })
}

export function useAtualizar(tabela, invalidar = []) {
  const inv = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, ...campos }) =>
      ok(await supabase.from(tabela).update(campos).eq('id', id).select().single()),
    onSuccess: () => inv(tabela, ...invalidar),
  })
}

export function useRemover(tabela, invalidar = []) {
  const inv = useInvalidar()
  return useMutation({
    mutationFn: async (id) => ok(await supabase.from(tabela).delete().eq('id', id)),
    onSuccess: () => inv(tabela, ...invalidar),
  })
}

export function useRpc(nome, invalidar = []) {
  const inv = useInvalidar()
  return useMutation({
    mutationFn: async (params) => ok(await supabase.rpc(nome, params)),
    onSuccess: () => inv(...invalidar),
  })
}

/* ---------------------------------------------------- listas de apoio */

export const useUnidades = () =>
  useTabela('unidades', { filtros: [['ativo', 'eq', true]], ordem: { coluna: 'nome' } })

export const useSetores = (unidadeId) =>
  useTabela('setores', {
    select: '*, unidade:unidades(nome)',
    filtros: [
      ['ativo', 'eq', true],
      ...(unidadeId ? [['unidade_id', 'eq', unidadeId]] : []),
    ],
    ordem: { coluna: 'nome' },
  })

export const useCategorias = () =>
  useTabela('categorias_ativo', { filtros: [['ativo', 'eq', true]], ordem: { coluna: 'nome' } })

export const useQuadros = (unidadeId) =>
  useTabela('quadros_eletricos', {
    filtros: [
      ['ativo', 'eq', true],
      ...(unidadeId ? [['unidade_id', 'eq', unidadeId]] : []),
    ],
    ordem: { coluna: 'nome' },
  })

export const useFornecedores = () =>
  useTabela('fornecedores', { filtros: [['ativo', 'eq', true]], ordem: { coluna: 'nome' } })

export const usePecas = () =>
  useTabela('pecas', { filtros: [['ativo', 'eq', true]], ordem: { coluna: 'nome' } })

export const useTecnicos = () =>
  useTabela('perfis', {
    filtros: [
      ['ativo', 'eq', true],
      ['papel', 'in', ['tecnico', 'gestor']],
    ],
    ordem: { coluna: 'nome' },
  })
