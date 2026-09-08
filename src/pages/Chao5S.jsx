import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTabela, useUnidades, useInvalidar } from '../hooks/useDados'
import { numero } from '../lib/format'
import { hojeISO } from '../lib/tempo'
import { ITENS_5S, RESPOSTAS_5S, M_STATUS_CHAO, corDaNota5s, labelDaNota5s } from '../lib/constants'
import {
  Botao, Cartao, CartaoTitulo, Campo, Entrada, Area, Selecao, Etiqueta, Carregando, Vazio,
  Modal, Erro, useAviso,
} from '../components/ui'
import GaleriaFotos from '../components/GaleriaFotos'

/**
 * Tela própria do checklist 5S — separada da tela de Desperdícios de
 * propósito: é o que o encarregado abre todo dia pra visitar os
 * setores, sem precisar entrar no relatório inteiro pra chegar lá.
 * Continua operando em cima do mesmo relatório do dia (um setor por
 * relatório, igual antes) — só muda onde se entra pra fazer isso.
 */
export default function Chao5S() {
  const { perfil } = useAuth()
  const avisar = useAviso()
  const invalidar = useInvalidar()

  const [unidadeId, setUnidadeId] = useState(perfil?.unidade_id || '')
  const [data, setData] = useState(hojeISO())
  const [relatorioId, setRelatorioId] = useState(null)

  const unidades = useUnidades()
  const unidadeAtual = unidadeId || unidades.data?.[0]?.id || ''

  const relatoriosDoDia = useTabela('vw_relatorio_chao_resumo', {
    filtros: [
      ...(unidadeAtual ? [['unidade_id', 'eq', unidadeAtual]] : []),
      ['data', 'eq', data],
    ],
    ordem: { coluna: 'aberta_em' },
  })

  useEffect(() => {
    setRelatorioId(null)
  }, [unidadeAtual, data])

  const lista = relatoriosDoDia.data || []
  const relatorioAtivo = (relatorioId ? lista.find((r) => r.id === relatorioId) : null) || lista[0] || null
  const podeEditar = relatorioAtivo && ['aberta', 'em_andamento', 'reaberta'].includes(relatorioAtivo.status)

  const setoresRel = useTabela('relatorio_chao_setores', {
    select: '*, setor:setores(nome)',
    filtros: [['relatorio_id', 'eq', relatorioAtivo?.id]],
    ativo: !!relatorioAtivo?.id,
  })
  const setor5s = useTabela('vw_relatorio_chao_setor_5s', {
    filtros: [['relatorio_id', 'eq', relatorioAtivo?.id]],
    ativo: !!relatorioAtivo?.id,
  })

  const [setorEditando, setSetorEditando] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function respostaVazia5s() {
    return { resposta: '', descricao_problema: '', quadrante: '', sugestao: '', fotos: [] }
  }
  function campoLimpezaVazio() {
    return {
      modo: 'checklist',
      respostas: Object.fromEntries(ITENS_5S.map((i) => [i.item, respostaVazia5s()])),
      justificativaSetor: '',
    }
  }
  const [formLimpeza, setFormLimpeza] = useState(campoLimpezaVazio())

  const abrirLimpeza = (s) => {
    const existentes = (setor5s.data || []).filter((x) => x.setor_avaliacao_id === s.id)
    const respostas = Object.fromEntries(
      ITENS_5S.map((i) => {
        const ex = existentes.find((x) => x.item === i.item)
        return [
          i.item,
          ex
            ? {
                resposta: ex.resposta,
                descricao_problema: ex.descricao_problema || '',
                quadrante: ex.quadrante || '',
                sugestao: ex.sugestao || '',
                fotos: [],
              }
            : respostaVazia5s(),
        ]
      })
    )
    setFormLimpeza({
      modo: s.nao_inspecionado ? 'nao_visitado' : 'checklist',
      respostas,
      justificativaSetor: s.justificativa_nao_inspecionado || '',
    })
    setSetorEditando(s)
    setErro(null)
    setModalAberto(true)
  }

  const mudarResposta5s = (item, campo, valor) =>
    setFormLimpeza((f) => ({
      ...f,
      respostas: { ...f.respostas, [item]: { ...f.respostas[item], [campo]: valor } },
    }))

  const salvarLimpeza = async () => {
    setErro(null)

    if (formLimpeza.modo === 'nao_visitado') {
      if (!formLimpeza.justificativaSetor.trim()) {
        setErro(new Error('Informe o motivo de não ter dado pra visitar esse setor.'))
        return
      }
      setEnviando(true)
      const { data: linhas, error } = await supabase.rpc('marcar_setor_nao_inspecionado', {
        p_relatorio_setor_id: setorEditando.id,
        p_justificativa: formLimpeza.justificativaSetor.trim(),
      })
      setEnviando(false)
      if (error) { setErro(new Error(error.message)); return }
      const linha = linhas?.[0]
      if (linha?.mensagem) { setErro(new Error(linha.mensagem)); return }
      setModalAberto(false)
      avisar('Setor marcado como não visitado hoje.')
      invalidar('relatorio_chao_setores', 'vw_relatorio_chao_setor_5s')
      return
    }

    if (ITENS_5S.some((i) => !formLimpeza.respostas[i.item].resposta)) {
      setErro(new Error('Responda as 5 perguntas do checklist.'))
      return
    }
    const semDescricao = ITENS_5S.find((i) => {
      const r = formLimpeza.respostas[i.item]
      return ['parcial', 'nao_conforme'].includes(r.resposta) && !r.descricao_problema.trim()
    })
    if (semDescricao) {
      setErro(new Error(`Descreva o problema encontrado em "${semDescricao.titulo}".`))
      return
    }

    setEnviando(true)
    const payload = ITENS_5S.map((i) => {
      const r = formLimpeza.respostas[i.item]
      return {
        item: i.item,
        resposta: r.resposta,
        descricao_problema: r.descricao_problema.trim() || null,
        quadrante: r.quadrante.trim() || null,
        sugestao: r.sugestao.trim() || null,
      }
    })
    const { data: linhas, error } = await supabase.rpc('responder_checklist_5s', {
      p_relatorio_setor_id: setorEditando.id,
      p_respostas: payload,
    })
    if (error) { setEnviando(false); setErro(new Error(error.message)); return }
    const linha = linhas?.[0]
    if (linha?.mensagem) { setEnviando(false); setErro(new Error(linha.mensagem)); return }

    const temFoto = ITENS_5S.some((i) => formLimpeza.respostas[i.item].fotos.length > 0)
    if (temFoto) {
      const { data: itensSalvos } = await supabase
        .from('relatorio_chao_setor_5s')
        .select('id, item')
        .eq('setor_avaliacao_id', setorEditando.id)
      const idPorItem = Object.fromEntries((itensSalvos || []).map((x) => [x.item, x.id]))
      const midias = ITENS_5S.flatMap((i) =>
        formLimpeza.respostas[i.item].fotos.map((f) => ({
          relatorio_id: relatorioAtivo.id,
          setor_avaliacao_id: setorEditando.id,
          setor_5s_id: idPorItem[i.item],
          url: f.url,
          enviado_por: perfil?.id ?? null,
        }))
      )
      if (midias.length) await supabase.from('relatorio_chao_midias').insert(midias)
    }

    setEnviando(false)
    setModalAberto(false)
    avisar('Avaliação salva.')
    invalidar('relatorio_chao_setores', 'vw_relatorio_chao_setor_5s')
  }

  return (
    <div className="entra space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">5S</h1>
          <p className="text-sm text-slate-500">Checklist diário de organização e limpeza por setor</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(unidades.data || []).length > 1 && (
            <Selecao value={unidadeAtual} onChange={(e) => setUnidadeId(e.target.value)} className="w-auto">
              {(unidades.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </Selecao>
          )}
          <Entrada type="date" className="w-auto" value={data} onChange={(e) => setData(e.target.value)} max={hojeISO()} />
        </div>
      </div>

      {lista.length > 1 && (
        <Selecao value={relatorioAtivo?.id || ''} onChange={(e) => setRelatorioId(e.target.value)} className="w-auto">
          {lista.map((r) => (
            <option key={r.id} value={r.id}>
              {r.numero}{r.turno ? ` · ${r.turno}` : ''} · {M_STATUS_CHAO[r.status]?.label}
            </option>
          ))}
        </Selecao>
      )}

      {relatoriosDoDia.isLoading ? (
        <Carregando />
      ) : !relatorioAtivo ? (
        <Cartao>
          <Vazio
            icone={ClipboardCheck}
            titulo="Nenhum relatório nesse dia"
            descricao={
              data === hojeISO()
                ? 'Abra o relatório do dia na tela de Desperdícios pra começar o checklist 5S.'
                : 'Escolha outra data, ou volte pra hoje.'
            }
            acao={
              data === hojeISO() && (
                <Link to="/desperdicios">
                  <Botao>Abrir relatório do dia <ArrowRight size={15} /></Botao>
                </Link>
              )
            }
          />
        </Cartao>
      ) : (
        <Cartao>
          <CartaoTitulo
            acao={
              <Link to={`/desperdicios/${relatorioAtivo.id}`} className="text-xs font-medium text-sky-600 hover:text-sky-700">
                Ver relatório completo →
              </Link>
            }
          >
            <span className="inline-flex items-center gap-2">
              <span className="font-mono text-xs font-medium text-slate-500">{relatorioAtivo.numero}</span>
              <Etiqueta cor={M_STATUS_CHAO[relatorioAtivo.status]?.cor}>{M_STATUS_CHAO[relatorioAtivo.status]?.label}</Etiqueta>
            </span>
          </CartaoTitulo>
          {(setoresRel.data || []).length === 0 ? (
            <Vazio titulo="Nenhum setor definido na abertura" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {setoresRel.data.map((s) => {
                const respostas5s = (setor5s.data || []).filter((x) => x.setor_avaliacao_id === s.id)
                const comProblema = respostas5s.filter((x) => x.resposta === 'parcial' || x.resposta === 'nao_conforme')
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{s.setor?.nome}</p>
                      {s.nao_inspecionado ? (
                        <p className="text-xs text-amber-600">Não visitado — {s.justificativa_nao_inspecionado}</p>
                      ) : s.nota != null ? (
                        <p className="text-xs text-slate-500">
                          {comProblema.length === 0
                            ? 'Tudo conforme no checklist'
                            : `${comProblema.length} item(ns) com ressalva no 5S`}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">Ainda não avaliado</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {s.nota != null && (
                        <Etiqueta cor={corDaNota5s(s.nota)}>
                          {numero(s.nota, 1)} · {labelDaNota5s(s.nota)}
                        </Etiqueta>
                      )}
                      {podeEditar && (
                        <Botao tamanho="sm" variante="secundario" onClick={() => abrirLimpeza(s)}>
                          {s.nota != null || s.nao_inspecionado ? 'Editar' : 'Avaliar'}
                        </Botao>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Cartao>
      )}

      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo={`Checklist 5S — ${setorEditando?.setor?.nome || ''}`}
        largura="max-w-2xl"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Botao>
            <Botao onClick={salvarLimpeza} carregando={enviando}>Salvar</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setFormLimpeza((f) => ({ ...f, modo: 'checklist' }))}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${formLimpeza.modo === 'checklist' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              Responder checklist
            </button>
            <button
              type="button"
              onClick={() => setFormLimpeza((f) => ({ ...f, modo: 'nao_visitado' }))}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${formLimpeza.modo === 'nao_visitado' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              Não deu pra visitar hoje
            </button>
          </div>

          {formLimpeza.modo === 'nao_visitado' ? (
            <Campo rotulo="Por que não deu pra visitar esse setor hoje? *">
              <Area
                rows={3}
                value={formLimpeza.justificativaSetor}
                onChange={(e) => setFormLimpeza((f) => ({ ...f, justificativaSetor: e.target.value }))}
                placeholder="Ex.: setor fechado por conta da manutenção da linha"
                autoFocus
              />
            </Campo>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                Responda com calma — é pra aprender a observar o setor, não pra tirar nota alta.
                Só peço detalhe quando a resposta for Parcial ou Não conforme.
              </p>
              {ITENS_5S.map((i) => {
                const r = formLimpeza.respostas[i.item]
                const precisaDetalhe = r.resposta === 'parcial' || r.resposta === 'nao_conforme'
                return (
                  <div key={i.item} className="rounded-lg p-3 ring-1 ring-slate-200 ring-inset">
                    <p className="text-sm font-semibold text-slate-800">{i.titulo}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{i.pergunta}</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {RESPOSTAS_5S.map((opt) => (
                        <button
                          key={opt.valor}
                          type="button"
                          onClick={() => mudarResposta5s(i.item, 'resposta', opt.valor)}
                          className={`rounded-lg border-2 px-2 py-1.5 text-center text-xs font-medium transition ${
                            r.resposta === opt.valor
                              ? 'border-sky-500 bg-sky-50 text-slate-800'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {precisaDetalhe && (
                      <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
                        <Campo rotulo="Descrição do problema *">
                          <Area
                            rows={2}
                            value={r.descricao_problema}
                            onChange={(e) => mudarResposta5s(i.item, 'descricao_problema', e.target.value)}
                          />
                        </Campo>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <Campo rotulo="Quadrante" dica='Ex.: "7C"'>
                            <Entrada
                              value={r.quadrante}
                              onChange={(e) => mudarResposta5s(i.item, 'quadrante', e.target.value)}
                            />
                          </Campo>
                          <Campo rotulo="Sugestão do que fazer" dica="Opcional">
                            <Entrada
                              value={r.sugestao}
                              onChange={(e) => mudarResposta5s(i.item, 'sugestao', e.target.value)}
                            />
                          </Campo>
                        </div>
                        <Campo rotulo="Foto" dica="Opcional">
                          <GaleriaFotos
                            valor={r.fotos}
                            aoMudar={(novo) => mudarResposta5s(i.item, 'fotos', novo)}
                          />
                        </Campo>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}

          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
