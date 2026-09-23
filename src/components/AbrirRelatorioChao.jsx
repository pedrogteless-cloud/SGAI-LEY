import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useSetores, useTecnicos } from '../hooks/useDados'
import { data as fmtData } from '../lib/format'
import { hojeISO } from '../lib/tempo'
import { Botao, Campo, Entrada, Area, Selecao, Modal, Erro } from './ui'

/**
 * Abertura do relatório do dia. Mora num componente porque duas telas
 * precisam dela: Desperdícios e 5S. Antes o 5S só sabia mandar a pessoa
 * pra outra tela, o que virava um beco quando o relatório do dia tinha
 * sido cancelado.
 */
export default function AbrirRelatorioChao({ aberto, aoFechar, unidadeId, aoAbrir }) {
  // O formulário mora num componente interno montado só enquanto o modal
  // está aberto: assim cada abertura começa do zero por desmontagem, sem
  // efeito nenhum pra "resetar" estado de uma vez anterior.
  return aberto
    ? <Formulario aoFechar={aoFechar} unidadeId={unidadeId} aoAbrir={aoAbrir} />
    : null
}

function Formulario({ aoFechar, unidadeId, aoAbrir }) {
  const { perfil } = useAuth()
  const setores = useSetores(unidadeId)
  const tecnicos = useTecnicos()

  const [form, setForm] = useState({
    turno: '', responsavel_id: perfil?.id || '', horario_previsto: '', observacao_inicial: '',
  })
  // null = "todos os setores". Guardar assim, em vez de semear a lista
  // quando a consulta responde, evita o caso de o refetch remarcar setor
  // que a pessoa acabou de desmarcar.
  const [setoresIds, setSetoresIds] = useState(null)
  const [justificativa, setJustificativa] = useState('')
  const [pedeJustificativa, setPedeJustificativa] = useState(false)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const todosIds = (setores.data || []).map((s) => s.id)
  const selecionados = setoresIds ?? todosIds

  const alternarSetor = (id) =>
    setSetoresIds(
      selecionados.includes(id)
        ? selecionados.filter((s) => s !== id)
        : [...selecionados, id]
    )

  const abrirRelatorio = async () => {
    setErro(null)
    setEnviando(true)
    const { data: linhas, error } = await supabase.rpc('abrir_relatorio_chao', {
      p_unidade_id: unidadeId,
      // Mandamos a data explícita: o padrão da função é CURRENT_DATE, que
      // é a data do servidor em UTC — de noite isso já virou amanhã aqui.
      p_data: hojeISO(),
      p_turno: form.turno.trim() || null,
      p_responsavel_id: form.responsavel_id || null,
      p_setores_ids: selecionados,
      p_horario_previsto: form.horario_previsto || null,
      p_observacao_inicial: form.observacao_inicial.trim() || null,
      p_justificativa_duplicidade: justificativa.trim() || null,
    })
    setEnviando(false)
    if (error) {
      setErro(new Error(error.message))
      return
    }
    const linha = linhas?.[0]
    if (linha?.mensagem) {
      if (linha.mensagem.includes('gestor') && !pedeJustificativa) {
        setPedeJustificativa(true)
        return
      }
      setErro(new Error(linha.mensagem))
      return
    }
    aoFechar()
    aoAbrir(linha)
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Abrir relatório do dia"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={abrirRelatorio} carregando={enviando}>Abrir</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Data de hoje ({fmtData(hojeISO())}), preenchida sozinha.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Turno" dica="Opcional">
            <Entrada value={form.turno} onChange={(e) => setForm((f) => ({ ...f, turno: e.target.value }))} placeholder="Ex.: manhã" />
          </Campo>
          <Campo rotulo="Responsável">
            <Selecao value={form.responsavel_id} onChange={(e) => setForm((f) => ({ ...f, responsavel_id: e.target.value }))}>
              <option value="">—</option>
              {(tecnicos.data || []).map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </Selecao>
          </Campo>
        </div>
        <Campo rotulo="Horário previsto para conclusão" dica="Opcional">
          <Entrada type="time" value={form.horario_previsto} onChange={(e) => setForm((f) => ({ ...f, horario_previsto: e.target.value }))} />
        </Campo>
        <Campo rotulo="Setores a inspecionar">
          <div className="flex flex-wrap gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200 ring-inset">
            {(setores.data || []).map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  selecionados.includes(s.id)
                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selecionados.includes(s.id)}
                  onChange={() => alternarSetor(s.id)}
                />
                {s.nome}
              </label>
            ))}
          </div>
        </Campo>
        <Campo rotulo="Observação inicial" dica="Opcional">
          <Area rows={2} value={form.observacao_inicial} onChange={(e) => setForm((f) => ({ ...f, observacao_inicial: e.target.value }))} />
        </Campo>

        {pedeJustificativa && (
          <Campo rotulo="Já existe relatório pra hoje/unidade/turno — justifique pra abrir outro (só gestor)">
            <Area rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que precisa de um segundo relatório" />
          </Campo>
        )}

        <Erro erro={erro} />
      </div>
    </Modal>
  )
}
