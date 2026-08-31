import { useState } from 'react'
import { FileSpreadsheet, Download } from 'lucide-react'
import { TIPOS_RELATORIO, gerarEBaixarRelatorio } from '../lib/relatoriosXlsx'
import { Botao, Cartao, CartaoTitulo, Campo, Selecao, Entrada, useAviso } from '../components/ui'

function inicioDoMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
const hojeISO = () => new Date().toISOString().slice(0, 10)

export default function Relatorios() {
  const [tipoId, setTipoId] = useState(TIPOS_RELATORIO[0].id)
  const [inicio, setInicio] = useState(inicioDoMes())
  const [fim, setFim] = useState(hojeISO())
  const [gerando, setGerando] = useState(false)
  const avisar = useAviso()

  const tipo = TIPOS_RELATORIO.find((t) => t.id === tipoId)

  const gerar = async () => {
    if (tipo.temPeriodo && inicio > fim) {
      avisar('A data inicial não pode ser depois da data final.', 'erro')
      return
    }
    setGerando(true)
    try {
      await gerarEBaixarRelatorio(tipoId, { inicio, fim })
      avisar('Planilha gerada.')
    } catch (e) {
      avisar(`Não consegui gerar a planilha: ${e.message}`, 'erro')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="entra space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Relatórios</h1>
        <p className="mt-1 text-sm text-slate-500">
          Escolha o tipo de relatório e o período — a planilha é gerada na hora, com os dados de agora.
        </p>
      </div>

      <Cartao className="max-w-xl">
        <CartaoTitulo>Gerar planilha</CartaoTitulo>
        <div className="space-y-4 p-4">
          <Campo rotulo="Tipo de relatório">
            <Selecao value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
              {TIPOS_RELATORIO.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </Selecao>
          </Campo>
          <p className="-mt-2 text-xs text-slate-400">{tipo.descricao}</p>

          {tipo.temPeriodo ? (
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="De">
                <Entrada type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} />
              </Campo>
              <Campo rotulo="Até">
                <Entrada type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
              </Campo>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200 ring-inset">
              Este relatório não tem período escolhível — {tipo.descricao.toLowerCase()}.
            </div>
          )}

          <Botao onClick={gerar} carregando={gerando} className="w-full">
            <Download size={16} /> Baixar planilha (.xlsx)
          </Botao>
        </div>
      </Cartao>

      <div className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2.5 text-xs text-sky-800 ring-1 ring-sky-200 ring-inset max-w-xl">
        <FileSpreadsheet size={15} className="mt-0.5 shrink-0" />
        Cada relatório sai com as mesmas cores da tela — importância A em vermelho, B em âmbar — e as abas certas pra
        cada necessidade: custos, ordens de serviço, confiabilidade, estoque, preventivas e resumo executivo.
      </div>
    </div>
  )
}
