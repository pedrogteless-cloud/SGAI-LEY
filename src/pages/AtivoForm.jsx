import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  useCategorias, useQuadros, useSetores, useUnidades, useTabela, useInvalidar,
} from '../hooks/useDados'
import { CRITICIDADES, SITUACOES_ATIVO, TIPOS_PARTIDA } from '../lib/constants'
import {
  Botao, Cartao, CartaoTitulo, Campo, Entrada, Area, Selecao, Erro, Carregando, useAviso,
} from '../components/ui'

const VAZIO = {
  nome: '', descricao: '', categoria_id: '', setor_id: '', unidade_id: '', ativo_pai_id: '',
  fabricante: '', modelo: '', numero_serie: '', ano_fabricacao: '', data_aquisicao: '',
  valor_aquisicao: '', vida_util_anos: '', criticidade: 'B', situacao: 'operando',
  localizacao: '', observacoes: '', foto_capa_url: '',
}

const FICHA_VAZIA = {
  tensao_v: '', fases: '', potencia_kw: '', potencia_cv: '', corrente_nominal_a: '',
  fator_potencia: '', disjuntor: '', tipo_partida: 'direta', quadro_id: '', circuito: '',
  grau_protecao: '',
}

/** Converte string vazia em null e números em Number, para o Postgres aceitar. */
const limpar = (obj, numericos = []) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v === '' || v === undefined) return [k, null]
      if (numericos.includes(k)) return [k, Number(v)]
      return [k, v]
    })
  )

export default function AtivoForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navegar = useNavigate()
  const avisar = useAviso()
  const invalidar = useInvalidar()

  const [form, setForm] = useState(VAZIO)
  const [ficha, setFicha] = useState(FICHA_VAZIA)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(editando)

  const unidades = useUnidades()
  const categorias = useCategorias()
  const setores = useSetores(form.unidade_id || undefined)
  const quadros = useQuadros(form.unidade_id || undefined)
  const maquinas = useTabela('ativos', {
    select: 'id, codigo, nome',
    filtros: [
      ['ativo', 'eq', true],
      ['ativo_pai_id', 'is', null],
    ],
    ordem: { coluna: 'nome' },
  })

  useEffect(() => {
    if (!editando) {
      if (!form.unidade_id && unidades.data?.length === 1) {
        setForm((f) => ({ ...f, unidade_id: unidades.data[0].id }))
      }
      return
    }
    let vivo = true
    ;(async () => {
      const [{ data: a, error }, { data: fe }] = await Promise.all([
        supabase.from('ativos').select('*').eq('id', id).single(),
        supabase.from('ativo_ficha_eletrica').select('*').eq('ativo_id', id).maybeSingle(),
      ])
      if (!vivo) return
      if (error) setErro(new Error(error.message))
      if (a) {
        setForm({
          ...VAZIO,
          ...Object.fromEntries(
            Object.keys(VAZIO).map((k) => [k, a[k] === null || a[k] === undefined ? '' : a[k]])
          ),
        })
      }
      if (fe) {
        setFicha({
          ...FICHA_VAZIA,
          ...Object.fromEntries(
            Object.keys(FICHA_VAZIA).map((k) => [
              k,
              fe[k] === null || fe[k] === undefined ? '' : fe[k],
            ])
          ),
        })
      }
      setCarregando(false)
    })()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editando, unidades.data])

  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  const mudarFicha = (campo) => (e) => setFicha((f) => ({ ...f, [campo]: e.target.value }))

  const salvar = async (e) => {
    e.preventDefault()
    setErro(null)
    setSalvando(true)

    const dados = limpar(form, [
      'ano_fabricacao', 'valor_aquisicao', 'vida_util_anos',
    ])

    const { data: ativo, error } = editando
      ? await supabase.from('ativos').update(dados).eq('id', id).select().single()
      : await supabase.from('ativos').insert(dados).select().single()

    if (error) {
      setErro(new Error(error.message))
      setSalvando(false)
      return
    }

    const temFicha = Object.values(ficha).some((v) => v !== '' && v !== 'direta')
    if (temFicha) {
      const dadosFicha = limpar(ficha, [
        'tensao_v', 'fases', 'potencia_kw', 'potencia_cv', 'corrente_nominal_a', 'fator_potencia',
      ])
      const { error: erroFicha } = await supabase
        .from('ativo_ficha_eletrica')
        .upsert({ ativo_id: ativo.id, ...dadosFicha })
      if (erroFicha) {
        setErro(new Error(`Ativo salvo, mas a ficha elétrica falhou: ${erroFicha.message}`))
        setSalvando(false)
        return
      }
    }

    invalidar('ativos', 'vw_kpi_custo_por_ativo')
    avisar(editando ? 'Ativo atualizado.' : 'Ativo cadastrado.')
    navegar(`/ativos/${ativo.id}`)
  }

  if (carregando) return <Carregando />

  return (
    <form onSubmit={salvar} className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to={editando ? `/ativos/${id}` : '/ativos'}>
          <Botao variante="fantasma" tamanho="sm">
            <ArrowLeft size={16} />
          </Botao>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          {editando ? 'Editar máquina' : 'Nova máquina'}
        </h1>
      </div>

      <Cartao>
        <CartaoTitulo>O que é</CartaoTitulo>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Campo rotulo="Nome da máquina *" className="sm:col-span-2">
            <Entrada
              value={form.nome}
              onChange={mudar('nome')}
              required
              placeholder="Ex.: Bordadeira de Tampo HC3200"
            />
          </Campo>

          <Campo rotulo="Categoria *">
            <Selecao value={form.categoria_id} onChange={mudar('categoria_id')} required>
              <option value="">Selecione…</option>
              {(categorias.data || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Unidade *">
            <Selecao
              value={form.unidade_id}
              onChange={(e) => {
                setForm((f) => ({ ...f, unidade_id: e.target.value, setor_id: '' }))
                setFicha((f) => ({ ...f, quadro_id: '' }))
              }}
              required
            >
              <option value="">Selecione…</option>
              {(unidades.data || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Setor">
            <Selecao value={form.setor_id} onChange={mudar('setor_id')}>
              <option value="">—</option>
              {(setores.data || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo
            rotulo="É peça de outra máquina?"
            dica="Deixe vazio se for uma máquina inteira. Use para motor, inversor, redutor."
          >
            <Selecao value={form.ativo_pai_id} onChange={mudar('ativo_pai_id')}>
              <option value="">— é uma máquina inteira —</option>
              {(maquinas.data || [])
                .filter((m) => m.id !== id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo} · {m.nome}
                  </option>
                ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Importância" dica="O quanto dói se essa máquina parar">
            <Selecao value={form.criticidade} onChange={mudar('criticidade')}>
              {CRITICIDADES.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.label}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Como está">
            <Selecao value={form.situacao} onChange={mudar('situacao')}>
              {SITUACOES_ATIVO.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.label}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Onde fica na fábrica" className="sm:col-span-2">
            <Entrada
              value={form.localizacao}
              onChange={mudar('localizacao')}
              placeholder="Ex.: Galpão 2, linha B, junto à parede leste"
            />
          </Campo>
        </div>
      </Cartao>

      <Cartao>
        <CartaoTitulo>Marca e compra</CartaoTitulo>
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <Campo rotulo="Marca">
            <Entrada value={form.fabricante} onChange={mudar('fabricante')} />
          </Campo>
          <Campo rotulo="Modelo">
            <Entrada value={form.modelo} onChange={mudar('modelo')} />
          </Campo>
          <Campo rotulo="Nº de série">
            <Entrada value={form.numero_serie} onChange={mudar('numero_serie')} />
          </Campo>
          <Campo rotulo="Ano de fabricação">
            <Entrada
              type="number"
              min="1900"
              max="2100"
              value={form.ano_fabricacao}
              onChange={mudar('ano_fabricacao')}
            />
          </Campo>
          <Campo rotulo="Quando foi comprada">
            <Entrada type="date" value={form.data_aquisicao} onChange={mudar('data_aquisicao')} />
          </Campo>
          <Campo rotulo="Quanto custou (R$)" dica="Serve pra comparar o gasto com o valor da máquina">
            <Entrada
              type="number"
              step="0.01"
              min="0"
              value={form.valor_aquisicao}
              onChange={mudar('valor_aquisicao')}
            />
          </Campo>
          <Campo rotulo="URL da foto de capa" className="sm:col-span-3">
            <Entrada
              value={form.foto_capa_url}
              onChange={mudar('foto_capa_url')}
              placeholder="https://…"
            />
          </Campo>
        </div>
      </Cartao>

      <Cartao>
        <CartaoTitulo>Parte elétrica</CartaoTitulo>
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <Campo rotulo="Tensão (V)">
            <Entrada type="number" step="0.01" value={ficha.tensao_v} onChange={mudarFicha('tensao_v')} />
          </Campo>
          <Campo rotulo="Fases">
            <Selecao value={ficha.fases} onChange={mudarFicha('fases')}>
              <option value="">—</option>
              <option value="1">Monofásico</option>
              <option value="2">Bifásico</option>
              <option value="3">Trifásico</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Potência (kW)">
            <Entrada
              type="number"
              step="0.001"
              value={ficha.potencia_kw}
              onChange={mudarFicha('potencia_kw')}
            />
          </Campo>
          <Campo rotulo="Potência (CV)">
            <Entrada
              type="number"
              step="0.01"
              value={ficha.potencia_cv}
              onChange={mudarFicha('potencia_cv')}
            />
          </Campo>
          <Campo rotulo="Corrente nominal (A)">
            <Entrada
              type="number"
              step="0.01"
              value={ficha.corrente_nominal_a}
              onChange={mudarFicha('corrente_nominal_a')}
            />
          </Campo>
          <Campo rotulo="Disjuntor">
            <Entrada
              value={ficha.disjuntor}
              onChange={mudarFicha('disjuntor')}
              placeholder="Ex.: 3x100A curva C"
            />
          </Campo>
          <Campo rotulo="Tipo de partida">
            <Selecao value={ficha.tipo_partida} onChange={mudarFicha('tipo_partida')}>
              {TIPOS_PARTIDA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Quadro que alimenta" dica="Serve pra saber o que para se esse quadro cair">
            <Selecao value={ficha.quadro_id} onChange={mudarFicha('quadro_id')}>
              <option value="">—</option>
              {(quadros.data || []).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nome}
                  {q.tag ? ` (${q.tag})` : ''}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Circuito">
            <Entrada value={ficha.circuito} onChange={mudarFicha('circuito')} />
          </Campo>
        </div>
      </Cartao>

      <Cartao>
        <CartaoTitulo>Observações</CartaoTitulo>
        <div className="p-4">
          <Area
            rows={3}
            value={form.observacoes}
            onChange={mudar('observacoes')}
            placeholder="Manias da máquina, cuidados na hora de mexer, o que já deu problema…"
          />
        </div>
      </Cartao>

      <Erro erro={erro} />

      <div className="flex justify-end gap-2 pb-6">
        <Link to={editando ? `/ativos/${id}` : '/ativos'}>
          <Botao variante="secundario" type="button">
            Cancelar
          </Botao>
        </Link>
        <Botao type="submit" carregando={salvando}>
          <Save size={15} /> {editando ? 'Salvar' : 'Cadastrar máquina'}
        </Botao>
      </div>
    </form>
  )
}
