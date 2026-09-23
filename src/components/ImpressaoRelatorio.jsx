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
        {dados.destaqueData && (
          <div className="impressao-data">
            <p className="impressao-data-dia">{dados.destaqueData.dia}</p>
            <p className="impressao-data-numero">{dados.destaqueData.data}</p>
          </div>
        )}
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

      {(dados.galerias || []).length > 0 && (
        <section className="impressao-galerias">
          <h2>{dados.tituloGalerias || 'Fotos'}</h2>
          {dados.galerias.map((g, gi) => (
            <div key={gi} className="impressao-galeria">
              <h3>
                {g.titulo}
                {g.subtitulo && <span> · {g.subtitulo}</span>}
              </h3>
              <div className="impressao-fotos">
                {g.fotos.map((f, fi) => (
                  <figure key={fi}>
                    <img src={f.url} alt="" />
                    {f.legenda && <figcaption>{f.legenda}</figcaption>}
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <p className="impressao-rodape">
        Gerado por SGAI em {new Date().toLocaleString('pt-BR')}
      </p>
    </div>,
    document.body
  )
}
