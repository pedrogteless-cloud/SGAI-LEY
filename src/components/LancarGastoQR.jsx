import { useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Botao, Campo, Entrada, Erro, Selecao } from './ui'

const soDigitos = (v) => v.replace(/\D/g, '').slice(0, 6)
const n = (v) => Number(String(v).replace(',', '.')) || 0

const CAMPO_VAZIO = {
  descricao: '', pecaDescricao: '', pecaValor: '', pecaFornecedorId: '', pecaRecuperada: false,
  servicoTipo: '', servicoValor: '', servicoFornecedorId: '',
  horas: '', horasParada: '',
}

/**
 * Lançar gasto direto no QR, pra quem já tem PIN de campo (técnico ou
 * gestor). Sem nota fiscal de propósito — é o caminho curto pro chão
 * de fábrica; quem precisar desse detalhe usa o "Lançar gasto" de
 * dentro do sistema.
 */
export default function LancarGastoQR({ token, ativo }) {
  const [pin, setPin] = useState('')
  const [validando, setValidando] = useState(false)
  const [erroPin, setErroPin] = useState(null)
  const [tecnico, setTecnico] = useState(null) // { nome, custoHora }
  const [fornecedores, setFornecedores] = useState([])

  const [form, setForm] = useState(CAMPO_VAZIO)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [resultado, setResultado] = useState(null) // { numero, tecnicoNome }

  useEffect(() => {
    supabase.rpc('fornecedores_para_qr').then(({ data }) => setFornecedores(data || []))
  }, [])

  const entrar = async (e) => {
    e.preventDefault()
    if (pin.length !== 6) return
    setErroPin(null)
    setValidando(true)
    const { data, error } = await supabase.rpc('validar_pin_qr', { p_token: token, p_pin: pin })
    setValidando(false)
    const linha = data?.[0]
    if (error) {
      setErroPin(error.message)
      return
    }
    if (linha?.mensagem) {
      setErroPin(linha.mensagem)
      setPin('')
      return
    }
    setTecnico({ nome: linha.nome, custoHora: linha.custo_hora })
    setForm((f) => ({ ...f, horasParada: f.horasParada }))
    if (linha.custo_hora) setForm((f) => ({ ...f, custoHora: String(linha.custo_hora) }))
  }

  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  const mudarChecado = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.checked }))

  const total = n(form.pecaValor) + n(form.servicoValor) + n(form.horas) * n(form.custoHora)
  const podeRegistrar = form.descricao.trim().length >= 3 && total > 0

  const registrar = async (e) => {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { data, error } = await supabase.rpc('lancar_gasto_qr', {
      p_token: token,
      p_pin: pin,
      p_descricao: form.descricao.trim(),
      p_peca_descricao: form.pecaDescricao.trim() || null,
      p_peca_valor: n(form.pecaValor) || null,
      p_servico_tipo: form.servicoTipo.trim() || null,
      p_servico_valor: n(form.servicoValor) || null,
      p_horas: n(form.horas) || null,
      p_custo_hora: n(form.custoHora) || null,
      p_horas_parada: n(form.horasParada) || null,
      p_peca_fornecedor_id: form.pecaFornecedorId || null,
      p_peca_recuperada: form.pecaRecuperada,
      p_servico_fornecedor_id: form.servicoFornecedorId || null,
    })
    setEnviando(false)
    const linha = data?.[0]
    if (error) {
      setErro(error.message)
      return
    }
    if (linha?.mensagem) {
      setErro(linha.mensagem)
      return
    }
    setResultado({ numero: linha.os_numero, tecnicoNome: linha.tecnico_nome })
  }

  if (resultado) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <CheckCircle2 size={52} className="mx-auto mb-4 text-emerald-500" />
        <p className="text-xl font-bold text-slate-800">Gasto registrado!</p>
        <p className="mt-2 text-base text-slate-500">Lançado por {resultado.tecnicoNome}.</p>
        <p className="mt-4 rounded-lg bg-slate-100 py-3 font-mono text-2xl font-bold text-slate-900">
          {resultado.numero}
        </p>
        <Botao
          variante="secundario"
          tamanho="lg"
          className="mt-6 w-full"
          onClick={() => {
            setResultado(null)
            setForm(CAMPO_VAZIO)
            if (tecnico?.custoHora) setForm((f) => ({ ...f, custoHora: String(tecnico.custoHora) }))
          }}
        >
          Lançar outro gasto
        </Botao>
      </div>
    )
  }

  if (!tecnico) {
    return (
      <form onSubmit={entrar} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="text-center">
          <KeyRound size={30} className="mx-auto mb-2 text-sky-600" />
          <h1 className="text-lg font-bold text-slate-900">Digite seu PIN</h1>
          <p className="text-sm text-slate-500">O PIN de 6 números que você definiu no sistema.</p>
        </div>

        <input
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => setPin(soDigitos(e.target.value))}
          placeholder="••••••"
          className="campo text-center font-mono text-3xl tracking-[0.5em]"
        />

        {erroPin && <p className="text-center text-sm text-red-600">{erroPin}</p>}

        <Botao type="submit" tamanho="lg" className="w-full text-base" carregando={validando} disabled={pin.length !== 6}>
          Entrar
        </Botao>
        <p className="text-center text-xs text-slate-400">
          Ainda não tem PIN? Entre no sistema e defina um em "PIN de campo".
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={registrar} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Wrench size={19} className="text-sky-600" /> Oi, {tecnico.nome.split(' ')[0]}!
        </h1>
        <p className="text-sm text-slate-500">Lançar gasto em {ativo.nome}.</p>
      </div>

      <Campo rotulo="O que foi feito *">
        <Entrada
          autoFocus
          value={form.descricao}
          onChange={mudar('descricao')}
          placeholder="Ex.: troquei o rolamento do eixo"
        />
      </Campo>

      <div className="space-y-3 rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">Preencha só o que teve gasto</p>

        <div className="grid grid-cols-3 gap-2">
          <Campo rotulo="Peça" className="col-span-2">
            <Entrada value={form.pecaDescricao} onChange={mudar('pecaDescricao')} placeholder="O que foi" />
          </Campo>
          <Campo rotulo="R$">
            <Entrada type="number" step="0.01" min="0" value={form.pecaValor} onChange={mudar('pecaValor')} />
          </Campo>
        </div>

        <div className="grid grid-cols-3 gap-2 items-end">
          <Campo rotulo="Fornecedor da peça" className="col-span-2">
            <Selecao value={form.pecaFornecedorId} onChange={mudar('pecaFornecedorId')}>
              <option value="">— não informado —</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </Selecao>
          </Campo>
          <label className="flex items-center gap-1.5 pb-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={form.pecaRecuperada}
              onChange={mudarChecado('pecaRecuperada')}
              className="size-4 rounded border-slate-300"
            />
            Recuperada
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Campo rotulo="Serviço de fora" className="col-span-2">
            <Entrada value={form.servicoTipo} onChange={mudar('servicoTipo')} placeholder="Ex.: retífica" />
          </Campo>
          <Campo rotulo="R$">
            <Entrada type="number" step="0.01" min="0" value={form.servicoValor} onChange={mudar('servicoValor')} />
          </Campo>
        </div>

        <Campo rotulo="Quem fez o conserto">
          <Selecao value={form.servicoFornecedorId} onChange={mudar('servicoFornecedorId')}>
            <option value="">— não informado —</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </Selecao>
        </Campo>

        <div className="grid grid-cols-3 gap-2">
          <Campo rotulo="Horas da equipe" className="col-span-2">
            <Entrada type="number" step="0.5" min="0" value={form.horas} onChange={mudar('horas')} />
          </Campo>
          <Campo rotulo="R$/h">
            <Entrada type="number" step="0.01" min="0" value={form.custoHora} onChange={mudar('custoHora')} />
          </Campo>
        </div>
      </div>

      <Campo rotulo="Máquina ficou parada (horas)" dica="Deixe em branco se não parou">
        <Entrada type="number" step="0.5" min="0" value={form.horasParada} onChange={mudar('horasParada')} />
      </Campo>

      {total > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-sky-50 px-4 py-2.5 ring-1 ring-sky-200 ring-inset">
          <span className="text-sm font-medium text-sky-800">Total do gasto</span>
          <span className="text-lg font-bold text-sky-900">
            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
      )}

      <Erro erro={erro ? new Error(erro) : null} />

      <Botao type="submit" tamanho="lg" className="w-full text-base" carregando={enviando} disabled={!podeRegistrar}>
        Registrar gasto
      </Botao>
    </form>
  )
}
