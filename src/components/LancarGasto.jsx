import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useRpc, useTabela, useFornecedores, useInvalidar } from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import { moeda } from '../lib/format'
import { TIPOS_OS, TIPOS_SERVICO } from '../lib/constants'
import { Botao, Campo, Entrada, Selecao, Modal, Erro, useAviso } from './ui'

const VAZIO = {
  ativo_id: '', descricao: '', data: new Date().toISOString().slice(0, 10), tipo: 'corretiva',
  peca_descricao: '', peca_valor: '', servico_tipo: 'torno', servico_valor: '',
  fornecedor_id: '', nota_fiscal: '', horas: '', custo_hora: '', horas_parada: '',
}

const n = (v) => Number(String(v).replace(',', '.')) || 0

/**
 * Caminho curto para o que mais importa: deixar a despesa registrada na máquina.
 * Cria o serviço já concluído, sem passar por aviso, triagem nem liberação.
 */
export default function LancarGasto({ aberto, aoFechar, ativoId = null }) {
  const navegar = useNavigate()
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const { perfil } = useAuth()

  const [form, setForm] = useState(VAZIO)
  const [detalhes, setDetalhes] = useState(false)
  const [erro, setErro] = useState(null)

  const ativos = useTabela('ativos', {
    select: 'id, codigo, nome, setor:setores(nome)',
    filtros: [['ativo', 'eq', true]],
    ordem: { coluna: 'nome' },
    ativo: aberto,
  })
  const fornecedores = useFornecedores()
  const lancar = useRpc('lancar_gasto')

  useEffect(() => {
    if (!aberto) return
    setErro(null)
    setDetalhes(false)
    setForm({
      ...VAZIO,
      ativo_id: ativoId || '',
      custo_hora: perfil?.custo_hora ? String(perfil.custo_hora) : '',
    })
  }, [aberto, ativoId, perfil])

  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  const total = n(form.peca_valor) + n(form.servico_valor) + n(form.horas) * n(form.custo_hora)
  const podeSalvar = form.ativo_id && form.descricao.trim().length >= 3 && total > 0

  const salvar = async () => {
    setErro(null)
    try {
      const osId = await lancar.mutateAsync({
        p_ativo: form.ativo_id,
        p_descricao: form.descricao.trim(),
        p_data: form.data,
        p_tipo: form.tipo,
        p_peca_descricao: form.peca_descricao.trim() || null,
        p_peca_valor: n(form.peca_valor) || null,
        p_servico_tipo: form.servico_tipo || null,
        p_servico_valor: n(form.servico_valor) || null,
        p_fornecedor_id: form.fornecedor_id || null,
        p_nota_fiscal: form.nota_fiscal.trim() || null,
        p_horas: n(form.horas) || null,
        p_custo_hora: n(form.custo_hora) || null,
        p_horas_parada: n(form.horas_parada) || null,
      })

      invalidar(
        'ordens_servico', 'ativos', 'vw_kpi_custo_por_ativo', 'vw_kpi_ranking_ativos',
        'vw_kpi_custo_mensal', 'vw_kpi_comparativo_unidades', 'vw_kpi_rav', 'vw_kpi_backlog_os'
      )
      aoFechar()
      avisar(`Gasto de ${moeda(total)} registrado na máquina.`)
      navegar(`/os/${osId}`)
    } catch (e) {
      setErro(e)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Lançar gasto na máquina"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} carregando={lancar.isPending} disabled={!podeSalvar}>
            Registrar {total > 0 ? moeda(total) : 'gasto'}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Para gasto que já aconteceu. O serviço entra no sistema já concluído — sem aviso,
          sem triagem, sem liberação.
        </p>

        <Campo rotulo="Qual máquina *">
          <Selecao value={form.ativo_id} onChange={mudar('ativo_id')} autoFocus>
            <option value="">Selecione…</option>
            {(ativos.data || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
                {a.setor?.nome ? ` — ${a.setor.nome}` : ''}
              </option>
            ))}
          </Selecao>
        </Campo>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="O que foi feito *" className="sm:col-span-2">
            <Entrada
              value={form.descricao}
              onChange={mudar('descricao')}
              placeholder="Ex.: rebobinamento do motor principal"
            />
          </Campo>
          <Campo rotulo="Quando">
            <Entrada type="date" value={form.data} onChange={mudar('data')} />
          </Campo>
        </div>

        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">
            Preencha só o que teve gasto — pode ser um, dois ou os três
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Peça — o que foi" className="sm:col-span-2">
              <Entrada
                value={form.peca_descricao}
                onChange={mudar('peca_descricao')}
                placeholder="Ex.: correia dentada HTD 8M"
              />
            </Campo>
            <Campo rotulo="Quanto (R$)">
              <Entrada
                type="number"
                step="0.01"
                min="0"
                value={form.peca_valor}
                onChange={mudar('peca_valor')}
              />
            </Campo>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Serviço de fora" className="sm:col-span-2">
              <Selecao value={form.servico_tipo} onChange={mudar('servico_tipo')}>
                {TIPOS_SERVICO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Quanto (R$)">
              <Entrada
                type="number"
                step="0.01"
                min="0"
                value={form.servico_valor}
                onChange={mudar('servico_valor')}
              />
            </Campo>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Horas da equipe" className="sm:col-span-2">
              <Entrada
                type="number"
                step="0.5"
                min="0"
                value={form.horas}
                onChange={mudar('horas')}
                placeholder="quantas horas a equipe gastou"
              />
            </Campo>
            <Campo rotulo="Valor da hora (R$)">
              <Entrada
                type="number"
                step="0.01"
                min="0"
                value={form.custo_hora}
                onChange={mudar('custo_hora')}
              />
            </Campo>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDetalhes((d) => !d)}
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
        >
          {detalhes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {detalhes ? 'Menos detalhes' : 'Quem fez, nota fiscal, tempo parada'}
        </button>

        {detalhes && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Quem fez o serviço de fora">
              <Selecao value={form.fornecedor_id} onChange={mudar('fornecedor_id')}>
                <option value="">—</option>
                {(fornecedores.data || []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Nota fiscal">
              <Entrada value={form.nota_fiscal} onChange={mudar('nota_fiscal')} />
            </Campo>
            <Campo rotulo="Máquina ficou parada (horas)" dica="Entra no cálculo de disponibilidade">
              <Entrada
                type="number"
                step="0.5"
                min="0"
                value={form.horas_parada}
                onChange={mudar('horas_parada')}
              />
            </Campo>
            <Campo rotulo="Que tipo de serviço">
              <Selecao value={form.tipo} onChange={mudar('tipo')}>
                {TIPOS_OS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-sky-50 px-4 py-2.5 ring-1 ring-sky-200 ring-inset">
            <span className="text-sm font-medium text-sky-800">Total do gasto</span>
            <span className="text-lg font-bold text-sky-900">{moeda(total)}</span>
          </div>
        )}

        <Erro erro={erro} />
      </div>
    </Modal>
  )
}
