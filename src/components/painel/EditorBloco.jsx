import { useEffect, useState } from 'react'
import { Plus, X, AlertTriangle } from 'lucide-react'
import {
  Modal, Botao, Campo, Entrada, Area, Selecao,
} from '../ui'
import { FONTES, fonteDe, camposPorTipo } from '../../lib/painelFontes'
import {
  OPERACOES, M_OPERACAO, COMPARADORES, M_COMPARADOR, GRANULARIDADES, validarBloco,
} from '../../lib/painelDados'

/**
 * O formulário de um bloco.
 *
 * O que aparece depende do tipo: um cartão de número não pergunta por
 * agrupamento, um gráfico de linha não pergunta por coluna de tabela.
 * Mostrar tudo pra todo mundo deixaria a tela cheia de campo que não faz
 * nada — que é como a maioria dos construtores de dashboard afasta quem
 * não é analista.
 */

export const TIPOS_BLOCO = [
  { valor: 'numero', rotulo: 'Número', dica: 'Um valor grande: total, média, contagem' },
  { valor: 'barras', rotulo: 'Barras', dica: 'Comparar categorias entre si' },
  { valor: 'linha', rotulo: 'Linha do tempo', dica: 'Como o número anda ao longo dos dias' },
  { valor: 'pizza', rotulo: 'Pizza', dica: 'Quanto cada parte representa do todo' },
  { valor: 'lista', rotulo: 'Lista', dica: 'As linhas em si, numa tabela' },
  { valor: 'texto', rotulo: 'Texto', dica: 'Um título ou uma explicação no meio do painel' },
]

const precisaAgrupar = (tipo) => ['barras', 'pizza'].includes(tipo)
const precisaConta = (tipo) => tipo !== 'texto' && tipo !== 'lista'

export default function EditorBloco({ bloco, aberto, aoFechar, aoSalvar }) {
  const [campo, setCampo] = useState(bloco)

  useEffect(() => { setCampo(bloco) }, [bloco])

  if (!campo) return null

  const fonte = fonteDe(campo.fonte)
  const validacao = validarBloco(campo)
  const op = M_OPERACAO[campo.operacao]

  const mudar = (mudancas) => setCampo((c) => ({ ...c, ...mudancas }))

  // Trocar de fonte zera o que era daquela fonte. Manter "custo_total"
  // selecionado ao pular de Serviços pra 5S deixaria o bloco apontando pra
  // um campo que não existe mais, e o erro só apareceria no gráfico vazio.
  const trocarFonte = (chave) => {
    const nova = fonteDe(chave)
    mudar({
      fonte: chave,
      campoValor: '',
      agruparPor: '',
      campoData: nova?.campoDataPadrao || '',
      colunas: [],
      ordenarPor: '',
      filtros: [],
    })
  }

  const trocarTipo = (tipo) => {
    mudar({
      tipo,
      // Lista não faz conta, e texto não tem fonte: limpa o que não serve
      // mais pra não salvar sujeira no jsonb.
      operacao: tipo === 'lista' ? undefined : campo.operacao || 'contar',
      agruparPor: precisaAgrupar(tipo) ? campo.agruparPor : '',
    })
  }

  const camposTexto = campo.fonte ? camposPorTipo(campo.fonte, 'texto', 'booleano') : []
  const camposNumero = campo.fonte ? camposPorTipo(campo.fonte, 'numero') : []
  const camposData = campo.fonte ? camposPorTipo(campo.fonte, 'data') : []
  const todosCampos = fonte?.campos || []

  const mudarFiltro = (i, mudancas) =>
    mudar({ filtros: (campo.filtros || []).map((f, idx) => (idx === i ? { ...f, ...mudancas } : f)) })

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Bloco do painel"
      largura="max-w-2xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={() => aoSalvar(campo)} disabled={!validacao.ok}>Aplicar</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Tipo de bloco">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {TIPOS_BLOCO.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => trocarTipo(t.valor)}
                className={`rounded-lg border-2 px-2.5 py-2 text-left transition ${
                  campo.tipo === t.valor
                    ? 'border-sky-500 bg-sky-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="block text-sm font-medium text-slate-800">{t.rotulo}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{t.dica}</span>
              </button>
            ))}
          </div>
        </Campo>

        <Campo rotulo="Título do bloco">
          <Entrada
            value={campo.titulo || ''}
            onChange={(e) => mudar({ titulo: e.target.value })}
            placeholder="Ex.: Custo de manutenção por setor"
          />
        </Campo>

        {campo.tipo === 'texto' ? (
          <Campo rotulo="Texto" dica="Serve pra separar seções ou anotar o que o painel quer dizer">
            <Area rows={4} value={campo.texto || ''} onChange={(e) => mudar({ texto: e.target.value })} />
          </Campo>
        ) : (
          <>
            <Campo rotulo="De onde vêm os dados" dica={fonte?.descricao}>
              <Selecao value={campo.fonte || ''} onChange={(e) => trocarFonte(e.target.value)}>
                <option value="">Escolha uma fonte…</option>
                {FONTES.map((f) => (
                  <option key={f.chave} value={f.chave}>{f.rotulo}</option>
                ))}
              </Selecao>
            </Campo>

            {campo.fonte && (
              <>
                {precisaConta(campo.tipo) && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Campo rotulo="Conta a fazer">
                      <Selecao
                        value={campo.operacao || 'contar'}
                        onChange={(e) => mudar({ operacao: e.target.value })}
                      >
                        {OPERACOES.map((o) => (
                          <option key={o.valor} value={o.valor}>{o.rotulo}</option>
                        ))}
                      </Selecao>
                    </Campo>
                    {op?.precisaCampo && (
                      <Campo rotulo="Sobre qual campo">
                        <Selecao
                          value={campo.campoValor || ''}
                          onChange={(e) => mudar({ campoValor: e.target.value })}
                        >
                          <option value="">Escolha…</option>
                          {(campo.operacao === 'contar_distintos' ? todosCampos : camposNumero).map((c) => (
                            <option key={c.campo} value={c.campo}>{c.rotulo}</option>
                          ))}
                        </Selecao>
                      </Campo>
                    )}
                  </div>
                )}

                {precisaAgrupar(campo.tipo) && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Campo rotulo="Agrupar por">
                      <Selecao
                        value={campo.agruparPor || ''}
                        onChange={(e) => mudar({ agruparPor: e.target.value })}
                      >
                        <option value="">Escolha…</option>
                        {[...camposTexto, ...camposData].map((c) => (
                          <option key={c.campo} value={c.campo}>{c.rotulo}</option>
                        ))}
                      </Selecao>
                    </Campo>
                    <Campo rotulo="Quantos mostrar" dica="O resto vira uma fatia “Outros”">
                      <Selecao
                        value={String(campo.limite || 8)}
                        onChange={(e) => mudar({ limite: Number(e.target.value) })}
                      >
                        {[4, 6, 8, 10, 12, 20].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </Selecao>
                    </Campo>
                  </div>
                )}

                {campo.tipo === 'linha' && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Campo rotulo="Data do eixo">
                      <Selecao
                        value={campo.campoData || ''}
                        onChange={(e) => mudar({ campoData: e.target.value })}
                      >
                        <option value="">Escolha…</option>
                        {camposData.map((c) => (
                          <option key={c.campo} value={c.campo}>{c.rotulo}</option>
                        ))}
                      </Selecao>
                    </Campo>
                    <Campo rotulo="Juntar">
                      <Selecao
                        value={campo.granularidade || 'dia'}
                        onChange={(e) => mudar({ granularidade: e.target.value })}
                      >
                        {GRANULARIDADES.map((g) => (
                          <option key={g.valor} value={g.valor}>{g.rotulo}</option>
                        ))}
                      </Selecao>
                    </Campo>
                  </div>
                )}

                {campo.tipo === 'lista' && (
                  <>
                    <Campo rotulo="Colunas" dica="Toque pra incluir ou tirar">
                      <div className="flex flex-wrap gap-1.5">
                        {todosCampos.map((c) => {
                          const dentro = (campo.colunas || []).includes(c.campo)
                          return (
                            <button
                              key={c.campo}
                              type="button"
                              onClick={() =>
                                mudar({
                                  colunas: dentro
                                    ? campo.colunas.filter((x) => x !== c.campo)
                                    : [...(campo.colunas || []), c.campo],
                                })
                              }
                              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                                dentro
                                  ? 'bg-sky-100 text-sky-700 ring-1 ring-sky-200'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {c.rotulo}
                            </button>
                          )
                        })}
                      </div>
                    </Campo>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <Campo rotulo="Ordenar por">
                        <Selecao
                          value={campo.ordenarPor || ''}
                          onChange={(e) => mudar({ ordenarPor: e.target.value })}
                        >
                          <option value="">Como vier</option>
                          {todosCampos.map((c) => (
                            <option key={c.campo} value={c.campo}>{c.rotulo}</option>
                          ))}
                        </Selecao>
                      </Campo>
                      <Campo rotulo="Sentido">
                        <Selecao
                          value={campo.ordemDecrescente ? 'desc' : 'asc'}
                          onChange={(e) => mudar({ ordemDecrescente: e.target.value === 'desc' })}
                        >
                          <option value="asc">Do menor pro maior</option>
                          <option value="desc">Do maior pro menor</option>
                        </Selecao>
                      </Campo>
                      <Campo rotulo="Quantas linhas">
                        <Selecao
                          value={String(campo.limite || 50)}
                          onChange={(e) => mudar({ limite: Number(e.target.value) })}
                        >
                          {[10, 20, 50, 100, 200].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </Selecao>
                      </Campo>
                    </div>
                  </>
                )}

                <Campo rotulo="Filtros" dica="Todos precisam valer ao mesmo tempo">
                  <div className="space-y-2">
                    {(campo.filtros || []).map((f, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-1.5">
                        <Selecao
                          className="min-w-0 flex-1"
                          value={f.campo || ''}
                          onChange={(e) => mudarFiltro(i, { campo: e.target.value })}
                        >
                          <option value="">Campo…</option>
                          {todosCampos.map((c) => (
                            <option key={c.campo} value={c.campo}>{c.rotulo}</option>
                          ))}
                        </Selecao>
                        <Selecao
                          className="w-auto"
                          value={f.comparador || 'igual'}
                          onChange={(e) => mudarFiltro(i, { comparador: e.target.value })}
                        >
                          {COMPARADORES.map((c) => (
                            <option key={c.valor} value={c.valor}>{c.rotulo}</option>
                          ))}
                        </Selecao>
                        {M_COMPARADOR[f.comparador || 'igual']?.precisaValor && (
                          <Entrada
                            className="min-w-0 flex-1"
                            value={f.valor ?? ''}
                            onChange={(e) => mudarFiltro(i, { valor: e.target.value })}
                            placeholder="valor"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => mudar({ filtros: campo.filtros.filter((_, idx) => idx !== i) })}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Tirar filtro"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <Botao
                      tamanho="sm"
                      variante="secundario"
                      onClick={() =>
                        mudar({ filtros: [...(campo.filtros || []), { campo: '', comparador: 'igual', valor: '' }] })
                      }
                    >
                      <Plus size={14} /> Filtro
                    </Botao>
                  </div>
                </Campo>
              </>
            )}
          </>
        )}

        {!validacao.ok && (
          <div className="flex gap-2 rounded-lg bg-amber-50 p-2.5 ring-1 ring-amber-200 ring-inset">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-900">{validacao.erro}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
