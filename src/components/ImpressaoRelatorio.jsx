import { createPortal } from 'react-dom'
import logoLey from '../assets/logo-ley.jpg'

/**
 * Folha impressa de um relatório: mesmo princípio da etiqueta de QR
 * (portal pra fora do #root + classe `so-impressao`, que o CSS global
 * de impressão isola do resto da página), só que em tamanho A4 em vez
 * de adesivo. `dados` vem de relatoriosImpressao.js ou é montado na hora
 * pela própria tela (caso do relatório do chão de fábrica, que já tem
 * tudo carregado).
 */
export default function ImpressaoRelatorio({ dados }) {
  if (!dados) return null

  return createPortal(
    <div className="so-impressao impressao-relatorio">
      <style>{'@page { size: A4 portrait; margin: 16mm 14mm; }'}</style>
      <header className="impressao-cabecalho">
        <img src={logoLey} alt="" />
        <div className="impressao-cabecalho-texto">
          <p className="impressao-marca">SGAI · Ley Colchões</p>
          <h1>{dados.titulo}</h1>
          {dados.subtitulo && <p className="impressao-subtitulo">{dados.subtitulo}</p>}
        </div>
        <div className="impressao-data">
          {dados.destaqueData && (
            <>
              <p className="impressao-data-dia">{dados.destaqueData.dia}</p>
              <p className="impressao-data-numero">{dados.destaqueData.data}</p>
            </>
          )}
          {/* No cabeçalho e não no pé: no pé, quando a última folha enchia,
              essa linha sozinha abria uma folha nova quase em branco. */}
          <p className="impressao-gerado">
            gerado em {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
      </header>

      {dados.tabelas.map((t, i) => (
        <section key={i} className="impressao-secao">
          <h2>{t.titulo}</h2>
          {t.linhas.length === 0 ? (
            <p className="impressao-vazio">Nenhum registro.</p>
          ) : (
            <table>
              <thead>
                <tr>{t.colunas.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {t.linhas.map((linha, li) => (
                  <tr key={li}>{linha.map((v, ci) => <td key={ci}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {((dados.setores || []).length > 0 || dados.notaSetores) && (
        <section className="impressao-setores">
          <h2>{dados.tituloSetores || 'Setor por setor'}</h2>
          {dados.setores.map((st, si) => <BlocoSetor key={si} setor={st} />)}
          {dados.notaSetores && <p className="impressao-setores-nota">{dados.notaSetores}</p>}
        </section>
      )}

      {(dados.galerias || []).length > 0 && (
        <section className="impressao-galerias">
          <h2>{dados.tituloGalerias || 'Fotos'}</h2>
          {dados.galerias.map((g, gi) => (
            <div key={gi} className="impressao-galeria">
              {emLinhas(g.fotos, 3).map((linha, li) => (
                // Linha de 3 fotos = bloco indivisível pequeno. O título
                // vai DENTRO da primeira linha: assim ele nunca fica
                // sozinho no pé da folha com as fotos na folha seguinte.
                <div key={li} className="impressao-fotos-linha">
                  {li === 0 && (
                    <h3>
                      {g.titulo}
                      {g.subtitulo && <span> · {g.subtitulo}</span>}
                    </h3>
                  )}
                  <div className="impressao-fotos">
                    {linha.map((f, fi) => (
                      <figure key={fi}>
                        <img src={f.url} alt="" />
                        {f.legenda && <figcaption>{f.legenda}</figcaption>}
                      </figure>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

    </div>,
    document.body
  )
}

function emLinhas(lista, tamanho) {
  const linhas = []
  for (let i = 0; i < lista.length; i += tamanho) linhas.push(lista.slice(i, i + tamanho))
  return linhas
}

/**
 * Um setor do 5S no papel: nome e nota em cima, a tabela dos cinco
 * sensos logo abaixo (cabeçalho + tabela nunca se separam de folha) e as
 * fotos do setor por último. Cada coisa no seu lugar, pra quem lê no
 * papel não ter que caçar texto dentro de uma caixa.
 */
// Quatro por linha: numa folha A4 cada foto fica com uns 4 cm — dá pra
// ver bem o que foi fotografado e o setor não se espalha por várias folhas.
const FOTOS_POR_LINHA = 4

function BlocoSetor({ setor }) {
  const linhasDeFotos = emLinhas(setor.fotos || [], FOTOS_POR_LINHA)
  const linhaDeFoto = (linha, chave, rotulo = null) => (
    <div key={chave} className="impressao-fotos-linha">
      {rotulo && <p className="impressao-continuacao">{rotulo}</p>}
      <div className="impressao-fotos">
        {linha.map((f, fi) => (
          <figure key={fi}>
            <img src={f.url} alt="" />
            {f.legenda && <figcaption>{f.legenda}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  )

  return (
    <div className="impressao-setor">
      {/* Nome + tabela + a PRIMEIRA linha de fotos numa peça só: foto
          solta no alto da folha, sem o nome do setor em cima, ninguém
          sabe de onde é. As linhas seguintes podem ir pra outra folha. */}
      <div className="impressao-setor-topo">
        <div className="impressao-setor-titulo">
          <h3>{setor.titulo}</h3>
          {setor.nota && <p className="impressao-setor-nota">{setor.nota}</p>}
        </div>
        {setor.aviso ? (
          <p className="impressao-setor-aviso">{setor.aviso}</p>
        ) : (
          <table className="impressao-sensos">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '17%' }} />
              <col />
            </colgroup>
            <thead>
              <tr><th>Senso</th><th>Resultado</th><th>O que foi visto</th></tr>
            </thead>
            <tbody>
              {setor.sensos.map((l) => (
                <tr key={l.numero}>
                  <td className="impressao-senso-nome">{l.numero}. {l.nome}</td>
                  <td><span className={`impressao-tom impressao-tom-${l.tom}`}>{l.resultado}</span></td>
                  <td>
                    {l.textos.length === 0 ? (
                      <span className="impressao-sem-texto">{l.tom === 'ok' ? 'Sem observação' : '—'}</span>
                    ) : (
                      l.textos.map((t) => (
                        <p key={t.rotulo} className="impressao-senso-texto">
                          <strong>{t.rotulo}:</strong> {t.texto}
                        </p>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {linhasDeFotos.length > 0 && (
          <div className="impressao-setor-fotos">{linhaDeFoto(linhasDeFotos[0], 0)}</div>
        )}
      </div>
      {/* Se as fotos seguintes caírem na folha de baixo, a primeira linha
          delas diz de que setor são. Cada linha continua sendo um bloco
          pequeno — nada de juntar todas num bloco só. */}
      {linhasDeFotos.slice(1).map((linha, li) =>
        linhaDeFoto(linha, li + 1, li === 0 ? `${setor.titulo} — mais fotos` : null)
      )}
    </div>
  )
}
