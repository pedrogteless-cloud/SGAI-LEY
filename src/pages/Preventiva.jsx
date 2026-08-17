import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, Plus, Play } from 'lucide-react'
import { useTabela, useRpc, useInvalidar } from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import { data, numero } from '../lib/format'
import { M_CRITICIDADE } from '../lib/constants'
import {
  Botao, Cartao, Etiqueta, Carregando, Vazio, Tabela, Th, Td, Modal, Campo,
  Selecao, Erro, useAviso,
} from '../components/ui'

const SITUACAO = {
  vencida: { label: 'Vencida', cor: 'bg-red-100 text-red-700 ring-red-200' },
  proxima: { label: 'Próxima', cor: 'bg-amber-100 text-amber-700 ring-amber-200' },
  em_dia: { label: 'Em dia', cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
}

export default function Preventiva() {
  const navegar = useNavigate()
  const avisar = useAviso()
  const invalidar = useInvalidar()
  const { ehGestor } = useAuth()

  const [modal, setModal] = useState(false)
  const [template, setTemplate] = useState('')
  const [ativoId, setAtivoId] = useState('')
  const [erro, setErro] = useState(null)

  const planos = useTabela('vw_kpi_preventivas_vencendo', { ordem: { coluna: 'proxima_data' } })
  const templates = useTabela('plano_templates', {
    select: '*, categoria:categorias_ativo(nome)',
    filtros: [['ativo', 'eq', true]],
    ordem: { coluna: 'nome' },
  })
  const ativos = useTabela('ativos', {
    select: 'id, codigo, nome, categoria_id',
    filtros: [['ativo', 'eq', true]],
    ordem: { coluna: 'nome' },
  })

  const aplicar = useRpc('aplicar_template_plano', [
    'planos_preventiva', 'vw_kpi_preventivas_vencendo',
  ])
  const gerarOS = useRpc('gerar_os_preventiva', [
    'ordens_servico', 'planos_preventiva', 'vw_kpi_preventivas_vencendo',
  ])

  const templateEscolhido = (templates.data || []).find((t) => t.id === template)
  const ativosCompativeis = (ativos.data || []).filter(
    (a) => !templateEscolhido?.categoria_id || a.categoria_id === templateEscolhido.categoria_id
  )

  const confirmarAplicar = async () => {
    setErro(null)
    try {
      await aplicar.mutateAsync({ p_template: template, p_ativo: ativoId })
      setModal(false)
      setTemplate('')
      setAtivoId('')
      avisar('Plano aplicado ao ativo.')
    } catch (e) {
      setErro(e)
    }
  }

  const gerar = async (planoId) => {
    setErro(null)
    try {
      const osId = await gerarOS.mutateAsync({ p_plano: planoId })
      invalidar('ordens_servico')
      avisar('OS preventiva gerada com o checklist.')
      navegar(`/os/${osId}`)
    } catch (e) {
      setErro(e)
    }
  }

  const lista = planos.data || []
  const vencidas = lista.filter((p) => p.situacao === 'vencida').length
  const proximas = lista.filter((p) => p.situacao === 'proxima').length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manutenção preventiva</h1>
          <p className="text-sm text-slate-500">
            {lista.length} planos · {vencidas} vencidos · {proximas} vencendo
          </p>
        </div>
        {ehGestor && (
          <Botao
            onClick={() => {
              setErro(null)
              setModal(true)
            }}
          >
            <Plus size={15} /> Aplicar template
          </Botao>
        )}
      </div>

      <Erro erro={erro} />

      <Cartao>
        {planos.isLoading ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio
            icone={CalendarClock}
            titulo="Nenhum plano preventivo"
            descricao="Monte o checklist uma vez por categoria e aplique em todas as máquinas iguais."
            acao={
              ehGestor && (
                <Botao onClick={() => setModal(true)}>
                  <Plus size={15} /> Aplicar template
                </Botao>
              )
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Plano</Th>
                <Th>Ativo</Th>
                <Th>Base</Th>
                <Th>Próxima</Th>
                <Th>Situação</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.plano_id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{p.plano}</Td>
                  <Td>
                    <Link
                      to={`/ativos/${p.ativo_id}`}
                      className="text-slate-700 hover:text-sky-700"
                    >
                      {p.ativo}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {p.unidade}
                      {p.criticidade && (
                        <>
                          {' · '}
                          <Etiqueta cor={M_CRITICIDADE[p.criticidade]?.cor}>
                            {p.criticidade}
                          </Etiqueta>
                        </>
                      )}
                    </p>
                  </Td>
                  <Td className="text-slate-600 capitalize">{p.base}</Td>
                  <Td className="text-slate-600">
                    {p.base === 'horimetro' ? (
                      <span>
                        {numero(p.proximo_horimetro, 0)} h
                        <span className="block text-xs text-slate-400">
                          atual {numero(p.horimetro_atual, 0)} h
                        </span>
                      </span>
                    ) : (
                      <span>
                        {data(p.proxima_data)}
                        {p.dias_restantes != null && (
                          <span className="block text-xs text-slate-400">
                            {p.dias_restantes < 0
                              ? `${Math.abs(p.dias_restantes)} dias atrasado`
                              : `em ${p.dias_restantes} dias`}
                          </span>
                        )}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Etiqueta cor={SITUACAO[p.situacao]?.cor}>{SITUACAO[p.situacao]?.label}</Etiqueta>
                  </Td>
                  <Td className="text-right">
                    <Botao
                      tamanho="sm"
                      variante="secundario"
                      onClick={() => gerar(p.plano_id)}
                      carregando={gerarOS.isPending}
                    >
                      <Play size={13} /> Gerar OS
                    </Botao>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>

      <Cartao>
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Templates de plano</h3>
          <p className="text-xs text-slate-400">
            Monte o checklist uma vez por categoria e aplique em todas as máquinas iguais
          </p>
        </div>
        {(templates.data || []).length === 0 ? (
          <Vazio titulo="Nenhum template" descricao="Cadastre pelo Supabase ou peça para o time criar." />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Template</Th>
                <Th>Categoria</Th>
                <Th>Periodicidade</Th>
              </tr>
            </thead>
            <tbody>
              {templates.data.map((t) => (
                <tr key={t.id}>
                  <Td>
                    <p className="font-medium text-slate-800">{t.nome}</p>
                    {t.descricao && <p className="text-xs text-slate-400">{t.descricao}</p>}
                  </Td>
                  <Td className="text-slate-600">{t.categoria?.nome || '—'}</Td>
                  <Td className="text-slate-600">
                    {t.periodicidade_dias ? `${t.periodicidade_dias} dias` : ''}
                    {t.periodicidade_horas ? ` · ${numero(t.periodicidade_horas)} h` : ''}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>

      <Modal
        aberto={modal}
        aoFechar={() => setModal(false)}
        titulo="Aplicar template a um ativo"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(false)}>
              Cancelar
            </Botao>
            <Botao
              onClick={confirmarAplicar}
              carregando={aplicar.isPending}
              disabled={!template || !ativoId}
            >
              Aplicar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Template *">
            <Selecao
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value)
                setAtivoId('')
              }}
            >
              <option value="">Selecione…</option>
              {(templates.data || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo
            rotulo="Ativo *"
            dica={
              templateEscolhido?.categoria?.nome
                ? `Mostrando só ativos da categoria ${templateEscolhido.categoria.nome}`
                : undefined
            }
          >
            <Selecao value={ativoId} onChange={(e) => setAtivoId(e.target.value)}>
              <option value="">Selecione…</option>
              {ativosCompativeis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo} · {a.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Erro erro={erro} />
        </div>
      </Modal>
    </div>
  )
}
