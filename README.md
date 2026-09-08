# SGAI — Sistema de Gestão de Ativos Industriais

Ley Colchões · Eusébio/CE e Timon/MA

Cadastro dos ativos do chão de fábrica com controle de despesa de manutenção e
histórico de vida de cada equipamento. Feito para tomar o mínimo de tempo possível
de quem gerencia.

## Quem usa

| Papel        | Como entra              | O que faz                                                      |
| ------------ | ----------------------- | -------------------------------------------------------------- |
| **Operador** | QR da máquina, sem login | Avisa problema falando ou escrevendo. Nunca vê custo.          |
| **Técnico**  | E-mail e senha          | Executa o serviço, marca passo, lança peça, serviço e hora.    |
| **Gestor**   | E-mail e senha          | Lança gasto, libera custo, planeja revisão, vê indicadores.    |

Gerente e subgerente são ambos **gestor** — os dois lançam gasto e liberam custo.
Não há papel separado: para o tamanho do parque, mais um nível de permissão só
atrasaria a comunicação.

O operador não tem conta. Ele escaneia o adesivo colado na máquina, cai direto no
formulário e envia. A separação é garantida no banco: o papel anônimo só pode executar
duas funções (`ativo_por_qr` e `abrir_solicitacao_qr`) e não lê nenhuma tabela.

## Os dois caminhos

O objetivo número um é **ter a despesa registrada na máquina**. Para isso existe o
caminho curto, que é o do dia a dia:

```
Gestor clica em "Lançar gasto"
        ↓
  Escolhe a máquina, escreve o que foi feito, põe o valor
        ↓
  Serviço entra já concluído  →  despesa na máquina, no ranking e no RAV%
```

Uma tela, sem aviso, sem triagem, sem liberação. A peça é digitada na hora — não
precisa estar cadastrada no almoxarifado.

O caminho completo continua para o serviço que ainda vai acontecer:

```
Alguém avisa o problema (pelo QR, falando ou escrevendo)
        ↓
  Gestor faz a triagem  ──→  ou recusa, com motivo
        ↓
  Serviço aberto (já liberado quando quem abre é o gestor)
        ↓
  Técnico executa: marca os passos, lança peça, serviço de fora e hora
        ↓
  Gasto total somado sozinho  →  mesmos indicadores
```

### Aviso por áudio

Parte da produção não lê nem escreve. Na tela do QR o botão de gravar vem
**antes** do campo de texto: a pessoa aperta, fala o problema e envia. O texto
deixa de ser obrigatório quando existe gravação — o banco aceita relato escrito
**ou** falado, e recusa se não vier nenhum dos dois.

O áudio fica no bucket `audios` do Supabase Storage. Quem não tem conta consegue
enviar, e só isso: não lista, não apaga, não sobrescreve. Na tela de avisos e na
do serviço, o gestor ouve o recado direto na linha.

## Rodando localmente

```bash
npm install
cp .env.example .env      # preencha com a URL e a chave do seu projeto Supabase
npm run dev
```

Variáveis:

| Variável                 | Onde achar                                                   |
| ------------------------ | ------------------------------------------------------------ |
| `VITE_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL              |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → chave publishable (`sb_publishable_…`) |

A chave publishable é pública por natureza — quem protege os dados é o RLS, não ela.

## Banco de dados

Todo o schema está em [`schema-supabase.sql`](./schema-supabase.sql), pronto para rodar
de ponta a ponta num projeto Supabase novo (SQL Editor → cole → Run).

- **31 tabelas** — ativos com hierarquia e ficha elétrica, solicitações, OS com as três
  fontes de custo, almoxarifado com custo médio ponderado, fornecedores, preventiva,
  notificações, importações e auditoria
- **16 views de KPI** — custo por ativo/setor/mês, ranking, backlog, OS atrasada,
  estoque baixo, gasto por fornecedor, MTTR/MTBF, disponibilidade, RAV%,
  dependência elétrica, comparativo entre unidades, preventivas vencendo,
  peças críticas em risco e resumo semanal
- **RLS por papel** em todas as tabelas
- **Bucket `audios`** com envio liberado para quem não tem conta

### O que o banco faz sozinho

Nada disso depende do frontend — vale para qualquer cliente que acesse o Postgres:

- **Custo médio ponderado** recalculado a cada entrada de estoque
- **Baixa automática** ao lançar peça vinda do almoxarifado, com o custo unitário do
  custo médio daquele momento; remover a linha estorna a peça de volta. Peça digitada
  na hora não mexe no estoque — dá para usar o sistema sem almoxarifado nenhum
- **Custo da OS somado** a cada peça, serviço ou hora lançada
- **Código do ativo e número da OS/solicitação** gerados por trigger (`EUS-MAT-0001`, `OS-2026-00001`)
- **QR único** por ativo desde o cadastro
- **Situação do ativo** acompanha a OS: vira `em_manutencao` quando a execução começa e
  volta a `operando` quando termina
- **Tempo de parada** calculado das datas de início e fim
- **Histórico de status** da OS gravado a cada transição
- **Hierarquia travada em dois níveis** — máquina → componente, sem neto

### Funções chamáveis (RPC)

| Função                        | Quem pode      | Para quê                                              |
| ----------------------------- | -------------- | ----------------------------------------------------- |
| `ativo_por_qr`                | anônimo        | Lê os dados da máquina pelo QR, sem custo             |
| `abrir_solicitacao_qr`        | anônimo        | Registra o problema, por texto ou por áudio           |
| `lancar_gasto`                | técnico/gestor | Caminho curto: registra a despesa e fecha o serviço   |
| `converter_solicitacao_em_os` | gestor         | Triagem: transforma solicitação em OS                 |
| `rejeitar_solicitacao`        | gestor         | Recusa com motivo registrado                          |
| `aprovar_os`                  | gestor         | Aprova o custo (usado também pelo link de 1 clique)   |
| `clonar_ativo`                | técnico/gestor | Duplica ficha, ficha elétrica e componentes           |
| `aplicar_template_plano`      | gestor         | Aplica um checklist de preventiva a uma máquina       |
| `gerar_os_preventiva`         | técnico/gestor | Gera a OS do plano já com as tarefas do checklist     |

## Primeiro acesso

O banco já vem com as duas unidades, 22 categorias de ativo, os setores de Eusébio e
dois templates de preventiva (Compressor e Quadro Elétrico).

Para criar um usuário: **Supabase → Authentication → Add user**, e depois defina o papel:

```sql
update perfis set papel = 'gestor' where email = 'fulano@leycolchoes.com.br';
-- papéis: 'gestor', 'tecnico', 'operador'
```

Todo usuário novo entra como `operador` até alguém promover.

> **Não crie usuário por `insert` direto em `auth.users` sem ler a seção 8.1 do
> `schema-supabase.sql`.** As colunas de token precisam ser string vazia, não `NULL`,
> senão o login falha com *"Database error querying schema"*. O painel faz isso certo;
> o `insert` manual, não. O arquivo tem o modelo correto e o comando de conserto.

## Planta do galpão

Em **Planta do galpão** o chão de fábrica vira desenho em escala: 1 unidade do
desenho é 1 metro, e cada máquina aparece com a área que realmente ocupa. Dá para
ver corredor, folga e aglomeração — não só um pino dizendo "é mais ou menos aqui".
O galpão de Eusébio já vem cadastrado: 72 × 30 m de vão livre, 2.160 m².

Os pilares das laterais são desenhados no vão real (6 m em Eusébio, dando 12 vãos
exatos nos 72 m) e cada vão recebe um número. É a referência que quem anda no chão de fábrica já usa —
"está entre o quinto e o sexto pilar" localiza melhor que "aos 32 metros".

Passe o mouse (ou toque, no celular) numa máquina para ver situação, gasto do
último ano, serviços em aberto, quadro que a alimenta e quanto ela ocupa no chão.

### Endereço: como achar qualquer ponto do galpão

O galpão é dividido em quadrados de 6 × 6 m com endereço de tabuleiro:

- **Vão** (1 a 12) no comprimento — é o mesmo número que a pessoa conta olhando
  os pilares, então dá para se localizar no chão de fábrica sem medir nada
- **Faixa** (A a E) na largura

Cruzando os dois sai o endereço: o canto de entrada é **1A**, o centro é **6C**,
o fundo é **12E**. Ele aparece no cartão da máquina, na lista de máquinas e na
ficha dela. Passando o mouse pelo galpão, o endereço e a posição exata em metros
aparecem ao vivo no rodapé do desenho.

O tamanho do quadrado acompanha o vão entre pilares de cada galpão, então em
outra unidade com vão diferente o endereço se ajusta sozinho.

A mesma planta se repinta em quatro leituras:

| Camada | Para que serve |
| ------ | -------------- |
| **Como está agora** | Verde funcionando, vermelho parada, amarelo em conserto |
| **Importância** | Onde estão as máquinas A, que param a produção |
| **Onde o dinheiro foi** | Mapa de calor do gasto — o vermelho escuro é onde mais saiu dinheiro |
| **Se o quadro cair** | Cada quadro elétrico numa cor: mostra o que apaga junto |

Nas três últimas a cor conta outra coisa, então a situação volta como um ponto no
canto da máquina — saber se ela está rodando nunca se perde.

Em **Posicionar máquinas** (só gestor) você arrasta cada uma para o lugar, com
encaixe de meio metro e sem deixar sair do galpão. A lista lateral mostra o que
ainda está fora da planta; ao colocar, a máquina entra num vaga livre em vez de
empilhar em cima de outra. O comprimento e a largura reais são informados ali
mesmo, e o botão girar vira a máquina de 90 em 90 graus.

Roda do mouse aproxima, arrastar anda pelo galpão. No celular, pinça aproxima e
o toque abre uma folha embaixo com os dados.

### Esquemas: Produção, Energia, Bombeiros e o que mais precisar

As pastilhas acima da planta — **Produção**, **Energia**, **Bombeiros** — são
mapas independentes desenhados sobre o mesmo galpão. Um de cada vez na tela,
cada um com a cor dele. Clique numa pastilha para ligar aquele esquema; clique
de novo para desligar. **Esquema** cria uma categoria nova (nome + cor), para o
que mais precisar — Segurança, Manutenção Predial, o que fizer sentido.

Em **Produção**, o desenho mostra o caminho que o material faz. Não é uma fila:
o caminho se divide, junta de novo, e tem tarefa que só às vezes acontece —
desenhada tracejada. Quando o material sai para outro galpão (a capa de unibox
que vai para a serraria vestir a base), a seta aponta para a parede mais
próxima com o nome do destino escrito.

O item de qualquer esquema fica **vermelho quando tem máquina parada**
debaixo dele — no caso de Produção, isso é o cruzamento que interessa: mostra
que a etapa que está travando é justo a que todo mundo depende, sem precisar
comparar duas telas.

Em **Posicionar máquinas**, o gestor cria item, arrasta para o lugar e liga um
no outro escolhendo se *sempre passa por ali* ou *só às vezes*. Item sem
posição é entendido como fora do galpão desenhado — é assim que a serraria
aparece no esquema de Produção sem precisar ganhar uma planta própria.

Uma ligação nunca atravessa dois esquemas — o banco recusa ligar um hidrante
de Bombeiros numa etapa de Produção. É trava de banco, não só da tela.

## Etiqueta de QR para colar na máquina

Na tela da máquina, em **Etiqueta QR**, você escolhe o tamanho do adesivo que usa
e a prévia aparece no tamanho real. A folha sai com `@page` na medida exata, sem
margem, então o conteúdo não escorrega de posição.

Já vêm os formatos comuns (Pimaco 6180, 6082, 6087, quadrada 60 mm) e um campo
para digitar qualquer medida em milímetros. A escolha fica guardada no navegador
— da segunda vez em diante é abrir e mandar imprimir.

O layout se ajusta sozinho: adesivo em faixa põe o QR ao lado do texto; quadrado
ou em pé põe o QR em cima. Abaixo de 30 mm de altura o setor sai e as fontes
encolhem, para nada ficar cortado.

Se o conteúdo sair deslocado no seu adesivo — cada impressora registra a folha de
um jeito — use as setas de ajuste fino na mesma tela. O deslocamento fica salvo
junto com o tamanho, então uma vez calibrado fica assim para sempre.

Na hora de imprimir, deixe a escala em **100%** e desmarque "ajustar à página",
senão a impressora encolhe e a etiqueta sai fora da medida.

## Cadastrando as máquinas da mudança

Em **Ativos → Importar planilha**: baixe o modelo CSV, preencha no Excel, salve como
CSV e envie. A tela confere linha por linha antes de gravar e mostra o que está errado.
Só `nome`, `categoria` e `unidade` são obrigatórios — categoria, unidade e setor são
casados pelo nome, ignorando acento e maiúscula.

Para máquinas iguais, cadastre uma e use **Clonar** na tela do ativo: copia tudo,
inclusive a ficha elétrica e os componentes, e você só troca o número de série.

## Deploy

Hospedado na Vercel. O `vercel.json` já redireciona todas as rotas para o `index.html`
(necessário porque o roteamento é do lado do cliente — sem isso o link do QR quebra ao
ser aberto direto).

Configure na Vercel as mesmas duas variáveis de ambiente do `.env`.

```bash
npm run build     # gera dist/
```

## Estrutura

```
schema-supabase.sql          banco completo: tabelas, triggers, views, RLS e seed
src/
  lib/         supabase.js (cliente), format.js (moeda/data), constants.js (enums e cores)
  hooks/       useAuth.jsx (sessão e papel), useDados.js (consultas e mutações)
  components/  ui.jsx (design system), Layout.jsx (navegação)
  pages/       Painel, Ativos, AtivoDetalhe, AtivoForm, ImportarAtivos,
               Solicitacoes, OrdensServico, OSDetalhe, Almoxarifado,
               Preventiva, Fornecedores, ReportarQR (público), Entrar
```

## Escopo

**Fase 1 (feita):** cadastro de ativos com ficha elétrica e QR, solicitação → OS com as
três fontes de custo, almoxarifado com custo médio, fornecedores, painel de indicadores,
importação em massa e clonagem.

**Fase 2 (schema pronto, tela básica):** preventiva por calendário e horímetro com
template por categoria, MTTR/MTBF, disponibilidade, RAV%, dependência elétrica e
comparativo entre unidades — as views já calculam tudo.

**A fazer:** disparo de notificação por WhatsApp/e-mail (a tabela `notificacoes` e o
`token_acao` da aprovação com um clique já existem, falta o worker que envia), upload de
arquivo pelo Storage do Supabase (hoje a mídia entra por URL) e o resumo semanal
automático (a view `vw_kpi_resumo_semanal` já entrega o conteúdo).

**Fora do escopo de propósito:** relatório customizável, aprovação em várias etapas e
perfis além de operador/técnico/gestor.
