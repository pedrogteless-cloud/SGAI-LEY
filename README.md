# SGAI — Sistema de Gestão de Ativos Industriais

Ley Colchões · Eusébio/CE e Timon/MA

Cadastro dos ativos do chão de fábrica com controle de despesa de manutenção e
histórico de vida de cada equipamento. Feito para tomar o mínimo de tempo possível
de quem gerencia.

## Quem usa

| Papel        | Como entra              | O que faz                                                      |
| ------------ | ----------------------- | -------------------------------------------------------------- |
| **Operador** | QR da máquina, sem login | Reporta problema com descrição. Nunca vê custo.                |
| **Técnico**  | E-mail e senha          | Executa a OS, marca tarefa, lança peça, serviço e hora.        |
| **Gestor**   | E-mail e senha          | Aprova custo, faz triagem, planeja preventiva, vê indicadores. |

O operador não tem conta. Ele escaneia o adesivo colado na máquina, cai direto no
formulário e envia. A separação é garantida no banco: o papel anônimo só pode executar
duas funções (`ativo_por_qr` e `abrir_solicitacao_qr`) e não lê nenhuma tabela.

## Fluxo principal

```
Operador escaneia o QR
        ↓
  Solicitação de Serviço  ──→  Gestor rejeita (com motivo)
        ↓ triagem
  Ordem de Serviço  ──→  Gestor aprova custo
        ↓
  Técnico executa: marca tarefa, lança peça (baixa automática do estoque),
                   serviço externo e hora de mão de obra
        ↓
  Custo total somado sozinho  →  aparece no painel, no ranking e no RAV% da máquina
```

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

### O que o banco faz sozinho

Nada disso depende do frontend — vale para qualquer cliente que acesse o Postgres:

- **Custo médio ponderado** recalculado a cada entrada de estoque
- **Baixa automática** ao lançar peça na OS, com o custo unitário vindo do custo médio
  daquele momento; remover a linha estorna a peça de volta
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
| `abrir_solicitacao_qr`        | anônimo        | Registra o problema reportado pelo operador           |
| `converter_solicitacao_em_os` | gestor         | Triagem: transforma solicitação em OS                 |
| `rejeitar_solicitacao`        | gestor         | Recusa com motivo registrado                          |
| `aprovar_os`                  | gestor         | Aprova o custo (usado também pelo link de 1 clique)   |
| `clonar_ativo`                | técnico/gestor | Duplica ficha, ficha elétrica e componentes           |
| `aplicar_template_plano`      | gestor         | Aplica um checklist de preventiva a uma máquina       |
| `gerar_os_preventiva`         | técnico/gestor | Gera a OS do plano já com as tarefas do checklist     |

## Primeiro acesso

O banco já vem com as duas unidades, 22 categorias de ativo, os setores de Eusébio e
dois templates de preventiva (Compressor e Quadro Elétrico).

Para criar um usuário, no Supabase → Authentication → Add user, e depois defina o papel:

```sql
update perfis set papel = 'gestor' where email = 'fulano@leycolchoes.com.br';
-- papéis: 'gestor', 'tecnico', 'operador'
```

Todo usuário novo entra como `operador` até alguém promover.

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
