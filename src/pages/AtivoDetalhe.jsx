import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  ArrowLeft, Pencil, Copy, QrCode, Zap, Wrench, Printer, Image as Imagem,
} from 'lucide-react'
import { useRegistro, useTabela, useRpc, useInvalidar } from '../hooks/useDados'
import { moeda, data, duracao, numero } from '../lib/format'
import { M_CRITICIDADE, M_SITUACAO, M_STATUS_OS, TIPOS_PARTIDA } from '../lib/constants'
import {
  Botao, Cartao, CartaoTitulo, Campo, Entrada, Etiqueta, Carregando, Vazio, Modal,
  Tabela, Th, Td, Erro, useAviso,
} from '../components/ui'

const Linha = ({ rotulo, valor }) => (
  <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
    <dt className="text-sm text-slate-500">{rotulo}</dt>
    <dd className="text-right text-sm font-medium text-slate-800">{valor ?? '—'}</dd>
  </div>
)

export default function AtivoDetalhe() {
  const { id } = useParams()
  const navegar = useNavigate()
  const avisar = useAviso()
  const invalidar = useInvalidar()

  const [qrUrl, setQrUrl] = useState(null)
  const [modalQR, setModalQR] = useState(false)
  const [modalClone, setModalClone] = useState(false)
  const [nomeClone, setNomeClone] = useState('')
  const [serieClone, setSerieClone] = useState('')
  const [erroClone, setErroClone] = useState(null)

  const ativo = useRegistro(
    'ativos',
    id,
    `*, categoria:categorias_ativo(nome, grupo), setor:setores(nome),
     unidade:unidades(nome, sigla), pai:ativo_pai_id(id, codigo, nome)`
  )
  const ficha = useTabela('ativo_ficha_eletrica', {
    select: '*, quadro:quadros_eletricos(id, nome, tag)',
    filtros: [['ativo_id', 'eq', id]],
  })
  const componentes = useTabela('ativos', {
    select: 'id, codigo, nome, criticidade, situacao',
    filtros: [['ativo_pai_id', 'eq', id]],
    ordem: { coluna: 'nome' },
  })
  const ordens = useTabela('ordens_servico', {
    select: 'id, numero, titulo, tipo, status, aberta_em, concluida_em, custo_total, tempo_parada_min',
    filtros: [['ativo_id', 'eq', id]],
    ordem: { coluna: 'aberta_em', asc: false },
  })
  const midias = useTabela('ativo_midias', {
    filtros: [['ativo_id', 'eq', id]],
    ordem: { coluna: 'ordem' },
  })
  const kpi = useTabela('vw_kpi_custo_por_ativo', { filtros: [['ativo_id', 'eq', id]] })
  const rav = useTabela('vw_kpi_rav', { filtros: [['ativo_id', 'eq', id]] })
  const mttr = useTabela('vw_kpi_mttr_mtbf', { filtros: [['ativo_id', 'eq', id]] })

  const clonar = useRpc('clonar_ativo', ['ativos'])

  const a = ativo.data
  const fe = ficha.data?.[0]
  const k = kpi.data?.[0]
  const r = rav.data?.[0]
  const m = mttr.data?.[0]

  const linkQR = a ? `${window.location.origin}/reportar/${a.qr_token}` : ''

  useEffect(() => {
    if (!linkQR) return
    QRCode.toDataURL(linkQR, { width: 640, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrUrl)
      .catch(() => setQrUrl(null))
  }, [linkQR])

  if (ativo.isLoading) return <Carregando />
  if (ativo.error || !a) return <Erro erro={ativo.error || new Error('Ativo não encontrado.')} />

  const confirmarClone = async () => {
    setErroClone(null)
    try {
      const novoId = await clonar.mutateAsync({
        p_ativo: id,
        p_nome: nomeClone.trim(),
        p_numero_serie: serieClone.trim() || null,
        p_copiar_componentes: true,
      })
      setModalClone(false)
      avisar('Ativo clonado. Ajuste o que muda.')
      invalidar('ativos')
      navegar(`/ativos/${novoId}/editar`)
    } catch (e) {
      setErroClone(e)
    }
  }

  const imprimirEtiqueta = () => window.print()

  return (
    <div className="space-y-5">
      <div className="nao-imprimir flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/ativos">
            <Botao variante="fantasma" tamanho="sm">
              <ArrowLeft size={16} />
            </Botao>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{a.nome}</h1>
              <Etiqueta cor={M_CRITICIDADE[a.criticidade]?.cor}>
                Criticidade {a.criticidade}
              </Etiqueta>
              <Etiqueta cor={M_SITUACAO[a.situacao]?.cor}>{M_SITUACAO[a.situacao]?.label}</Etiqueta>
            </div>
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {a.codigo}
              {a.pai && (
                <>
                  {' · componente de '}
                  <Link to={`/ativos/${a.pai.id}`} className="text-sky-600 hover:underline">
                    {a.pai.nome}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => setModalQR(true)}>
            <QrCode size={15} /> QR code
          </Botao>
          <Botao
            variante="secundario"
            onClick={() => {
              setNomeClone(`${a.nome} (cópia)`)
              setSerieClone('')
              setModalClone(true)
            }}
          >
            <Copy size={15} /> Clonar
          </Botao>
          <Link to={`/ativos/${id}/editar`}>
            <Botao>
              <Pencil size={15} /> Editar
            </Botao>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Custo 12 meses</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{moeda(k?.custo_12m)}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">RAV%</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {r?.rav_pct != null ? `${numero(r.rav_pct, 2)}%` : '—'}
          </p>
          {r?.sinal && r.sinal !== 'sem_valor_cadastrado' && (
            <p
              className={`mt-0.5 text-xs font-medium ${
                r.sinal === 'avaliar_substituicao'
                  ? 'text-red-600'
                  : r.sinal === 'atencao'
                    ? 'text-amber-600'
                    : 'text-emerald-600'
              }`}
            >
              {r.sinal === 'avaliar_substituicao'
                ? 'avaliar substituição'
                : r.sinal === 'atencao'
                  ? 'atenção'
                  : 'saudável'}
            </p>
          )}
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">MTTR</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {m?.mttr_horas != null ? `${numero(m.mttr_horas, 1)} h` : '—'}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{m?.falhas_12m || 0} falhas em 12m</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-slate-500">Parada acumulada</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {duracao(k?.parada_total_min || 0)}
          </p>
        </Cartao>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao className="lg:col-span-1">
          <CartaoTitulo>Ficha do equipamento</CartaoTitulo>
          <dl className="px-4 py-2">
            <Linha rotulo="Categoria" valor={a.categoria?.nome} />
            <Linha rotulo="Unidade" valor={a.unidade?.nome} />
            <Linha rotulo="Setor" valor={a.setor?.nome} />
            <Linha rotulo="Local" valor={a.localizacao} />
            <Linha rotulo="Fabricante" valor={a.fabricante} />
            <Linha rotulo="Modelo" valor={a.modelo} />
            <Linha rotulo="Nº de série" valor={a.numero_serie} />
            <Linha rotulo="Ano" valor={a.ano_fabricacao} />
            <Linha rotulo="Aquisição" valor={data(a.data_aquisicao)} />
            <Linha
              rotulo="Valor de aquisição"
              valor={a.valor_aquisicao ? moeda(a.valor_aquisicao) : null}
            />
            <Linha
              rotulo="Horímetro"
              valor={a.horimetro_atual ? `${numero(a.horimetro_atual, 1)} h` : null}
            />
          </dl>
        </Cartao>

        <Cartao className="lg:col-span-2">
          <CartaoTitulo>
            <span className="inline-flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" /> Ficha elétrica
            </span>
          </CartaoTitulo>
          {!fe ? (
            <Vazio
              icone={Zap}
              titulo="Ficha elétrica não preenchida"
              descricao="Sem ela não dá pra saber o que para se o quadro cair."
              acao={
                <Link to={`/ativos/${id}/editar`}>
                  <Botao variante="secundario" tamanho="sm">
                    Preencher agora
                  </Botao>
                </Link>
              }
            />
          ) : (
            <dl className="grid gap-x-6 px-4 py-2 sm:grid-cols-2">
              <Linha rotulo="Tensão" valor={fe.tensao_v ? `${numero(fe.tensao_v)} V` : null} />
              <Linha
                rotulo="Fases"
                valor={
                  fe.fases ? ['', 'Monofásico', 'Bifásico', 'Trifásico'][fe.fases] : null
                }
              />
              <Linha
                rotulo="Potência"
                valor={
                  [
                    fe.potencia_kw ? `${numero(fe.potencia_kw, 2)} kW` : null,
                    fe.potencia_cv ? `${numero(fe.potencia_cv, 1)} CV` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || null
                }
              />
              <Linha
                rotulo="Corrente nominal"
                valor={fe.corrente_nominal_a ? `${numero(fe.corrente_nominal_a, 2)} A` : null}
              />
              <Linha rotulo="Disjuntor" valor={fe.disjuntor} />
              <Linha
                rotulo="Tipo de partida"
                valor={TIPOS_PARTIDA.find((t) => t.valor === fe.tipo_partida)?.label}
              />
              <Linha
                rotulo="Quadro"
                valor={
                  fe.quadro ? `${fe.quadro.nome}${fe.quadro.tag ? ` (${fe.quadro.tag})` : ''}` : null
                }
              />
              <Linha rotulo="Circuito" valor={fe.circuito} />
            </dl>
          )}
        </Cartao>
      </div>

      {(componentes.data || []).length > 0 && (
        <Cartao>
          <CartaoTitulo>Componentes</CartaoTitulo>
          <Tabela>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Componente</Th>
                <Th>Criticidade</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {componentes.data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      to={`/ativos/${c.id}`}
                      className="font-mono text-xs text-sky-600 hover:underline"
                    >
                      {c.codigo}
                    </Link>
                  </Td>
                  <Td className="font-medium text-slate-800">{c.nome}</Td>
                  <Td>
                    <Etiqueta cor={M_CRITICIDADE[c.criticidade]?.cor}>{c.criticidade}</Etiqueta>
                  </Td>
                  <Td>
                    <Etiqueta cor={M_SITUACAO[c.situacao]?.cor}>
                      {M_SITUACAO[c.situacao]?.label}
                    </Etiqueta>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </Cartao>
      )}

      <Cartao>
        <CartaoTitulo>
          <span className="inline-flex items-center gap-1.5">
            <Wrench size={14} className="text-slate-400" /> Histórico de manutenção
          </span>
        </CartaoTitulo>
        {ordens.isLoading ? (
          <Carregando />
        ) : (ordens.data || []).length === 0 ? (
          <Vazio titulo="Sem manutenção registrada" descricao="Nenhuma OS foi aberta para este ativo." />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>OS</Th>
                <Th>Serviço</Th>
                <Th>Status</Th>
                <Th>Aberta</Th>
                <Th>Parada</Th>
                <Th className="text-right">Custo</Th>
              </tr>
            </thead>
            <tbody>
              {ordens.data.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <Td>
                    <Link to={`/os/${o.id}`} className="font-medium text-sky-600 hover:underline">
                      {o.numero}
                    </Link>
                  </Td>
                  <Td>
                    <p className="max-w-xs truncate text-slate-700">{o.titulo}</p>
                    <p className="text-xs text-slate-400 capitalize">{o.tipo}</p>
                  </Td>
                  <Td>
                    <Etiqueta cor={M_STATUS_OS[o.status]?.cor}>
                      {M_STATUS_OS[o.status]?.label}
                    </Etiqueta>
                  </Td>
                  <Td className="text-slate-600">{data(o.aberta_em)}</Td>
                  <Td className="text-slate-600">
                    {o.tempo_parada_min ? duracao(o.tempo_parada_min) : '—'}
                  </Td>
                  <Td className="text-right font-medium">{moeda(o.custo_total)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>

      <Cartao>
        <CartaoTitulo
          acao={
            <span className="text-xs text-slate-400">
              plaqueta, diagrama, manual, laudo, certificado
            </span>
          }
        >
          Galeria e documentos
        </CartaoTitulo>
        {(midias.data || []).length === 0 ? (
          <Vazio
            icone={Imagem}
            titulo="Nenhum arquivo anexado"
            descricao="Cadastre as URLs dos arquivos em Editar → foto de capa, ou suba para o Storage do Supabase."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-6">
            {midias.data.map((mid) => (
              <a
                key={mid.id}
                href={mid.url}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-lg border border-slate-200"
              >
                <img
                  src={mid.url}
                  alt={mid.titulo || mid.tipo}
                  className="aspect-square w-full object-cover transition group-hover:opacity-90"
                />
                <p className="truncate px-2 py-1 text-[11px] text-slate-500">
                  {mid.titulo || mid.tipo.replace('_', ' ')}
                </p>
              </a>
            ))}
          </div>
        )}
      </Cartao>

      {/* ------------------------------------------------------------ QR */}
      <Modal
        aberto={modalQR}
        aoFechar={() => setModalQR(false)}
        titulo="QR code do ativo"
        largura="max-w-sm"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModalQR(false)}>
              Fechar
            </Botao>
            <Botao onClick={imprimirEtiqueta}>
              <Printer size={15} /> Imprimir
            </Botao>
          </>
        }
      >
        <div className="text-center">
          {qrUrl ? (
            <img src={qrUrl} alt="QR code" className="mx-auto w-56" />
          ) : (
            <Carregando texto="Gerando QR…" />
          )}
          <p className="mt-3 font-mono text-sm font-semibold text-slate-800">{a.codigo}</p>
          <p className="text-sm text-slate-600">{a.nome}</p>
          <p className="mt-3 text-xs break-all text-slate-400">{linkQR}</p>
          <p className="mt-3 text-xs text-slate-500">
            Cole o adesivo na máquina. O operador escaneia e reporta o problema sem precisar de login.
          </p>
        </div>
      </Modal>

      {/* --------------------------------------------------------- Clone */}
      <Modal
        aberto={modalClone}
        aoFechar={() => setModalClone(false)}
        titulo="Clonar ativo"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModalClone(false)}>
              Cancelar
            </Botao>
            <Botao
              onClick={confirmarClone}
              carregando={clonar.isPending}
              disabled={!nomeClone.trim()}
            >
              <Copy size={15} /> Clonar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Copia ficha técnica, ficha elétrica e componentes. Depois é só ajustar o que muda.
          </p>
          <Campo rotulo="Nome do novo ativo">
            <Entrada value={nomeClone} onChange={(e) => setNomeClone(e.target.value)} autoFocus />
          </Campo>
          <Campo rotulo="Nº de série" dica="Deixe vazio se ainda não souber">
            <Entrada value={serieClone} onChange={(e) => setSerieClone(e.target.value)} />
          </Campo>
          <Erro erro={erroClone} />
        </div>
      </Modal>
    </div>
  )
}
