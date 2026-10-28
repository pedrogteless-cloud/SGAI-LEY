import { useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSetores, useInvalidar } from '../hooks/useDados'
import { Botao, Modal, Erro, useAviso } from './ui'

/**
 * Inclui num relatório já aberto um setor que ficou desmarcado na
 * abertura. Antes não tinha volta: o setor esquecido ficava de fora do
 * 5S do dia inteiro. Só aparece quando há setor ativo da unidade que
 * ainda não está no relatório.
 */
export default function AdicionarSetores({ relatorioId, unidadeId, jaNoRelatorio }) {
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const setores = useSetores(unidadeId)
  const [aberto, setAberto] = useState(false)
  const [escolhidos, setEscolhidos] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  const presentes = new Set(jaNoRelatorio || [])
  const faltando = (setores.data || []).filter((s) => !presentes.has(s.id))
  if (!relatorioId || faltando.length === 0) return null

  const abrir = () => {
    // O caso comum é um setor esquecido: já vem marcado tudo que falta.
    setEscolhidos(faltando.map((s) => s.id))
    setErro(null)
    setAberto(true)
  }

  const alternar = (id) =>
    setEscolhidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))

  const salvar = async () => {
    setErro(null)
    setEnviando(true)
    const { error } = await supabase
      .from('relatorio_chao_setores')
      .upsert(
        escolhidos.map((setor_id) => ({ relatorio_id: relatorioId, setor_id })),
        { onConflict: 'relatorio_id,setor_id', ignoreDuplicates: true }
      )
    setEnviando(false)
    if (error) {
      setErro(new Error(error.message))
      return
    }
    setAberto(false)
    const nomes = faltando.filter((s) => escolhidos.includes(s.id)).map((s) => s.nome)
    avisar(nomes.length === 1 ? `${nomes[0]} incluído no relatório.` : `${nomes.length} setores incluídos no relatório.`)
    invalidar('relatorio_chao_setores', 'vw_relatorio_chao_resumo')
  }

  return (
    <>
      <div className="border-t border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={abrir}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700"
        >
          <Plus size={15} />
          Adicionar setor
          <span className="font-normal text-slate-500">
            ({faltando.length === 1 ? `${faltando[0].nome} está fora` : `${faltando.length} fora deste relatório`})
          </span>
        </button>
      </div>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Adicionar setor ao relatório"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)}>Cancelar</Botao>
            <Botao onClick={salvar} carregando={enviando} disabled={!escolhidos.length}>
              Adicionar {escolhidos.length || ''}
            </Botao>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Setores que ficaram de fora na abertura:</p>
          <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
            {faltando.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="size-4 accent-sky-600"
                    checked={escolhidos.includes(s.id)}
                    onChange={() => alternar(s.id)}
                  />
                  <span className="text-sm text-slate-800">{s.nome}</span>
                </label>
              </li>
            ))}
          </ul>
          <Erro erro={erro} />
        </div>
      </Modal>
    </>
  )
}
