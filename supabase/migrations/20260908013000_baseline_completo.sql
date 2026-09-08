-- =====================================================================
-- BASELINE CONSOLIDADA — não é uma das migrações originais aplicadas
-- direto no Supabase; é um retrato do schema-supabase.sql atualizado
-- sempre que ele muda (última atualização: checklist 5S de limpeza).
-- =====================================================================
-- Até 2026-09-08 o banco só existia "ao vivo" no Supabase: todo o schema
-- foi aplicado migração por migração direto no projeto (mcp Supabase),
-- mas nenhum arquivo ficou versionado no repositório — quem clonasse o
-- projeto não tinha como recriar o banco, só schema-supabase.sql mantido
-- à mão como referência.
--
-- O histórico de nomes/datas das migrações aplicadas continua só no
-- Supabase (list_migrations mostra nome e versão, não o SQL de cada
-- uma) — não dá pra reconstruir aqui migração a migração. Em vez de
-- fingir um histórico que não existe, este arquivo único é a
-- consolidação de schema-supabase.sql no estado atual: rodar ele do
-- zero (`supabase db reset` num projeto novo, ou colar direto no SQL
-- Editor) recria o banco inteiro.
--
-- Mudanças aplicadas só ao banco vivo (nunca a um schema-supabase.sql
-- desatualizado) são sincronizadas aqui de volta assim que aplicadas —
-- é por isso que este arquivo é atualizado no lugar em vez de crescer
-- como uma migração incremental separada por vez: ele representa "o
-- banco inteiro agora", não um passo isolado.
-- =====================================================================

-- =====================================================================
-- SGAI — Sistema de Gestão de Ativos Industriais
-- Ley Colchões · Eusébio/CE e Timon/MA
-- Banco: PostgreSQL 15+ (Supabase)
--
-- Este arquivo é idempotente o suficiente para rodar em um projeto novo.
-- Ordem: enums -> tabelas -> funções -> triggers -> views KPI -> RLS -> seed
-- =====================================================================

create extension if not exists pgcrypto;

-- O banco do Supabase nasce em UTC. A fábrica é em Fortaleza (UTC-3) e o
-- sistema usa current_date/now() como padrão em várias colunas e funções
-- (data do relatório do dia, pesagem de big bag, preventiva vencendo…) —
-- em UTC, "current_date" já vira o dia seguinte a partir das 21h em
-- Fortaleza, então relatório/lançamento "de hoje" saía com a data errada
-- depois desse horário. Isso resolve na raiz, pra toda sessão nova.
alter database postgres set timezone to 'America/Fortaleza';

-- =====================================================================
-- 1. ENUMS
-- =====================================================================

do $$ begin
  create type papel_usuario as enum ('operador', 'tecnico', 'gestor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type criticidade_ativo as enum ('A', 'B', 'C');
exception when duplicate_object then null; end $$;

do $$ begin
  create type situacao_ativo as enum ('operando', 'parado', 'em_manutencao', 'reserva', 'baixado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_solicitacao as enum ('aberta', 'em_triagem', 'convertida', 'rejeitada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_os as enum ('aberta', 'aprovada', 'em_execucao', 'pausada', 'concluida', 'cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_os as enum ('corretiva', 'preventiva', 'preditiva', 'melhoria', 'instalacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prioridade_nivel as enum ('baixa', 'media', 'alta', 'emergencia');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_movimento as enum ('entrada', 'saida', 'ajuste', 'devolucao', 'transferencia');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_partida as enum ('direta', 'estrela_triangulo', 'soft_starter', 'inversor', 'compensadora', 'nao_aplicavel');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_midia as enum ('foto_capa', 'galeria', 'plaqueta', 'diagrama_eletrico', 'manual', 'laudo', 'certificado', 'nota_fiscal', 'outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type base_plano as enum ('calendario', 'horimetro', 'ambos');
exception when duplicate_object then null; end $$;

do $$ begin
  create type canal_notificacao as enum ('whatsapp', 'email', 'sistema');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_notificacao as enum ('pendente', 'enviada', 'falha', 'lida');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 2. TABELAS
-- =====================================================================

-- (1) unidades ---------------------------------------------------------
create table if not exists unidades (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique,
  sigla         text not null unique,
  cidade        text,
  uf            char(2),
  endereco      text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- (2) setores ----------------------------------------------------------
create table if not exists setores (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    uuid not null references unidades(id) on delete restrict,
  nome          text not null,
  sigla         text,
  responsavel   text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (unidade_id, nome)
);

-- (3) categorias_ativo -------------------------------------------------
create table if not exists categorias_ativo (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique,
  sigla         text not null unique,
  grupo         text not null,          -- producao, eletrica, utilidades, movimentacao, incendio, predial
  descricao     text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- (4) perfis -----------------------------------------------------------
create table if not exists perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  email         text,
  telefone      text,
  papel         papel_usuario not null default 'operador',
  unidade_id    uuid references unidades(id) on delete set null,
  custo_hora    numeric(12,2) not null default 0,   -- mão de obra interna
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- (5) quadros_eletricos ------------------------------------------------
create table if not exists quadros_eletricos (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     uuid not null references unidades(id) on delete restrict,
  setor_id       uuid references setores(id) on delete set null,
  quadro_pai_id  uuid references quadros_eletricos(id) on delete set null,
  nome           text not null,
  tag            text,
  tensao_v       numeric(8,2),
  corrente_a     numeric(10,2),
  disjuntor_geral text,
  localizacao    text,
  observacoes    text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (unidade_id, nome)
);

-- (6) ativos -----------------------------------------------------------
create table if not exists ativos (
  id                uuid primary key default gen_random_uuid(),
  codigo            text unique,
  qr_token          uuid not null unique default gen_random_uuid(),
  nome              text not null,
  descricao         text,
  categoria_id      uuid not null references categorias_ativo(id) on delete restrict,
  setor_id          uuid references setores(id) on delete set null,
  unidade_id        uuid not null references unidades(id) on delete restrict,
  ativo_pai_id      uuid references ativos(id) on delete set null,
  fabricante        text,
  modelo            text,
  numero_serie      text,
  ano_fabricacao    int,
  data_aquisicao    date,
  valor_aquisicao   numeric(14,2),
  vida_util_anos    int,
  criticidade       criticidade_ativo not null default 'B',
  situacao          situacao_ativo not null default 'operando',
  localizacao       text,
  horimetro_atual   numeric(12,1) not null default 0,
  foto_capa_url     text,
  observacoes       text,
  ativo             boolean not null default true,
  criado_por        uuid references perfis(id) on delete set null,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  constraint ativo_nao_e_pai_de_si check (ativo_pai_id is null or ativo_pai_id <> id)
);

create index if not exists idx_ativos_unidade   on ativos(unidade_id);
create index if not exists idx_ativos_setor     on ativos(setor_id);
create index if not exists idx_ativos_categoria on ativos(categoria_id);
create index if not exists idx_ativos_pai       on ativos(ativo_pai_id);
create index if not exists idx_ativos_qr        on ativos(qr_token);

-- (7) ativo_ficha_eletrica --------------------------------------------
create table if not exists ativo_ficha_eletrica (
  ativo_id            uuid primary key references ativos(id) on delete cascade,
  tensao_v            numeric(8,2),
  fases               smallint check (fases in (1, 2, 3)),
  frequencia_hz       numeric(5,2) default 60,
  potencia_kw         numeric(10,3),
  potencia_cv         numeric(10,2),
  corrente_nominal_a  numeric(10,2),
  fator_potencia      numeric(4,3),
  disjuntor           text,
  tipo_partida        tipo_partida not null default 'direta',
  quadro_id           uuid references quadros_eletricos(id) on delete set null,
  circuito            text,
  grau_protecao       text,
  observacoes         text,
  atualizado_em       timestamptz not null default now()
);

create index if not exists idx_ficha_quadro on ativo_ficha_eletrica(quadro_id);

-- (8) ativo_midias -----------------------------------------------------
create table if not exists ativo_midias (
  id            uuid primary key default gen_random_uuid(),
  ativo_id      uuid not null references ativos(id) on delete cascade,
  tipo          tipo_midia not null default 'galeria',
  titulo        text,
  url           text not null,
  storage_path  text,
  mime_type     text,
  tamanho_bytes bigint,
  ordem         int not null default 0,
  enviado_por   uuid references perfis(id) on delete set null,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_midias_ativo on ativo_midias(ativo_id);

-- (9) ativo_leituras_medidor ------------------------------------------
create table if not exists ativo_leituras_medidor (
  id           uuid primary key default gen_random_uuid(),
  ativo_id     uuid not null references ativos(id) on delete cascade,
  valor        numeric(12,1) not null,
  unidade      text not null default 'h',
  data_leitura date not null default current_date,
  registrado_por uuid references perfis(id) on delete set null,
  observacao   text,
  criado_em    timestamptz not null default now()
);

create index if not exists idx_leituras_ativo on ativo_leituras_medidor(ativo_id, data_leitura desc);

-- (10) fornecedores ----------------------------------------------------
create table if not exists fornecedores (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  razao_social   text,
  cnpj           text unique,
  contato        text,
  telefone       text,
  email          text,
  cidade         text,
  uf             char(2),
  prazo_medio_dias int,
  observacoes    text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- prestadores de manutenção de campo (pro picklist "quem fez o conserto")
insert into fornecedores (nome, observacoes, ativo)
select v.nome, v.observacoes, true
from (values
  ('João Paulo Manutenção', 'Manutenção interna da fábrica.'),
  ('Mário Eletricista', null),
  ('Idelfonso Almeida', null)
) as v(nome, observacoes)
where not exists (select 1 from fornecedores f where f.nome = v.nome);

-- (11) fornecedor_servicos --------------------------------------------
create table if not exists fornecedor_servicos (
  id             uuid primary key default gen_random_uuid(),
  fornecedor_id  uuid not null references fornecedores(id) on delete cascade,
  tipo_servico   text not null,   -- torno, retifica, solda, eletrica, hidraulica, peca, calibracao...
  observacao     text,
  unique (fornecedor_id, tipo_servico)
);

-- (12) pecas -----------------------------------------------------------
create table if not exists pecas (
  id             uuid primary key default gen_random_uuid(),
  codigo         text unique,
  nome           text not null,
  descricao      text,
  unidade_medida text not null default 'UN',
  fabricante     text,
  codigo_fabricante text,
  categoria      text,
  critica        boolean not null default false,   -- não pode faltar sem parar linha
  fornecedor_padrao_id uuid references fornecedores(id) on delete set null,
  foto_url       text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists idx_pecas_critica on pecas(critica) where critica;

-- (13) estoque ---------------------------------------------------------
create table if not exists estoque (
  id             uuid primary key default gen_random_uuid(),
  peca_id        uuid not null references pecas(id) on delete cascade,
  unidade_id     uuid not null references unidades(id) on delete restrict,
  quantidade     numeric(14,3) not null default 0,
  custo_medio    numeric(14,4) not null default 0,
  estoque_minimo numeric(14,3) not null default 0,
  estoque_maximo numeric(14,3),
  localizacao    text,
  atualizado_em  timestamptz not null default now(),
  unique (peca_id, unidade_id),
  constraint estoque_nao_negativo check (quantidade >= 0)
);

-- (14) estoque_movimentos ---------------------------------------------
create table if not exists estoque_movimentos (
  id              uuid primary key default gen_random_uuid(),
  peca_id         uuid not null references pecas(id) on delete restrict,
  unidade_id      uuid not null references unidades(id) on delete restrict,
  tipo            tipo_movimento not null,
  quantidade      numeric(14,3) not null check (quantidade > 0),
  custo_unitario  numeric(14,4) not null default 0,
  custo_total     numeric(14,2) generated always as (round(quantidade * custo_unitario, 2)) stored,
  saldo_apos      numeric(14,3),
  custo_medio_apos numeric(14,4),
  documento       text,           -- NF, requisição
  fornecedor_id   uuid references fornecedores(id) on delete set null,
  os_id           uuid,           -- FK adicionada depois (ordens_servico)
  observacao      text,
  registrado_por  uuid references perfis(id) on delete set null,
  criado_em       timestamptz not null default now()
);

create index if not exists idx_mov_peca on estoque_movimentos(peca_id, criado_em desc);
create index if not exists idx_mov_os   on estoque_movimentos(os_id);

-- (15) solicitacoes_servico -------------------------------------------
create table if not exists solicitacoes_servico (
  id                uuid primary key default gen_random_uuid(),
  numero            text unique,
  ativo_id          uuid not null references ativos(id) on delete restrict,
  descricao         text,              -- opcional: pode vir só o áudio
  audio_url         text,              -- recado gravado por quem não escreve
  audio_segundos    int,
  maquina_parada    boolean not null default false,
  prioridade        prioridade_nivel not null default 'media',
  status            status_solicitacao not null default 'aberta',
  solicitante_nome  text,             -- operador sem login
  solicitante_id    uuid references perfis(id) on delete set null,
  origem            text not null default 'qr',  -- qr, painel, telefone
  motivo_rejeicao   text,
  triagem_por       uuid references perfis(id) on delete set null,
  triagem_em        timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

-- o relato tem que existir de alguma forma: escrito ou falado
alter table solicitacoes_servico drop constraint if exists solicitacoes_tem_relato;
alter table solicitacoes_servico add constraint solicitacoes_tem_relato
  check (nullif(btrim(descricao), '') is not null or nullif(btrim(audio_url), '') is not null);

create index if not exists idx_solic_status on solicitacoes_servico(status, criado_em desc);
create index if not exists idx_solic_ativo  on solicitacoes_servico(ativo_id);

alter table ordens_servico add column if not exists audio_url text;

-- (16) solicitacao_midias ---------------------------------------------
create table if not exists solicitacao_midias (
  id              uuid primary key default gen_random_uuid(),
  solicitacao_id  uuid not null references solicitacoes_servico(id) on delete cascade,
  url             text not null,
  storage_path    text,
  mime_type       text,
  criado_em       timestamptz not null default now()
);

-- (17) ordens_servico --------------------------------------------------
create table if not exists ordens_servico (
  id                    uuid primary key default gen_random_uuid(),
  numero                text unique,
  ativo_id              uuid not null references ativos(id) on delete restrict,
  solicitacao_id        uuid references solicitacoes_servico(id) on delete set null,
  plano_id              uuid,          -- FK adicionada depois (planos_preventiva)
  tipo                  tipo_os not null default 'corretiva',
  prioridade            prioridade_nivel not null default 'media',
  status                status_os not null default 'aberta',
  titulo                text not null,
  descricao             text,
  diagnostico           text,
  solucao               text,
  responsavel_id        uuid references perfis(id) on delete set null,
  aberta_em             timestamptz not null default now(),
  aprovada_em           timestamptz,
  aprovada_por          uuid references perfis(id) on delete set null,
  iniciada_em           timestamptz,
  concluida_em          timestamptz,
  parada_inicio         timestamptz,
  parada_fim            timestamptz,
  tempo_parada_min      int not null default 0,
  custo_pecas           numeric(14,2) not null default 0,
  custo_servicos        numeric(14,2) not null default 0,
  custo_mao_obra        numeric(14,2) not null default 0,
  custo_total           numeric(14,2) not null default 0,
  orcamento_previsto    numeric(14,2),
  criado_por            uuid references perfis(id) on delete set null,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

create index if not exists idx_os_status  on ordens_servico(status);
create index if not exists idx_os_ativo    on ordens_servico(ativo_id, aberta_em desc);
create index if not exists idx_os_resp     on ordens_servico(responsavel_id);
create index if not exists idx_os_concluida on ordens_servico(concluida_em);

alter table estoque_movimentos
  drop constraint if exists estoque_movimentos_os_id_fkey;
alter table estoque_movimentos
  add constraint estoque_movimentos_os_id_fkey
  foreign key (os_id) references ordens_servico(id) on delete set null;

-- (18) os_tarefas ------------------------------------------------------
create table if not exists os_tarefas (
  id            uuid primary key default gen_random_uuid(),
  os_id         uuid not null references ordens_servico(id) on delete cascade,
  descricao     text not null,
  ordem         int not null default 0,
  concluida     boolean not null default false,
  concluida_em  timestamptz,
  concluida_por uuid references perfis(id) on delete set null,
  observacao    text,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_tarefas_os on os_tarefas(os_id, ordem);

-- (19) os_pecas --------------------------------------------------------
create table if not exists os_pecas (
  id             uuid primary key default gen_random_uuid(),
  os_id          uuid not null references ordens_servico(id) on delete cascade,
  peca_id        uuid references pecas(id) on delete restrict,  -- vazio = peça digitada na hora
  descricao      text,                                          -- nome da peça quando não vem do almoxarifado
  quantidade     numeric(14,3) not null check (quantidade > 0),
  custo_unitario numeric(14,4) not null default 0,
  custo_total    numeric(14,2) generated always as (round(quantidade * custo_unitario, 2)) stored,
  movimento_id   uuid references estoque_movimentos(id) on delete set null,
  observacao     text,
  registrado_por uuid references perfis(id) on delete set null,
  criado_em      timestamptz not null default now(),
  fornecedor_id  uuid references fornecedores(id) on delete set null,
  recuperada     boolean not null default false
);

-- ou vem do almoxarifado, ou o nome foi digitado na hora
alter table os_pecas drop constraint if exists os_pecas_identificacao;
alter table os_pecas add constraint os_pecas_identificacao
  check (peca_id is not null or nullif(btrim(descricao), '') is not null);

create index if not exists idx_os_pecas_os on os_pecas(os_id);
create index if not exists idx_os_pecas_forn on os_pecas(fornecedor_id);

-- (20) os_servicos_externos -------------------------------------------
create table if not exists os_servicos_externos (
  id             uuid primary key default gen_random_uuid(),
  os_id          uuid not null references ordens_servico(id) on delete cascade,
  fornecedor_id  uuid references fornecedores(id) on delete set null,
  tipo_servico   text not null,
  descricao      text,
  valor          numeric(14,2) not null default 0 check (valor >= 0),
  nota_fiscal    text,
  data_servico   date,
  registrado_por uuid references perfis(id) on delete set null,
  criado_em      timestamptz not null default now()
);

create index if not exists idx_os_serv_os   on os_servicos_externos(os_id);
create index if not exists idx_os_serv_forn on os_servicos_externos(fornecedor_id);

-- (21) os_mao_de_obra --------------------------------------------------
create table if not exists os_mao_de_obra (
  id             uuid primary key default gen_random_uuid(),
  os_id          uuid not null references ordens_servico(id) on delete cascade,
  tecnico_id     uuid references perfis(id) on delete set null,
  tecnico_nome   text,
  horas          numeric(8,2) not null check (horas > 0),
  custo_hora     numeric(12,2) not null default 0,
  custo_total    numeric(14,2) generated always as (round(horas * custo_hora, 2)) stored,
  data_execucao  date not null default current_date,
  observacao     text,
  criado_em      timestamptz not null default now()
);

create index if not exists idx_os_mo_os on os_mao_de_obra(os_id);

-- (22) os_midias -------------------------------------------------------
create table if not exists os_midias (
  id           uuid primary key default gen_random_uuid(),
  os_id        uuid not null references ordens_servico(id) on delete cascade,
  momento      text not null default 'execucao',  -- antes, execucao, depois
  url          text not null,
  storage_path text,
  mime_type    text,
  enviado_por  uuid references perfis(id) on delete set null,
  criado_em    timestamptz not null default now()
);

-- (23) os_historico ----------------------------------------------------
create table if not exists os_historico (
  id            uuid primary key default gen_random_uuid(),
  os_id         uuid not null references ordens_servico(id) on delete cascade,
  status_de     status_os,
  status_para   status_os not null,
  comentario    text,
  autor_id      uuid references perfis(id) on delete set null,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_hist_os on os_historico(os_id, criado_em);

-- (24) plano_templates -------------------------------------------------
create table if not exists plano_templates (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique,
  categoria_id  uuid references categorias_ativo(id) on delete set null,
  descricao     text,
  base          base_plano not null default 'calendario',
  periodicidade_dias int,
  periodicidade_horas numeric(10,1),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- (25) plano_template_itens -------------------------------------------
create table if not exists plano_template_itens (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references plano_templates(id) on delete cascade,
  descricao     text not null,
  ordem         int not null default 0,
  instrucao     text
);

-- (26) planos_preventiva ----------------------------------------------
create table if not exists planos_preventiva (
  id                  uuid primary key default gen_random_uuid(),
  ativo_id            uuid not null references ativos(id) on delete cascade,
  template_id         uuid references plano_templates(id) on delete set null,
  nome                text not null,
  base                base_plano not null default 'calendario',
  periodicidade_dias  int,
  periodicidade_horas numeric(10,1),
  proxima_data        date,
  proximo_horimetro   numeric(12,1),
  ultima_execucao     date,
  responsavel_id      uuid references perfis(id) on delete set null,
  antecedencia_dias   int not null default 7,
  ativo               boolean not null default true,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index if not exists idx_planos_ativo on planos_preventiva(ativo_id);
create index if not exists idx_planos_data  on planos_preventiva(proxima_data) where ativo;

alter table ordens_servico
  drop constraint if exists ordens_servico_plano_id_fkey;
alter table ordens_servico
  add constraint ordens_servico_plano_id_fkey
  foreign key (plano_id) references planos_preventiva(id) on delete set null;

-- (27) plano_itens -----------------------------------------------------
create table if not exists plano_itens (
  id          uuid primary key default gen_random_uuid(),
  plano_id    uuid not null references planos_preventiva(id) on delete cascade,
  descricao   text not null,
  ordem       int not null default 0,
  instrucao   text
);

-- (28) notificacoes ----------------------------------------------------
create table if not exists notificacoes (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null,     -- estoque_baixo, os_parada, preventiva_vencendo, resumo_semanal, aprovacao
  titulo        text not null,
  mensagem      text not null,
  canal         canal_notificacao not null default 'sistema',
  destinatario_id uuid references perfis(id) on delete cascade,
  destino       text,              -- telefone/e-mail quando externo
  referencia_tipo text,            -- ordens_servico, estoque, planos_preventiva
  referencia_id uuid,
  token_acao    uuid default gen_random_uuid(),   -- aprovação com 1 clique
  status        status_notificacao not null default 'pendente',
  enviada_em    timestamptz,
  lida_em       timestamptz,
  erro          text,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_notif_dest on notificacoes(destinatario_id, status);

-- (29) importacoes -----------------------------------------------------
create table if not exists importacoes (
  id             uuid primary key default gen_random_uuid(),
  entidade       text not null,      -- ativos, pecas, fornecedores
  arquivo_nome   text,
  total_linhas   int not null default 0,
  linhas_ok      int not null default 0,
  linhas_erro    int not null default 0,
  erros          jsonb not null default '[]'::jsonb,
  executado_por  uuid references perfis(id) on delete set null,
  criado_em      timestamptz not null default now()
);

-- (30) configuracoes ---------------------------------------------------
create table if not exists configuracoes (
  chave       text primary key,
  valor       text not null,
  descricao   text,
  atualizado_em timestamptz not null default now()
);

-- (31) auditoria -------------------------------------------------------
create table if not exists auditoria (
  id          bigserial primary key,
  tabela      text not null,
  registro_id text,
  operacao    text not null,
  dados_antes jsonb,
  dados_depois jsonb,
  autor_id    uuid,
  criado_em   timestamptz not null default now()
);

create index if not exists idx_auditoria_tabela on auditoria(tabela, criado_em desc);

-- =====================================================================
-- 3. SEQUÊNCIAS DE NUMERAÇÃO
-- =====================================================================

create sequence if not exists seq_numero_os start 1;
create sequence if not exists seq_numero_solicitacao start 1;
create sequence if not exists seq_codigo_ativo start 1;

-- =====================================================================
-- 4. FUNÇÕES E TRIGGERS
-- =====================================================================

create or replace function fn_atualizado_em()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'unidades','setores','categorias_ativo','perfis','quadros_eletricos','ativos',
    'fornecedores','pecas','solicitacoes_servico','ordens_servico',
    'plano_templates','planos_preventiva'
  ] loop
    execute format('drop trigger if exists trg_%1$s_atualizado on %1$I', t);
    execute format(
      'create trigger trg_%1$s_atualizado before update on %1$I
       for each row execute function fn_atualizado_em()', t);
  end loop;
end $$;

-- --- papel do usuário logado (SECURITY DEFINER evita recursão de RLS) --
create or replace function meu_papel()
returns papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid()
$$;

create or replace function eh_gestor()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'gestor' from perfis where id = auth.uid()), false)
$$;

create or replace function eh_tecnico_ou_gestor()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel in ('tecnico','gestor') from perfis where id = auth.uid()), false)
$$;

-- --- código do ativo --------------------------------------------------
create or replace function fn_codigo_ativo()
returns trigger language plpgsql set search_path = public as $$
declare
  s_unidade text;
  s_cat text;
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    select sigla into s_unidade from unidades where id = new.unidade_id;
    select sigla into s_cat from categorias_ativo where id = new.categoria_id;
    new.codigo := concat_ws('-',
      coalesce(s_unidade, 'XX'),
      coalesce(s_cat, 'GEN'),
      lpad(nextval('seq_codigo_ativo')::text, 4, '0'));
  end if;
  return new;
end $$;

drop trigger if exists trg_ativo_codigo on ativos;
create trigger trg_ativo_codigo before insert on ativos
for each row execute function fn_codigo_ativo();

-- --- hierarquia de 2 níveis (máquina -> componente) -------------------
create or replace function fn_valida_hierarquia_ativo()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.ativo_pai_id is not null then
    if exists (select 1 from ativos where id = new.ativo_pai_id and ativo_pai_id is not null) then
      raise exception 'Hierarquia de ativos limitada a dois níveis: % já é um componente', new.ativo_pai_id;
    end if;
    if exists (select 1 from ativos where ativo_pai_id = new.id) then
      raise exception 'Ativo % já possui componentes e não pode virar componente', new.id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_ativo_hierarquia on ativos;
create trigger trg_ativo_hierarquia before insert or update of ativo_pai_id on ativos
for each row execute function fn_valida_hierarquia_ativo();

-- --- numeração de solicitação e OS ------------------------------------
create or replace function fn_numero_solicitacao()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.numero is null then
    new.numero := 'SS-' || to_char(now(), 'YYYY') || '-' ||
                  lpad(nextval('seq_numero_solicitacao')::text, 5, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_solic_numero on solicitacoes_servico;
create trigger trg_solic_numero before insert on solicitacoes_servico
for each row execute function fn_numero_solicitacao();

create or replace function fn_numero_os()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.numero is null then
    new.numero := 'OS-' || to_char(now(), 'YYYY') || '-' ||
                  lpad(nextval('seq_numero_os')::text, 5, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_os_numero on ordens_servico;
create trigger trg_os_numero before insert on ordens_servico
for each row execute function fn_numero_os();

-- --- custo médio ponderado --------------------------------------------
create or replace function fn_aplicar_movimento_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  e             estoque%rowtype;
  nova_qtd      numeric(14,3);
  novo_custo    numeric(14,4);
begin
  select * into e from estoque
   where peca_id = new.peca_id and unidade_id = new.unidade_id
   for update;

  if not found then
    insert into estoque (peca_id, unidade_id, quantidade, custo_medio)
    values (new.peca_id, new.unidade_id, 0, 0)
    returning * into e;
  end if;

  if new.tipo in ('entrada', 'devolucao') then
    nova_qtd := e.quantidade + new.quantidade;
    if nova_qtd > 0 then
      novo_custo := round(
        ((e.quantidade * e.custo_medio) + (new.quantidade * new.custo_unitario)) / nova_qtd, 4);
    else
      novo_custo := e.custo_medio;
    end if;

  elsif new.tipo in ('saida', 'transferencia') then
    nova_qtd := e.quantidade - new.quantidade;
    if nova_qtd < 0 then
      raise exception 'Estoque insuficiente da peça % na unidade %: saldo %, saída %',
        new.peca_id, new.unidade_id, e.quantidade, new.quantidade;
    end if;
    novo_custo := e.custo_medio;
    if new.custo_unitario = 0 then
      new.custo_unitario := e.custo_medio;
    end if;

  else -- ajuste: quantidade passa a ser o valor absoluto informado
    nova_qtd := new.quantidade;
    novo_custo := case when new.custo_unitario > 0 then new.custo_unitario else e.custo_medio end;
  end if;

  update estoque
     set quantidade = nova_qtd,
         custo_medio = novo_custo,
         atualizado_em = now()
   where id = e.id;

  new.saldo_apos := nova_qtd;
  new.custo_medio_apos := novo_custo;
  return new;
end $$;

drop trigger if exists trg_movimento_estoque on estoque_movimentos;
create trigger trg_movimento_estoque before insert on estoque_movimentos
for each row execute function fn_aplicar_movimento_estoque();

-- --- baixa automática de peça ao lançar na OS -------------------------
create or replace function fn_os_peca_baixa_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_unidade uuid;
  v_mov     uuid;
  v_custo   numeric(14,4);
begin
  -- peça digitada na hora não veio do almoxarifado: não há o que baixar
  if new.peca_id is null then return new; end if;

  select a.unidade_id into v_unidade
    from ordens_servico o join ativos a on a.id = o.ativo_id
   where o.id = new.os_id;

  select custo_medio into v_custo
    from estoque where peca_id = new.peca_id and unidade_id = v_unidade;

  insert into estoque_movimentos
    (peca_id, unidade_id, tipo, quantidade, custo_unitario, os_id, observacao, registrado_por)
  values
    (new.peca_id, v_unidade, 'saida', new.quantidade,
     coalesce(nullif(new.custo_unitario, 0), v_custo, 0),
     new.os_id, 'Baixa automática por OS', auth.uid())
  returning id, custo_unitario into v_mov, v_custo;

  new.movimento_id := v_mov;
  if coalesce(new.custo_unitario, 0) = 0 then
    new.custo_unitario := v_custo;
  end if;
  return new;
end $$;

drop trigger if exists trg_os_peca_baixa on os_pecas;
create trigger trg_os_peca_baixa before insert on os_pecas
for each row execute function fn_os_peca_baixa_estoque();

-- --- devolve estoque se a linha de peça for removida ------------------
create or replace function fn_os_peca_estorna_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_unidade uuid;
begin
  if old.peca_id is null then return old; end if;

  select a.unidade_id into v_unidade
    from ordens_servico o join ativos a on a.id = o.ativo_id
   where o.id = old.os_id;

  if v_unidade is not null then
    insert into estoque_movimentos
      (peca_id, unidade_id, tipo, quantidade, custo_unitario, os_id, observacao, registrado_por)
    values
      (old.peca_id, v_unidade, 'devolucao', old.quantidade, old.custo_unitario,
       old.os_id, 'Estorno de peça removida da OS', auth.uid());
  end if;
  return old;
end $$;

drop trigger if exists trg_os_peca_estorno on os_pecas;
create trigger trg_os_peca_estorno before delete on os_pecas
for each row execute function fn_os_peca_estorna_estoque();

-- --- recálculo do custo da OS -----------------------------------------
create or replace function fn_recalcular_custo_os(p_os uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pecas    numeric(14,2);
  v_servicos numeric(14,2);
  v_mo       numeric(14,2);
begin
  select coalesce(sum(custo_total), 0) into v_pecas    from os_pecas where os_id = p_os;
  select coalesce(sum(valor), 0)       into v_servicos from os_servicos_externos where os_id = p_os;
  select coalesce(sum(custo_total), 0) into v_mo       from os_mao_de_obra where os_id = p_os;

  update ordens_servico
     set custo_pecas    = v_pecas,
         custo_servicos = v_servicos,
         custo_mao_obra = v_mo,
         custo_total    = v_pecas + v_servicos + v_mo,
         atualizado_em  = now()
   where id = p_os;
end $$;

create or replace function fn_trigger_custo_os()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform fn_recalcular_custo_os(coalesce(new.os_id, old.os_id));
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['os_pecas','os_servicos_externos','os_mao_de_obra'] loop
    execute format('drop trigger if exists trg_%1$s_custo on %1$I', t);
    execute format(
      'create trigger trg_%1$s_custo after insert or update or delete on %1$I
       for each row execute function fn_trigger_custo_os()', t);
  end loop;
end $$;

-- --- histórico + carimbos de status da OS ------------------------------
create or replace function fn_os_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into os_historico (os_id, status_de, status_para, autor_id)
    values (new.id, null, new.status, auth.uid());
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'aprovada' and new.aprovada_em is null then
      new.aprovada_em := now();
      new.aprovada_por := coalesce(new.aprovada_por, auth.uid());
    elsif new.status = 'em_execucao' and new.iniciada_em is null then
      new.iniciada_em := now();
    elsif new.status = 'concluida' and new.concluida_em is null then
      new.concluida_em := now();
      if new.parada_fim is null and new.parada_inicio is not null then
        new.parada_fim := now();
      end if;
    end if;

    insert into os_historico (os_id, status_de, status_para, autor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;

  if new.parada_inicio is not null and new.parada_fim is not null then
    new.tempo_parada_min := greatest(0,
      (extract(epoch from (new.parada_fim - new.parada_inicio)) / 60)::int);
  end if;

  return new;
end $$;

drop trigger if exists trg_os_status_ins on ordens_servico;
create trigger trg_os_status_ins after insert on ordens_servico
for each row execute function fn_os_status();

drop trigger if exists trg_os_status_upd on ordens_servico;
create trigger trg_os_status_upd before update on ordens_servico
for each row execute function fn_os_status();

-- --- situação do ativo acompanha a OS ---------------------------------
create or replace function fn_situacao_ativo_por_os()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'em_execucao' then
    update ativos set situacao = 'em_manutencao'
     where id = new.ativo_id and situacao <> 'baixado';
  elsif new.status in ('concluida', 'cancelada') then
    if not exists (
      select 1 from ordens_servico
       where ativo_id = new.ativo_id and id <> new.id and status = 'em_execucao'
    ) then
      update ativos set situacao = 'operando'
       where id = new.ativo_id and situacao = 'em_manutencao';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_situacao_ativo on ordens_servico;
create trigger trg_situacao_ativo after update of status on ordens_servico
for each row execute function fn_situacao_ativo_por_os();

-- --- leitura de horímetro atualiza o ativo ----------------------------
create or replace function fn_atualiza_horimetro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update ativos
     set horimetro_atual = greatest(horimetro_atual, new.valor)
   where id = new.ativo_id;
  return new;
end $$;

drop trigger if exists trg_leitura_horimetro on ativo_leituras_medidor;
create trigger trg_leitura_horimetro after insert on ativo_leituras_medidor
for each row execute function fn_atualiza_horimetro();

-- --- foto de capa -----------------------------------------------------
create or replace function fn_sync_foto_capa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'foto_capa' then
    update ativos set foto_capa_url = new.url where id = new.ativo_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_foto_capa on ativo_midias;
create trigger trg_foto_capa after insert on ativo_midias
for each row execute function fn_sync_foto_capa();

-- =====================================================================
-- 5. RPCs
-- =====================================================================

-- --- leitura pública do ativo pelo QR (sem custo, sem login) ----------
create or replace function ativo_por_qr(p_token uuid)
returns table (
  id uuid, codigo text, nome text, categoria text, setor text,
  unidade text, fabricante text, modelo text, foto_capa_url text, situacao situacao_ativo
)
language sql stable security definer set search_path = public as $$
  select a.id, a.codigo, a.nome, c.nome, s.nome, u.nome,
         a.fabricante, a.modelo, a.foto_capa_url, a.situacao
    from ativos a
    join categorias_ativo c on c.id = a.categoria_id
    join unidades u on u.id = a.unidade_id
    left join setores s on s.id = a.setor_id
   where a.qr_token = p_token and a.ativo
$$;

-- --- abertura de solicitação pelo QR ----------------------------------
create or replace function abrir_solicitacao_qr(
  p_token          uuid,
  p_descricao      text default null,
  p_solicitante    text default null,
  p_maquina_parada boolean default false,
  p_foto_url       text default null,
  p_audio_url      text default null,
  p_audio_segundos int default null
)
returns table (id uuid, numero text)
language plpgsql security definer set search_path = public as $$
declare
  v_ativo  uuid;
  v_id     uuid;
  v_numero text;
  v_desc   text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_audio  text := nullif(btrim(coalesce(p_audio_url, '')), '');
begin
  select a.id into v_ativo from ativos a where a.qr_token = p_token and a.ativo;
  if v_ativo is null then
    raise exception 'QR code inválido ou máquina inativa';
  end if;

  -- parte da produção não escreve: o áudio vale como relato
  if v_desc is null and v_audio is null then
    raise exception 'Descreva o problema ou grave um áudio';
  end if;
  if v_desc is not null and length(v_desc) < 5 then
    raise exception 'Descreva o problema com pelo menos 5 caracteres';
  end if;

  insert into solicitacoes_servico
    (ativo_id, descricao, solicitante_nome, maquina_parada, prioridade, origem,
     audio_url, audio_segundos)
  values
    (v_ativo, left(v_desc, 2000), nullif(btrim(coalesce(p_solicitante,'')), ''),
     coalesce(p_maquina_parada, false),
     case when p_maquina_parada then 'emergencia'::prioridade_nivel
          else 'media'::prioridade_nivel end,
     'qr', v_audio, p_audio_segundos)
  returning solicitacoes_servico.id, solicitacoes_servico.numero into v_id, v_numero;

  if p_foto_url is not null then
    insert into solicitacao_midias (solicitacao_id, url) values (v_id, p_foto_url);
  end if;

  return query select v_id, v_numero;
end $$;

-- --- triagem: converter solicitação em OS -----------------------------
create or replace function converter_solicitacao_em_os(
  p_solicitacao uuid,
  p_titulo text default null,
  p_tipo tipo_os default 'corretiva',
  p_prioridade prioridade_nivel default null,
  p_responsavel uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s solicitacoes_servico%rowtype;
  v_os uuid;
begin
  if not eh_gestor() then
    raise exception 'Apenas o gestor faz a triagem';
  end if;

  select * into s from solicitacoes_servico where id = p_solicitacao;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  if s.status = 'convertida' then raise exception 'Solicitação já convertida em OS'; end if;

  insert into ordens_servico
    (ativo_id, solicitacao_id, tipo, prioridade, titulo, descricao, responsavel_id,
     parada_inicio, criado_por)
  values
    (s.ativo_id, s.id, p_tipo, coalesce(p_prioridade, s.prioridade),
     coalesce(nullif(btrim(coalesce(p_titulo,'')), ''), left(s.descricao, 120)),
     s.descricao, p_responsavel,
     case when s.maquina_parada then s.criado_em else null end,
     auth.uid())
  returning id into v_os;

  update solicitacoes_servico
     set status = 'convertida', triagem_por = auth.uid(), triagem_em = now()
   where id = s.id;

  return v_os;
end $$;

-- --- rejeitar solicitação ---------------------------------------------
create or replace function rejeitar_solicitacao(p_solicitacao uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not eh_gestor() then
    raise exception 'Apenas o gestor faz a triagem';
  end if;
  update solicitacoes_servico
     set status = 'rejeitada', motivo_rejeicao = p_motivo,
         triagem_por = auth.uid(), triagem_em = now()
   where id = p_solicitacao and status <> 'convertida';
end $$;

-- --- clonar ativo ------------------------------------------------------
create or replace function clonar_ativo(
  p_ativo uuid,
  p_nome text,
  p_numero_serie text default null,
  p_copiar_componentes boolean default false
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_novo uuid;
  c record;
begin
  if not eh_tecnico_ou_gestor() then
    raise exception 'Sem permissão para cadastrar ativos';
  end if;

  insert into ativos (
    nome, descricao, categoria_id, setor_id, unidade_id, fabricante, modelo,
    numero_serie, ano_fabricacao, data_aquisicao, valor_aquisicao, vida_util_anos,
    criticidade, localizacao, observacoes, criado_por
  )
  select p_nome, descricao, categoria_id, setor_id, unidade_id, fabricante, modelo,
         p_numero_serie, ano_fabricacao, data_aquisicao, valor_aquisicao, vida_util_anos,
         criticidade, localizacao, observacoes, auth.uid()
    from ativos where id = p_ativo
  returning id into v_novo;

  if v_novo is null then raise exception 'Ativo de origem não encontrado'; end if;

  insert into ativo_ficha_eletrica (
    ativo_id, tensao_v, fases, frequencia_hz, potencia_kw, potencia_cv,
    corrente_nominal_a, fator_potencia, disjuntor, tipo_partida, quadro_id,
    circuito, grau_protecao, observacoes
  )
  select v_novo, tensao_v, fases, frequencia_hz, potencia_kw, potencia_cv,
         corrente_nominal_a, fator_potencia, disjuntor, tipo_partida, quadro_id,
         circuito, grau_protecao, observacoes
    from ativo_ficha_eletrica where ativo_id = p_ativo;

  if p_copiar_componentes then
    for c in select * from ativos where ativo_pai_id = p_ativo loop
      insert into ativos (
        nome, descricao, categoria_id, setor_id, unidade_id, ativo_pai_id,
        fabricante, modelo, criticidade, criado_por
      ) values (
        c.nome, c.descricao, c.categoria_id, c.setor_id, c.unidade_id, v_novo,
        c.fabricante, c.modelo, c.criticidade, auth.uid()
      );
    end loop;
  end if;

  return v_novo;
end $$;

-- --- aprovar OS (usado também pelo link de 1 clique) ------------------
create or replace function aprovar_os(p_os uuid, p_orcamento numeric default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not eh_gestor() then
    raise exception 'Apenas o gestor aprova custo';
  end if;
  update ordens_servico
     set status = 'aprovada',
         orcamento_previsto = coalesce(p_orcamento, orcamento_previsto),
         aprovada_por = auth.uid(),
         aprovada_em = now()
   where id = p_os and status in ('aberta', 'pausada');
end $$;

-- --- gerar próxima OS de um plano preventivo --------------------------
create or replace function gerar_os_preventiva(p_plano uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  p planos_preventiva%rowtype;
  v_os uuid;
begin
  if not eh_tecnico_ou_gestor() then
    raise exception 'Sem permissão para gerar OS preventiva';
  end if;
  select * into p from planos_preventiva where id = p_plano and ativo;
  if not found then raise exception 'Plano não encontrado ou inativo'; end if;

  insert into ordens_servico (ativo_id, plano_id, tipo, titulo, descricao, responsavel_id, criado_por)
  values (p.ativo_id, p.id, 'preventiva', p.nome,
          'Gerada automaticamente pelo plano preventivo', p.responsavel_id, auth.uid())
  returning id into v_os;

  insert into os_tarefas (os_id, descricao, ordem, observacao)
  select v_os, i.descricao, i.ordem, i.instrucao
    from plano_itens i where i.plano_id = p.id order by i.ordem;

  update planos_preventiva
     set ultima_execucao = current_date,
         proxima_data = case
           when base in ('calendario','ambos') and periodicidade_dias is not null
             then current_date + periodicidade_dias
           else proxima_data end,
         proximo_horimetro = case
           when base in ('horimetro','ambos') and periodicidade_horas is not null
             then (select horimetro_atual from ativos where id = p.ativo_id) + periodicidade_horas
           else proximo_horimetro end
   where id = p.id;

  return v_os;
end $$;

-- --- aplicar template de plano a um ativo -----------------------------
create or replace function aplicar_template_plano(p_template uuid, p_ativo uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t plano_templates%rowtype;
  v_plano uuid;
begin
  if not eh_gestor() then
    raise exception 'Apenas o gestor define plano preventivo';
  end if;
  select * into t from plano_templates where id = p_template;
  if not found then raise exception 'Template não encontrado'; end if;

  insert into planos_preventiva
    (ativo_id, template_id, nome, base, periodicidade_dias, periodicidade_horas, proxima_data)
  values
    (p_ativo, t.id, t.nome, t.base, t.periodicidade_dias, t.periodicidade_horas,
     case when t.periodicidade_dias is not null then current_date + t.periodicidade_dias end)
  returning id into v_plano;

  insert into plano_itens (plano_id, descricao, ordem, instrucao)
  select v_plano, descricao, ordem, instrucao from plano_template_itens where template_id = t.id;

  return v_plano;
end $$;

-- =====================================================================
-- 6. VIEWS DE KPI
-- =====================================================================

-- (1) custo por ativo ---------------------------------------------------
create or replace view vw_kpi_custo_por_ativo with (security_invoker = on) as
select
  a.id                as ativo_id,
  a.codigo,
  a.nome,
  a.criticidade,
  a.valor_aquisicao,
  u.nome              as unidade,
  s.nome              as setor,
  c.nome              as categoria,
  count(o.id) filter (where o.status <> 'cancelada')                     as total_os,
  count(o.id) filter (where o.tipo = 'corretiva' and o.status <> 'cancelada') as os_corretivas,
  coalesce(sum(o.custo_pecas)    filter (where o.status <> 'cancelada'), 0) as custo_pecas,
  coalesce(sum(o.custo_servicos) filter (where o.status <> 'cancelada'), 0) as custo_servicos,
  coalesce(sum(o.custo_mao_obra) filter (where o.status <> 'cancelada'), 0) as custo_mao_obra,
  coalesce(sum(o.custo_total)    filter (where o.status <> 'cancelada'), 0) as custo_total,
  coalesce(sum(o.custo_total) filter (
    where o.status <> 'cancelada' and o.aberta_em >= now() - interval '12 months'), 0) as custo_12m,
  coalesce(sum(o.tempo_parada_min), 0)                                   as parada_total_min,
  max(o.concluida_em)                                                    as ultima_manutencao
from ativos a
join unidades u          on u.id = a.unidade_id
join categorias_ativo c  on c.id = a.categoria_id
left join setores s      on s.id = a.setor_id
left join ordens_servico o on o.ativo_id = a.id
where a.ativo
group by a.id, a.codigo, a.nome, a.criticidade, a.valor_aquisicao, u.nome, s.nome, c.nome;

-- (2) custo por setor ---------------------------------------------------
create or replace view vw_kpi_custo_por_setor with (security_invoker = on) as
select
  s.id       as setor_id,
  s.nome     as setor,
  u.nome     as unidade,
  count(distinct a.id)                           as qtd_ativos,
  count(o.id) filter (where o.status <> 'cancelada') as total_os,
  coalesce(sum(o.custo_total) filter (where o.status <> 'cancelada'), 0) as custo_total,
  coalesce(sum(o.custo_total) filter (
    where o.status <> 'cancelada' and o.aberta_em >= date_trunc('month', now())), 0) as custo_mes
from setores s
join unidades u on u.id = s.unidade_id
left join ativos a on a.setor_id = s.id and a.ativo
left join ordens_servico o on o.ativo_id = a.id
group by s.id, s.nome, u.nome;

-- (3) custo mensal ------------------------------------------------------
create or replace view vw_kpi_custo_mensal with (security_invoker = on) as
select
  date_trunc('month', o.aberta_em)::date as mes,
  u.id   as unidade_id,
  u.nome as unidade,
  o.tipo,
  count(*)                    as qtd_os,
  sum(o.custo_pecas)          as custo_pecas,
  sum(o.custo_servicos)       as custo_servicos,
  sum(o.custo_mao_obra)       as custo_mao_obra,
  sum(o.custo_total)          as custo_total
from ordens_servico o
join ativos a   on a.id = o.ativo_id
join unidades u on u.id = a.unidade_id
where o.status <> 'cancelada'
group by 1, 2, 3, 4;

-- (4) ranking das máquinas mais caras -----------------------------------
create or replace view vw_kpi_ranking_ativos with (security_invoker = on) as
select
  ativo_id, codigo, nome, unidade, setor, criticidade,
  custo_12m, total_os, parada_total_min,
  rank() over (order by custo_12m desc) as posicao
from vw_kpi_custo_por_ativo
where custo_12m > 0;

-- (5) backlog de OS -----------------------------------------------------
create or replace view vw_kpi_backlog_os with (security_invoker = on) as
select
  o.id, o.numero, o.titulo, o.status, o.tipo, o.prioridade,
  a.codigo as ativo_codigo, a.nome as ativo_nome, a.criticidade,
  u.nome as unidade, s.nome as setor,
  p.nome as responsavel,
  o.aberta_em,
  (extract(epoch from (now() - o.aberta_em)) / 86400)::int as dias_aberta,
  o.custo_total,
  case
    when o.prioridade = 'emergencia' and now() - o.aberta_em > interval '1 day'  then true
    when o.prioridade = 'alta'       and now() - o.aberta_em > interval '3 days' then true
    when o.prioridade = 'media'      and now() - o.aberta_em > interval '7 days' then true
    when o.prioridade = 'baixa'      and now() - o.aberta_em > interval '15 days' then true
    else false
  end as atrasada
from ordens_servico o
join ativos a   on a.id = o.ativo_id
join unidades u on u.id = a.unidade_id
left join setores s on s.id = a.setor_id
left join perfis p  on p.id = o.responsavel_id
where o.status in ('aberta', 'aprovada', 'em_execucao', 'pausada');

-- (6) OS atrasadas ------------------------------------------------------
create or replace view vw_kpi_os_atrasadas with (security_invoker = on) as
select * from vw_kpi_backlog_os where atrasada;

-- (7) estoque abaixo do mínimo ------------------------------------------
create or replace view vw_kpi_estoque_baixo with (security_invoker = on) as
select
  e.id as estoque_id,
  p.id as peca_id,
  p.codigo, p.nome, p.unidade_medida, p.critica,
  u.id as unidade_id, u.nome as unidade,
  e.quantidade, e.estoque_minimo, e.custo_medio,
  (e.estoque_minimo - e.quantidade)                       as faltante,
  round((e.estoque_minimo - e.quantidade) * e.custo_medio, 2) as custo_reposicao,
  f.nome as fornecedor_padrao
from estoque e
join pecas p     on p.id = e.peca_id
join unidades u  on u.id = e.unidade_id
left join fornecedores f on f.id = p.fornecedor_padrao_id
where p.ativo and e.quantidade < e.estoque_minimo;

-- (8) gasto por fornecedor ----------------------------------------------
create or replace view vw_kpi_gasto_fornecedor with (security_invoker = on) as
select
  f.id as fornecedor_id,
  f.nome,
  f.cidade,
  coalesce(sv.qtd_servicos, 0)   as qtd_servicos,
  coalesce(sv.valor_servicos, 0) as valor_servicos,
  coalesce(mv.qtd_compras, 0)    as qtd_compras,
  coalesce(mv.valor_compras, 0)  as valor_compras,
  coalesce(sv.valor_servicos, 0) + coalesce(mv.valor_compras, 0) as gasto_total,
  greatest(sv.ultimo_servico, mv.ultima_compra) as ultima_transacao
from fornecedores f
left join (
  select fornecedor_id, count(*) qtd_servicos, sum(valor) valor_servicos,
         max(coalesce(data_servico, criado_em::date)) ultimo_servico
    from os_servicos_externos where fornecedor_id is not null group by 1
) sv on sv.fornecedor_id = f.id
left join (
  select fornecedor_id, count(*) qtd_compras, sum(custo_total) valor_compras,
         max(criado_em::date) ultima_compra
    from estoque_movimentos
   where fornecedor_id is not null and tipo = 'entrada' group by 1
) mv on mv.fornecedor_id = f.id;

-- (9) MTTR / MTBF -------------------------------------------------------
create or replace view vw_kpi_mttr_mtbf with (security_invoker = on) as
with base as (
  select
    a.id as ativo_id, a.codigo, a.nome, a.criticidade,
    count(o.id) filter (
      where o.tipo = 'corretiva' and o.status = 'concluida'
        and o.aberta_em >= now() - interval '12 months') as falhas_12m,
    coalesce(sum(o.tempo_parada_min) filter (
      where o.status = 'concluida' and o.aberta_em >= now() - interval '12 months'), 0) as parada_min_12m
  from ativos a
  left join ordens_servico o on o.ativo_id = a.id
  where a.ativo
  group by a.id, a.codigo, a.nome, a.criticidade
)
select
  ativo_id, codigo, nome, criticidade, falhas_12m,
  round(parada_min_12m / 60.0, 2) as parada_horas_12m,
  case when falhas_12m > 0
       then round((parada_min_12m / 60.0) / falhas_12m, 2) end as mttr_horas,
  case when falhas_12m > 0
       then round(((365 * 24) - (parada_min_12m / 60.0)) / falhas_12m, 2) end as mtbf_horas
from base;

-- (10) disponibilidade --------------------------------------------------
create or replace view vw_kpi_disponibilidade with (security_invoker = on) as
select
  m.ativo_id, m.codigo, m.nome, m.criticidade,
  m.parada_horas_12m,
  round(
    greatest(0, ((365 * 24) - m.parada_horas_12m) / (365 * 24) * 100)::numeric, 2
  ) as disponibilidade_pct,
  m.mttr_horas, m.mtbf_horas
from vw_kpi_mttr_mtbf m;

-- (11) RAV% — custo de manutenção sobre valor do ativo ------------------
create or replace view vw_kpi_rav with (security_invoker = on) as
select
  ativo_id, codigo, nome, unidade, setor, criticidade,
  valor_aquisicao, custo_12m,
  case when coalesce(valor_aquisicao, 0) > 0
       then round(custo_12m / valor_aquisicao * 100, 2) end as rav_pct,
  case
    when coalesce(valor_aquisicao, 0) = 0 then 'sem_valor_cadastrado'
    when custo_12m / valor_aquisicao * 100 >= 20 then 'avaliar_substituicao'
    when custo_12m / valor_aquisicao * 100 >= 10 then 'atencao'
    else 'saudavel'
  end as sinal
from vw_kpi_custo_por_ativo;

-- (12) dependência elétrica — o que para se o quadro cair ---------------
create or replace view vw_kpi_dependencia_eletrica with (security_invoker = on) as
select
  q.id as quadro_id,
  q.nome as quadro,
  q.tag,
  u.nome as unidade,
  count(a.id)                                        as ativos_dependentes,
  count(a.id) filter (where a.criticidade = 'A')     as criticos_a,
  count(a.id) filter (where a.criticidade = 'B')     as criticos_b,
  round(coalesce(sum(fe.potencia_kw), 0), 2)         as carga_total_kw,
  coalesce(sum(cpa.custo_12m), 0)                    as custo_12m_dependentes,
  array_agg(a.nome order by a.criticidade, a.nome)
    filter (where a.id is not null)                  as maquinas
from quadros_eletricos q
join unidades u on u.id = q.unidade_id
left join ativo_ficha_eletrica fe on fe.quadro_id = q.id
left join ativos a on a.id = fe.ativo_id and a.ativo
left join vw_kpi_custo_por_ativo cpa on cpa.ativo_id = a.id
where q.ativo
group by q.id, q.nome, q.tag, u.nome;

-- (13) comparativo entre unidades ---------------------------------------
create or replace view vw_kpi_comparativo_unidades with (security_invoker = on) as
select
  u.id as unidade_id,
  u.nome as unidade,
  count(distinct a.id) filter (where a.ativo)             as qtd_ativos,
  count(distinct a.id) filter (where a.criticidade = 'A' and a.ativo) as ativos_criticos,
  count(o.id) filter (where o.status <> 'cancelada')      as total_os,
  count(o.id) filter (where o.status in ('aberta','aprovada','em_execucao','pausada')) as os_abertas,
  coalesce(sum(o.custo_total) filter (where o.status <> 'cancelada'), 0) as custo_total,
  coalesce(sum(o.custo_total) filter (
    where o.status <> 'cancelada' and o.aberta_em >= now() - interval '12 months'), 0) as custo_12m,
  round(coalesce(sum(o.tempo_parada_min), 0) / 60.0, 1)  as parada_horas
from unidades u
left join ativos a on a.unidade_id = u.id
left join ordens_servico o on o.ativo_id = a.id
group by u.id, u.nome;

-- (14) preventivas vencendo ---------------------------------------------
create or replace view vw_kpi_preventivas_vencendo with (security_invoker = on) as
select
  pp.id as plano_id,
  pp.nome as plano,
  a.id as ativo_id, a.codigo, a.nome as ativo, a.criticidade,
  u.nome as unidade,
  pp.base, pp.proxima_data, pp.proximo_horimetro,
  a.horimetro_atual,
  (pp.proxima_data - current_date) as dias_restantes,
  case
    when pp.base in ('calendario','ambos') and pp.proxima_data is not null
         and pp.proxima_data < current_date then 'vencida'
    when pp.base in ('calendario','ambos') and pp.proxima_data is not null
         and pp.proxima_data <= current_date + pp.antecedencia_dias then 'proxima'
    when pp.base in ('horimetro','ambos') and pp.proximo_horimetro is not null
         and a.horimetro_atual >= pp.proximo_horimetro then 'vencida'
    else 'em_dia'
  end as situacao
from planos_preventiva pp
join ativos a   on a.id = pp.ativo_id
join unidades u on u.id = a.unidade_id
where pp.ativo and a.ativo;

-- (15) resumo semanal ---------------------------------------------------
create or replace view vw_kpi_resumo_semanal with (security_invoker = on) as
select
  u.id   as unidade_id,
  u.nome as unidade,
  (select count(*) from ordens_servico o2 join ativos a2 on a2.id = o2.ativo_id
    where a2.unidade_id = u.id and o2.aberta_em >= now() - interval '7 days')      as os_abertas_semana,
  (select count(*) from ordens_servico o2 join ativos a2 on a2.id = o2.ativo_id
    where a2.unidade_id = u.id and o2.concluida_em >= now() - interval '7 days')   as os_concluidas_semana,
  (select coalesce(sum(o2.custo_total), 0) from ordens_servico o2 join ativos a2 on a2.id = o2.ativo_id
    where a2.unidade_id = u.id and o2.status <> 'cancelada'
      and o2.aberta_em >= now() - interval '7 days')                               as custo_semana,
  (select count(*) from solicitacoes_servico ss join ativos a2 on a2.id = ss.ativo_id
    where a2.unidade_id = u.id and ss.status in ('aberta','em_triagem'))           as solicitacoes_pendentes,
  (select count(*) from vw_kpi_estoque_baixo eb where eb.unidade_id = u.id)        as itens_estoque_baixo,
  (select count(*) from vw_kpi_os_atrasadas oa where oa.unidade = u.nome)          as os_atrasadas
from unidades u
where u.ativo;

-- (16) peças críticas em risco ------------------------------------------
create or replace view vw_kpi_pecas_criticas_risco with (security_invoker = on) as
select
  p.id as peca_id, p.codigo, p.nome,
  u.nome as unidade,
  e.quantidade, e.estoque_minimo, e.custo_medio,
  coalesce(cons.consumo_90d, 0) as consumo_90d,
  case when coalesce(cons.consumo_90d, 0) > 0
       then round(e.quantidade / (cons.consumo_90d / 90.0), 0) end as dias_de_cobertura
from pecas p
join estoque e   on e.peca_id = p.id
join unidades u  on u.id = e.unidade_id
left join (
  select peca_id, unidade_id, sum(quantidade) consumo_90d
    from estoque_movimentos
   where tipo = 'saida' and criado_em >= now() - interval '90 days'
   group by 1, 2
) cons on cons.peca_id = p.id and cons.unidade_id = e.unidade_id
where p.critica and p.ativo;

-- =====================================================================
-- 7. RLS
-- =====================================================================

alter table unidades              enable row level security;
alter table setores               enable row level security;
alter table categorias_ativo      enable row level security;
alter table perfis                enable row level security;
alter table quadros_eletricos     enable row level security;
alter table ativos                enable row level security;
alter table ativo_ficha_eletrica  enable row level security;
alter table ativo_midias          enable row level security;
alter table ativo_leituras_medidor enable row level security;
alter table fornecedores          enable row level security;
alter table fornecedor_servicos   enable row level security;
alter table pecas                 enable row level security;
alter table estoque               enable row level security;
alter table estoque_movimentos    enable row level security;
alter table solicitacoes_servico  enable row level security;
alter table solicitacao_midias    enable row level security;
alter table ordens_servico        enable row level security;
alter table os_tarefas            enable row level security;
alter table os_pecas              enable row level security;
alter table os_servicos_externos  enable row level security;
alter table os_mao_de_obra        enable row level security;
alter table os_midias             enable row level security;
alter table os_historico          enable row level security;
alter table plano_templates       enable row level security;
alter table plano_template_itens  enable row level security;
alter table planos_preventiva     enable row level security;
alter table plano_itens           enable row level security;
alter table notificacoes          enable row level security;
alter table importacoes           enable row level security;
alter table configuracoes         enable row level security;
alter table auditoria             enable row level security;

-- Helper: aplica um par de políticas padrão (leitura técnico+gestor, escrita gestor)
do $$
declare t text;
begin
  foreach t in array array[
    'unidades','setores','categorias_ativo','quadros_eletricos','fornecedores',
    'fornecedor_servicos','pecas','plano_templates','plano_template_itens'
  ] loop
    execute format('drop policy if exists %1$s_sel on %1$I', t);
    execute format('drop policy if exists %1$s_wri on %1$I', t);
    execute format(
      'create policy %1$s_sel on %1$I for select to authenticated
       using (eh_tecnico_ou_gestor())', t);
    execute format(
      'create policy %1$s_wri on %1$I for all to authenticated
       using (eh_gestor()) with check (eh_gestor())', t);
  end loop;
end $$;

-- perfis ---------------------------------------------------------------
drop policy if exists perfis_sel on perfis;
create policy perfis_sel on perfis for select to authenticated
  using (id = auth.uid() or eh_tecnico_ou_gestor());

drop policy if exists perfis_upd_self on perfis;
create policy perfis_upd_self on perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and papel = meu_papel());

drop policy if exists perfis_gestor on perfis;
create policy perfis_gestor on perfis for all to authenticated
  using (eh_gestor()) with check (eh_gestor());

-- ativos ---------------------------------------------------------------
drop policy if exists ativos_sel on ativos;
create policy ativos_sel on ativos for select to authenticated
  using (eh_tecnico_ou_gestor());

drop policy if exists ativos_ins on ativos;
create policy ativos_ins on ativos for insert to authenticated
  with check (eh_tecnico_ou_gestor());

drop policy if exists ativos_upd on ativos;
create policy ativos_upd on ativos for update to authenticated
  using (eh_tecnico_ou_gestor()) with check (eh_tecnico_ou_gestor());

drop policy if exists ativos_del on ativos;
create policy ativos_del on ativos for delete to authenticated using (eh_gestor());

-- tabelas filhas do ativo ----------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ativo_ficha_eletrica','ativo_midias','ativo_leituras_medidor'] loop
    execute format('drop policy if exists %1$s_sel on %1$I', t);
    execute format('drop policy if exists %1$s_wri on %1$I', t);
    execute format(
      'create policy %1$s_sel on %1$I for select to authenticated
       using (eh_tecnico_ou_gestor())', t);
    execute format(
      'create policy %1$s_wri on %1$I for all to authenticated
       using (eh_tecnico_ou_gestor()) with check (eh_tecnico_ou_gestor())', t);
  end loop;
end $$;

-- estoque --------------------------------------------------------------
drop policy if exists estoque_sel on estoque;
create policy estoque_sel on estoque for select to authenticated
  using (eh_tecnico_ou_gestor());

drop policy if exists estoque_wri on estoque;
create policy estoque_wri on estoque for all to authenticated
  using (eh_gestor()) with check (eh_gestor());

drop policy if exists mov_sel on estoque_movimentos;
create policy mov_sel on estoque_movimentos for select to authenticated
  using (eh_tecnico_ou_gestor());

drop policy if exists mov_ins on estoque_movimentos;
create policy mov_ins on estoque_movimentos for insert to authenticated
  with check (eh_tecnico_ou_gestor());

drop policy if exists mov_del on estoque_movimentos;
create policy mov_del on estoque_movimentos for delete to authenticated using (eh_gestor());

-- solicitações ---------------------------------------------------------
drop policy if exists solic_sel on solicitacoes_servico;
create policy solic_sel on solicitacoes_servico for select to authenticated
  using (eh_tecnico_ou_gestor());

drop policy if exists solic_ins on solicitacoes_servico;
create policy solic_ins on solicitacoes_servico for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists solic_upd on solicitacoes_servico;
create policy solic_upd on solicitacoes_servico for update to authenticated
  using (eh_gestor()) with check (eh_gestor());

drop policy if exists solic_midia_sel on solicitacao_midias;
create policy solic_midia_sel on solicitacao_midias for select to authenticated
  using (eh_tecnico_ou_gestor());

drop policy if exists solic_midia_ins on solicitacao_midias;
create policy solic_midia_ins on solicitacao_midias for insert to authenticated
  with check (auth.uid() is not null);

-- ordens de serviço ----------------------------------------------------
drop policy if exists os_sel on ordens_servico;
create policy os_sel on ordens_servico for select to authenticated
  using (eh_tecnico_ou_gestor());

drop policy if exists os_ins on ordens_servico;
create policy os_ins on ordens_servico for insert to authenticated
  with check (eh_gestor());

-- Técnico executa: só a OS onde ele é responsável e sem transição de aprovação.
drop policy if exists os_upd_tecnico on ordens_servico;
create policy os_upd_tecnico on ordens_servico for update to authenticated
  using (meu_papel() = 'tecnico' and responsavel_id = auth.uid()
         and status in ('aprovada', 'em_execucao', 'pausada'))
  with check (meu_papel() = 'tecnico' and responsavel_id = auth.uid()
              and status in ('em_execucao', 'pausada', 'concluida'));

drop policy if exists os_upd_gestor on ordens_servico;
create policy os_upd_gestor on ordens_servico for update to authenticated
  using (eh_gestor()) with check (eh_gestor());

drop policy if exists os_del on ordens_servico;
create policy os_del on ordens_servico for delete to authenticated using (eh_gestor());

-- filhas da OS: técnico responsável ou gestor --------------------------
create or replace function pode_editar_os(p_os uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select eh_gestor() or exists (
    select 1 from ordens_servico o
     where o.id = p_os
       and o.responsavel_id = auth.uid()
       and o.status in ('aprovada', 'em_execucao', 'pausada')
  )
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'os_tarefas','os_pecas','os_servicos_externos','os_mao_de_obra','os_midias'
  ] loop
    execute format('drop policy if exists %1$s_sel on %1$I', t);
    execute format('drop policy if exists %1$s_wri on %1$I', t);
    execute format(
      'create policy %1$s_sel on %1$I for select to authenticated
       using (eh_tecnico_ou_gestor())', t);
    execute format(
      'create policy %1$s_wri on %1$I for all to authenticated
       using (pode_editar_os(os_id)) with check (pode_editar_os(os_id))', t);
  end loop;
end $$;

drop policy if exists hist_sel on os_historico;
create policy hist_sel on os_historico for select to authenticated
  using (eh_tecnico_ou_gestor());

-- preventiva -----------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['planos_preventiva','plano_itens'] loop
    execute format('drop policy if exists %1$s_sel on %1$I', t);
    execute format('drop policy if exists %1$s_wri on %1$I', t);
    execute format(
      'create policy %1$s_sel on %1$I for select to authenticated
       using (eh_tecnico_ou_gestor())', t);
    execute format(
      'create policy %1$s_wri on %1$I for all to authenticated
       using (eh_gestor()) with check (eh_gestor())', t);
  end loop;
end $$;

-- notificações ---------------------------------------------------------
drop policy if exists notif_sel on notificacoes;
create policy notif_sel on notificacoes for select to authenticated
  using (destinatario_id = auth.uid() or eh_gestor());

drop policy if exists notif_upd on notificacoes;
create policy notif_upd on notificacoes for update to authenticated
  using (destinatario_id = auth.uid() or eh_gestor())
  with check (destinatario_id = auth.uid() or eh_gestor());

drop policy if exists notif_ins on notificacoes;
create policy notif_ins on notificacoes for insert to authenticated
  with check (eh_gestor());

-- importações, configurações e auditoria (gestor) ----------------------
drop policy if exists imp_all on importacoes;
create policy imp_all on importacoes for all to authenticated
  using (eh_tecnico_ou_gestor()) with check (eh_tecnico_ou_gestor());

drop policy if exists cfg_sel on configuracoes;
create policy cfg_sel on configuracoes for select to authenticated
  using (eh_tecnico_ou_gestor());

drop policy if exists cfg_wri on configuracoes;
create policy cfg_wri on configuracoes for all to authenticated
  using (eh_gestor()) with check (eh_gestor());

drop policy if exists aud_sel on auditoria;
create policy aud_sel on auditoria for select to authenticated using (eh_gestor());

-- --- grants: fechado por padrão, aberto só no que precisa -------------
-- O operador nunca autentica: chega pelo QR e usa apenas os dois RPCs abaixo.
-- ATENÇÃO pra quem for criar função nova depois deste ponto: o Supabase
-- concede execute pra `anon` automaticamente em TODA função nova criada
-- no schema public — isso é um privilégio padrão da própria plataforma,
-- não algo que este arquivo controla. "revoke ... from public" NÃO
-- revoga de anon (são grants independentes); e a sweep de "revoke ...
-- from public, anon" logo abaixo só vale pras funções que já existem
-- até aqui no arquivo — qualquer função criada depois (RPC nova de
-- módulo novo) nasce executável por anon de novo, mesmo sem nenhum
-- grant explícito escrito aqui.
-- Confirmado na prática duas vezes nesta sessão: 9 RPCs do chão de
-- fábrica e as 2 novas do checklist 5S vieram anon-executáveis assim
-- que criadas, mesmo com "revoke ... from public" no bloco de cada
-- uma. A sweep final no fim deste arquivo cobre isso pra quem rodar o
-- arquivo inteiro do zero — mas ao aplicar uma migração nova avulsa
-- (sem rodar o arquivo inteiro), sempre inclua
-- "revoke execute on function <nova>(...) from anon;" explícito,
-- a menos que a função seja mesmo pra ser pública (fluxo de QR).
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public;

grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function fn_recalcular_custo_os(uuid) from anon, authenticated;

grant execute on function ativo_por_qr(uuid) to anon;
grant execute on function abrir_solicitacao_qr(uuid, text, text, boolean, text, text, int) to anon, authenticated;

-- =====================================================================
-- 8. PERFIL AUTOMÁTICO NO SIGNUP
-- =====================================================================

create or replace function fn_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'papel')::papel_usuario, 'operador')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_novo_usuario on auth.users;
create trigger trg_novo_usuario after insert on auth.users
for each row execute function fn_novo_usuario();

-- =====================================================================
-- 8.0 CAMINHO CURTO: DESPESA POR MÁQUINA
-- =====================================================================
--
-- O objetivo número um é ter o gasto lançado na máquina. O fluxo completo
-- (aviso -> triagem -> OS -> liberação -> execução) é longo demais para um
-- conserto que já aconteceu. Esta função registra o gasto e fecha o serviço
-- num passo só. O fluxo completo continua existindo para o serviço grande.

create or replace function lancar_gasto(
  p_ativo            uuid,
  p_descricao        text,
  p_data             date    default current_date,
  p_tipo             tipo_os default 'corretiva',
  p_peca_descricao   text    default null,
  p_peca_valor       numeric default null,
  p_servico_tipo     text    default null,
  p_servico_valor    numeric default null,
  p_fornecedor_id    uuid    default null,
  p_nota_fiscal      text    default null,
  p_horas            numeric default null,
  p_custo_hora       numeric default null,
  p_horas_parada     numeric default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_os uuid;
  v_quando timestamptz := coalesce(p_data, current_date)::timestamptz + interval '12 hours';
begin
  if not eh_tecnico_ou_gestor() then
    raise exception 'Sem permissao para lancar gasto';
  end if;
  if length(btrim(coalesce(p_descricao, ''))) < 3 then
    raise exception 'Escreva o que foi feito';
  end if;
  if coalesce(p_peca_valor, 0) + coalesce(p_servico_valor, 0)
     + (coalesce(p_horas, 0) * coalesce(p_custo_hora, 0)) <= 0 then
    raise exception 'Informe pelo menos um valor';
  end if;

  insert into ordens_servico (
    ativo_id, tipo, status, titulo, prioridade,
    aberta_em, aprovada_em, aprovada_por, iniciada_em, concluida_em,
    tempo_parada_min, criado_por
  ) values (
    p_ativo, p_tipo, 'concluida', left(btrim(p_descricao), 120), 'media',
    v_quando, v_quando, auth.uid(), v_quando, v_quando,
    round(coalesce(p_horas_parada, 0) * 60)::int, auth.uid()
  )
  returning id into v_os;

  if coalesce(p_peca_valor, 0) > 0 then
    insert into os_pecas (os_id, descricao, quantidade, custo_unitario, registrado_por)
    values (v_os, coalesce(nullif(btrim(p_peca_descricao), ''), 'Peça'), 1, p_peca_valor, auth.uid());
  end if;

  if coalesce(p_servico_valor, 0) > 0 then
    insert into os_servicos_externos (os_id, fornecedor_id, tipo_servico, valor, nota_fiscal, data_servico, registrado_por)
    values (v_os, p_fornecedor_id, coalesce(nullif(btrim(p_servico_tipo), ''), 'outro'),
            p_servico_valor, nullif(btrim(p_nota_fiscal), ''), p_data, auth.uid());
  end if;

  if coalesce(p_horas, 0) > 0 and coalesce(p_custo_hora, 0) > 0 then
    insert into os_mao_de_obra (os_id, tecnico_id, horas, custo_hora, data_execucao)
    values (v_os, auth.uid(), p_horas, p_custo_hora, p_data);
  end if;

  return v_os;
end $$;

revoke execute on function lancar_gasto(uuid, text, date, tipo_os, text, numeric, text, numeric, uuid, text, numeric, numeric, numeric) from public, anon;
grant execute on function lancar_gasto(uuid, text, date, tipo_os, text, numeric, text, numeric, uuid, text, numeric, numeric, numeric) to authenticated, service_role;

-- =====================================================================
-- 8.9 PIN DE CAMPO: LANÇAR GASTO PELO QR, SEM LOGIN COMPLETO
-- =====================================================================
--
-- O técnico no chão de fábrica não vai digitar e-mail e senha no celular
-- toda hora. Ele escaneia o QR da máquina e digita um PIN de 6 números —
-- curto de decorar, curto de digitar, e ninguém além dele sabe o dele
-- (é único: dois técnicos não podem ter o mesmo).
--
-- pgcrypto (extensions.crypt/gen_salt) guarda o PIN com hash, nunca em
-- texto puro — igual senha de verdade, só que sem exigir sessão.
--
-- Importante sobre RAISE EXCEPTION aqui: estourar uma exceção desfaz a
-- transação INTEIRA, inclusive o que a própria função já tinha escrito
-- antes de estourar — como o contador de tentativas erradas, que é
-- exatamente o que precisa sobreviver a um PIN errado. Por isso nenhuma
-- destas funções levanta exceção: todas retornam normalmente, com o erro
-- (se tiver) numa coluna "mensagem". Só assim a transação sempre
-- confirma (commit) e o contador realmente conta.

alter table perfis add column if not exists pin_hash text;

-- tentativas de PIN por QR escaneado — trava a máquina específica, não a
-- pessoa (que ainda não foi identificada quando o PIN está errado)
create table if not exists pin_tentativas (
  chave         text primary key,
  tentativas    int not null default 0,
  ultima_em     timestamptz not null default now(),
  bloqueado_ate timestamptz
);
alter table pin_tentativas enable row level security;
revoke all on pin_tentativas from anon, authenticated;

-- helper interno: confere o PIN e, se errado, grava a tentativa. Não é
-- exposto via API — só as duas funções abaixo chamam.
create or replace function fn_validar_pin_qr(
  p_token uuid, p_pin text,
  out perfil_id uuid, out nome text, out custo_hora numeric, out mensagem text
)
language plpgsql security definer set search_path = public as $$
declare
  v_chave text := p_token::text;
  v_tent record;
begin
  if not exists (select 1 from ativos where qr_token = p_token and ativo) then
    mensagem := 'Não achei essa máquina.';
    return;
  end if;

  select * into v_tent from pin_tentativas where chave = v_chave for update;
  if v_tent.bloqueado_ate is not null and v_tent.bloqueado_ate > now() then
    mensagem := 'Muitas tentativas erradas nesse QR. Espere uns minutos e tente de novo.';
    return;
  end if;

  select p.id, p.nome, p.custo_hora into perfil_id, nome, custo_hora
  from perfis p
  where p.papel in ('tecnico', 'gestor') and p.ativo and p.pin_hash is not null
    and p.pin_hash = extensions.crypt(p_pin, p.pin_hash)
  limit 1;

  if perfil_id is null then
    if v_tent.chave is null then
      insert into pin_tentativas (chave, tentativas, ultima_em) values (v_chave, 1, now());
    elsif v_tent.ultima_em < now() - interval '30 minutes' then
      update pin_tentativas set tentativas = 1, ultima_em = now(), bloqueado_ate = null where chave = v_chave;
    else
      update pin_tentativas
      set tentativas = v_tent.tentativas + 1,
          ultima_em = now(),
          bloqueado_ate = case when v_tent.tentativas + 1 >= 5 then now() + interval '15 minutes' else v_tent.bloqueado_ate end
      where chave = v_chave;
    end if;
    mensagem := 'PIN incorreto.';
    return;
  end if;

  delete from pin_tentativas where chave = v_chave;
end $$;

revoke execute on function fn_validar_pin_qr(uuid, text) from public, anon, authenticated;

-- pra tela do QR "testar" o PIN antes de mostrar o formulário todo
create or replace function validar_pin_qr(p_token uuid, p_pin text)
returns table(nome text, custo_hora numeric, mensagem text)
language plpgsql security definer set search_path = public as $$
begin
  return query select v.nome, v.custo_hora, v.mensagem from fn_validar_pin_qr(p_token, p_pin) v;
end $$;

revoke execute on function validar_pin_qr(uuid, text) from public;
grant execute on function validar_pin_qr(uuid, text) to anon, authenticated, service_role;

-- o gasto em si, pelo QR + PIN — mesma lógica de lancar_gasto, só que o
-- autor vem do PIN validado, não de auth.uid() (não tem sessão aqui).
-- Sem fornecedor/nota fiscal de propósito: é o caminho simples, quem
-- precisar desses campos usa o "Lançar gasto" de dentro do sistema.
create or replace function lancar_gasto_qr(
  p_token               uuid,
  p_pin                 text,
  p_descricao           text,
  p_data                date    default current_date,
  p_tipo                tipo_os default 'corretiva',
  p_peca_descricao      text    default null,
  p_peca_valor          numeric default null,
  p_servico_tipo        text    default null,
  p_servico_valor       numeric default null,
  p_horas               numeric default null,
  p_custo_hora          numeric default null,
  p_horas_parada        numeric default null,
  p_peca_fornecedor_id  uuid    default null,
  p_peca_recuperada     boolean default false,
  p_servico_fornecedor_id uuid  default null
)
returns table(os_id uuid, os_numero text, tecnico_nome text, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_perfil  uuid;
  v_nome    text;
  v_msg     text;
  v_ativo   uuid;
  v_os      uuid;
  v_numero  text;
  v_quando  timestamptz := coalesce(p_data, current_date)::timestamptz + interval '12 hours';
begin
  select v.perfil_id, v.nome, v.mensagem into v_perfil, v_nome, v_msg from fn_validar_pin_qr(p_token, p_pin) v;

  if v_perfil is null then
    return query select null::uuid, null::text, null::text, v_msg;
    return;
  end if;

  select id into v_ativo from ativos where qr_token = p_token and ativo;

  if length(btrim(coalesce(p_descricao, ''))) < 3 then
    return query select null::uuid, null::text, null::text, 'Escreva o que foi feito'::text;
    return;
  end if;
  if coalesce(p_peca_valor, 0) + coalesce(p_servico_valor, 0)
     + (coalesce(p_horas, 0) * coalesce(p_custo_hora, 0)) <= 0 then
    return query select null::uuid, null::text, null::text, 'Informe pelo menos um valor'::text;
    return;
  end if;

  insert into ordens_servico (
    ativo_id, tipo, status, titulo, prioridade,
    aberta_em, aprovada_em, aprovada_por, iniciada_em, concluida_em,
    tempo_parada_min, criado_por
  ) values (
    v_ativo, p_tipo, 'concluida', left(btrim(p_descricao), 120), 'media',
    v_quando, v_quando, v_perfil, v_quando, v_quando,
    round(coalesce(p_horas_parada, 0) * 60)::int, v_perfil
  )
  returning id, numero into v_os, v_numero;

  if coalesce(p_peca_valor, 0) > 0 then
    insert into os_pecas (os_id, descricao, quantidade, custo_unitario, registrado_por, fornecedor_id, recuperada)
    values (v_os, coalesce(nullif(btrim(p_peca_descricao), ''), 'Peça'), 1, p_peca_valor, v_perfil,
            p_peca_fornecedor_id, coalesce(p_peca_recuperada, false));
  end if;

  if coalesce(p_servico_valor, 0) > 0 or p_servico_fornecedor_id is not null then
    insert into os_servicos_externos (os_id, tipo_servico, valor, data_servico, registrado_por, fornecedor_id)
    values (v_os, coalesce(nullif(btrim(p_servico_tipo), ''), 'outro'), coalesce(p_servico_valor, 0), p_data, v_perfil,
            p_servico_fornecedor_id);
  end if;

  if coalesce(p_horas, 0) > 0 and coalesce(p_custo_hora, 0) > 0 then
    insert into os_mao_de_obra (os_id, tecnico_id, horas, custo_hora, data_execucao)
    values (v_os, v_perfil, p_horas, p_custo_hora, p_data);
  end if;

  insert into auditoria (tabela, registro_id, operacao, dados_depois, autor_id)
  values ('ordens_servico', v_os::text, 'lancar_gasto_qr',
          jsonb_build_object('ativo_id', v_ativo, 'via', 'qr_pin'), v_perfil);

  return query select v_os, v_numero, v_nome, null::text;
end $$;

revoke execute on function lancar_gasto_qr(uuid, text, text, date, tipo_os, text, numeric, text, numeric, numeric, numeric, numeric, uuid, boolean, uuid) from public;
grant execute on function lancar_gasto_qr(uuid, text, text, date, tipo_os, text, numeric, text, numeric, numeric, numeric, numeric, uuid, boolean, uuid) to anon, authenticated, service_role;

-- lista simples de fornecedores ativos, pro picklist "quem fez o conserto"
-- no QR (anon não pode ler a tabela fornecedores direto por RLS).
create or replace function fornecedores_para_qr()
returns table(id uuid, nome text)
language sql security definer set search_path = public
stable as $$
  select id, nome from fornecedores where ativo order by nome;
$$;

revoke execute on function fornecedores_para_qr() from public;
grant execute on function fornecedores_para_qr() to anon, authenticated, service_role;

-- o técnico/gestor define o próprio PIN, logado no app de verdade. Aqui
-- pode estourar exceção à vontade — é sessão normal, não tem contador
-- de tentativas em jogo.
create or replace function definir_meu_pin(p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Entre no sistema para definir o PIN';
  end if;
  if not eh_tecnico_ou_gestor() then
    raise exception 'Só técnico ou gestor usa PIN de campo';
  end if;
  if p_pin !~ '^[0-9]{6}$' then
    raise exception 'O PIN precisa ter 6 números';
  end if;
  if exists (
    select 1 from perfis
    where papel in ('tecnico', 'gestor') and ativo and pin_hash is not null
      and id <> auth.uid()
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Esse PIN já é de outra pessoa. Escolha outro.';
  end if;
  update perfis set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')) where id = auth.uid();
end $$;

revoke execute on function definir_meu_pin(text) from public, anon;
grant execute on function definir_meu_pin(text) to authenticated;

-- =====================================================================
-- 8.3 PLANTA DO GALPÃO
-- =====================================================================
--
-- Tudo em metros. O desenho na tela usa 1 unidade = 1 metro, então a máquina
-- aparece com a área que realmente ocupa no chão — dá para enxergar corredor,
-- folga e aglomeração, não só "onde mais ou menos ela está".
--
-- Eixos: x corre no comprimento do galpão, y na largura.

create table if not exists plantas (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     uuid not null references unidades(id) on delete cascade,
  nome           text not null,
  comprimento_m  numeric(8,2) not null check (comprimento_m > 0),  -- eixo x
  largura_m      numeric(8,2) not null check (largura_m > 0),      -- eixo y
  -- Vão entre os pilares das laterais. Vira a referência visual de quem anda
  -- no galpão: "está entre o quinto e o sexto pilar" localiza melhor que o
  -- metro corrido. Nulo = galpão sem pilar aparente na planta.
  vao_pilar_m    numeric(6,2) check (vao_pilar_m > 0),
  observacoes    text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (unidade_id, nome)
);

create index if not exists idx_plantas_unidade on plantas(unidade_id);

drop trigger if exists trg_plantas_atualizado on plantas;
create trigger trg_plantas_atualizado before update on plantas
  for each row execute function fn_atualizado_em();

-- Posição e medida da máquina no chão
alter table ativos add column if not exists planta_id uuid references plantas(id) on delete set null;
alter table ativos add column if not exists pos_x_m   numeric(8,2);  -- canto do retângulo já girado
alter table ativos add column if not exists pos_y_m   numeric(8,2);
alter table ativos add column if not exists comp_m    numeric(6,2) check (comp_m > 0);
alter table ativos add column if not exists larg_m    numeric(6,2) check (larg_m > 0);
alter table ativos add column if not exists rotacao   smallint not null default 0
  check (rotacao in (0, 90, 180, 270));

create index if not exists idx_ativos_planta on ativos(planta_id) where planta_id is not null;

-- Posição do quadro elétrico no desenho da planta de Energia — nulo até
-- alguém colocá-lo lá (o quadro pode existir no cadastro sem estar
-- desenhado ainda).
alter table quadros_eletricos add column if not exists planta_id uuid references plantas(id) on delete set null;
alter table quadros_eletricos add column if not exists pos_x_m   numeric(8,2);
alter table quadros_eletricos add column if not exists pos_y_m   numeric(8,2);

-- Especificação do cabo que sai do quadro até a máquina — ao lado do que já
-- existe na ficha elétrica (quadro_id diz ONDE liga, circuito/disjuntor
-- dizem em que proteção). Fica na mesma tabela porque é a mesma relação
-- 1-para-1 com o ativo, só que faltava contar do fio em si.
alter table ativo_ficha_eletrica add column if not exists cabo_descricao text;
alter table ativo_ficha_eletrica add column if not exists cabo_bitola_mm2 numeric(6,2);
alter table ativo_ficha_eletrica add column if not exists cabo_comprimento_m numeric(8,2);
alter table ativo_ficha_eletrica add column if not exists cabo_tipo_instalacao text;
-- curvas do cabo: [{x,y}, ...] em metros, do quadro até a máquina — o
-- caminho real (a eletrocalha na lateral, o desvio de um pilar), não a
-- linha reta que a régua desenharia. Vazio = ainda é reto.
alter table ativo_ficha_eletrica add column if not exists cabo_pontos jsonb not null default '[]'::jsonb;

-- Todo mundo logado enxerga a planta; só o gestor mexe nela.
alter table plantas enable row level security;

drop policy if exists plantas_sel on plantas;
create policy plantas_sel on plantas for select to authenticated using (true);

drop policy if exists plantas_ins on plantas;
create policy plantas_ins on plantas for insert to authenticated with check (eh_gestor());

drop policy if exists plantas_upd on plantas;
create policy plantas_upd on plantas for update to authenticated using (eh_gestor()) with check (eh_gestor());

drop policy if exists plantas_del on plantas;
create policy plantas_del on plantas for delete to authenticated using (eh_gestor());

-- O operador do QR não tem conta e não tem nada que ver a planta.
revoke all on plantas from anon;

-- Tudo que o mapa precisa saber de cada máquina, numa consulta só — inclusive
-- o endereço dela no galpão, calculado pelo CENTRO: vão no comprimento (o
-- mesmo que a pessoa conta olhando os pilares) cruzado com a letra da faixa
-- na largura. Fica aqui para a lista de máquinas e a OS mostrarem "7C" sem
-- refazer a conta em cada tela.
drop view if exists vw_planta_ativos;

create view vw_planta_ativos with (security_invoker = on) as
with base as (
  select
    a.*,
    pl.comprimento_m  as planta_comp,
    pl.largura_m      as planta_larg,
    coalesce(pl.vao_pilar_m, 5) as celula,
    a.pos_x_m + (case when a.rotacao in (90, 270)
                      then coalesce(a.larg_m, 2) else coalesce(a.comp_m, 2) end) / 2 as centro_x,
    a.pos_y_m + (case when a.rotacao in (90, 270)
                      then coalesce(a.comp_m, 2) else coalesce(a.larg_m, 2) end) / 2 as centro_y
  from ativos a
  left join plantas pl on pl.id = a.planta_id
)
select
  b.id                as ativo_id,
  b.planta_id,
  b.codigo,
  b.nome,
  b.pos_x_m,
  b.pos_y_m,
  b.comp_m,
  b.larg_m,
  b.rotacao,
  b.criticidade,
  b.situacao,
  b.foto_capa_url,
  b.ativo_pai_id,
  c.nome              as categoria,
  s.nome              as setor,
  u.nome              as unidade,
  fe.quadro_id,
  q.nome              as quadro,
  q.tag               as quadro_tag,
  fe.potencia_cv,
  coalesce(k.custo_12m, 0)  as custo_12m,
  coalesce(k.total_os, 0)   as total_os,
  k.ultima_manutencao,
  coalesce(os.abertas, 0)   as os_abertas,
  os.pior_prioridade,
  case
    when b.centro_x is null or b.planta_comp is null then null
    else (
      least(floor(round(b.centro_x::numeric, 2) / b.celula)::int + 1,
            greatest(ceil(b.planta_comp / b.celula)::int, 1))::text
      ||
      chr(65 + least(
            least(floor(round(b.centro_y::numeric, 2) / b.celula)::int,
                  greatest(ceil(b.planta_larg / b.celula)::int - 1, 0)),
            25))
    )
  end as endereco,
  -- especificação do cabo: até aqui vai a leitura do painel de Energia, sem
  -- precisar de outra consulta
  fe.circuito,
  fe.disjuntor,
  fe.tensao_v         as ficha_tensao_v,
  fe.corrente_nominal_a,
  fe.cabo_descricao,
  fe.cabo_bitola_mm2,
  fe.cabo_comprimento_m,
  fe.cabo_tipo_instalacao,
  coalesce(fe.cabo_pontos, '[]'::jsonb) as cabo_pontos
from base b
join unidades u             on u.id = b.unidade_id
join categorias_ativo c     on c.id = b.categoria_id
left join setores s         on s.id = b.setor_id
left join ativo_ficha_eletrica fe on fe.ativo_id = b.id
left join quadros_eletricos q     on q.id = fe.quadro_id
left join vw_kpi_custo_por_ativo k on k.ativo_id = b.id
left join lateral (
  select count(*) as abertas,
         -- max() sobre o enum respeita a ordem declarada (baixa < media < alta
         -- < emergencia); sobre texto daria ordem alfabética e "media" venceria
         -- "emergencia", que é justamente a que não pode passar despercebida
         max(o.prioridade) as pior_prioridade
  from ordens_servico o
  where o.ativo_id = b.id
    and o.status in ('aberta', 'aprovada', 'em_execucao', 'pausada')
) os on true
where b.ativo;

grant select on vw_planta_ativos to authenticated;
revoke all on vw_planta_ativos from anon;

-- Os quadros que já têm um lugar desenhado na planta, com a contagem de
-- máquinas que cada um alimenta — para desenhar o nó do quadro sem precisar
-- somar isso na tela.
create or replace view vw_planta_quadros with (security_invoker = on) as
select
  q.id            as quadro_id,
  q.unidade_id,
  q.planta_id,
  q.setor_id,
  q.nome,
  q.tag,
  q.tensao_v,
  q.corrente_a,
  q.disjuntor_geral,
  q.pos_x_m,
  q.pos_y_m,
  q.localizacao,
  q.observacoes,
  coalesce(m.qtd, 0) as qtd_maquinas
from quadros_eletricos q
left join lateral (
  select count(*) as qtd from ativo_ficha_eletrica fe where fe.quadro_id = q.id
) m on true
where q.ativo;

grant select on vw_planta_quadros to authenticated;
revoke all on vw_planta_quadros from anon;

-- =====================================================================
-- 8.4 ESQUEMAS: PRODUÇÃO, ENERGIA, BOMBEIROS E O QUE MAIS PRECISAR
-- =====================================================================
--
-- Não é fila, é rede: o caminho se divide, tem tarefa alternativa e às vezes
-- o material sai para outro galpão (a capa de unibox que vai para a serraria
-- vestir a base). Por isso nó e ligação são tabelas separadas — uma coluna
-- de ordem só daria conta de linha reta.
--
-- E não é só produção: o mesmo desenho serve pra elétrica, pra bombeiro, pra
-- qualquer coisa que precise de nó + ligação sobre a planta. Um esquema é a
-- categoria (Produção, Energia, Bombeiros…); cada nó pertence a um esquema.
-- Um de cada vez na tela, cada um com a cor dele.

create table if not exists esquemas (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    uuid not null references unidades(id) on delete cascade,
  nome          text not null,
  cor           text not null default '#4338ca',
  icone         text not null default 'Workflow',
  ordem         int not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- 'energia' desenha quadro elétrico + cabo até a máquina, com o desenho
  -- de nó/ligação genérico (esquema_nos/esquema_ligacoes) fora de cena; todo
  -- o resto usa o genérico normalmente
  tipo          text not null default 'fluxo' check (tipo in ('fluxo', 'energia')),
  unique (unidade_id, nome)
);

drop trigger if exists trg_esquemas_atualizado on esquemas;
create trigger trg_esquemas_atualizado before update on esquemas
  for each row execute function fn_atualizado_em();

alter table esquemas enable row level security;
drop policy if exists esquemas_sel on esquemas;
create policy esquemas_sel on esquemas for select to authenticated using (true);
drop policy if exists esquemas_ins on esquemas;
create policy esquemas_ins on esquemas for insert to authenticated with check (eh_gestor());
drop policy if exists esquemas_upd on esquemas;
create policy esquemas_upd on esquemas for update to authenticated using (eh_gestor()) with check (eh_gestor());
drop policy if exists esquemas_del on esquemas;
create policy esquemas_del on esquemas for delete to authenticated using (eh_gestor());
revoke all on esquemas from anon;

create table if not exists esquema_nos (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    uuid not null references unidades(id) on delete cascade,
  esquema_id    uuid not null references esquemas(id) on delete cascade,
  -- planta nula = o nó fica fora do galpão desenhado (outro galpão, pátio,
  -- terceiro). A seta então aponta para fora, com o nome do destino.
  planta_id     uuid references plantas(id) on delete set null,
  setor_id      uuid references setores(id) on delete set null,
  nome          text not null,
  descricao     text,
  pos_x_m       numeric(8,2),
  pos_y_m       numeric(8,2),
  ordem         int not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- nome é único por esquema, não por unidade: "Entrada" pode existir em
  -- Bombeiros e em Produção ao mesmo tempo
  unique (esquema_id, nome)
);

create index if not exists idx_esquema_nos_esquema on esquema_nos(esquema_id);
create index if not exists idx_esquema_nos_planta  on esquema_nos(planta_id) where planta_id is not null;

drop trigger if exists trg_esquema_nos_atualizado on esquema_nos;
create trigger trg_esquema_nos_atualizado before update on esquema_nos
  for each row execute function fn_atualizado_em();

create table if not exists esquema_ligacoes (
  id        uuid primary key default gen_random_uuid(),
  de_id     uuid not null references esquema_nos(id) on delete cascade,
  para_id   uuid not null references esquema_nos(id) on delete cascade,
  -- 'alternativa' é o caminho que só às vezes acontece. Desenhado tracejado.
  tipo      text not null default 'principal' check (tipo in ('principal', 'alternativa')),
  rotulo    text,
  criado_em timestamptz not null default now(),
  unique (de_id, para_id),
  check (de_id <> para_id)
);

create index if not exists idx_esquema_liga_de   on esquema_ligacoes(de_id);
create index if not exists idx_esquema_liga_para on esquema_ligacoes(para_id);

-- Uma ligação nunca pode atravessar dois esquemas — não faz sentido ligar um
-- hidrante (Bombeiros) numa etapa de costura (Produção). Trava no banco, não
-- só na tela: a UI já filtra, isso é o cinto de segurança.
create or replace function fn_valida_ligacao_mesmo_esquema()
returns trigger language plpgsql as $$
declare v_de uuid; v_para uuid;
begin
  select esquema_id into v_de   from esquema_nos where id = new.de_id;
  select esquema_id into v_para from esquema_nos where id = new.para_id;
  if v_de is distinct from v_para then
    raise exception 'As duas pontas da ligação precisam ser do mesmo esquema';
  end if;
  return new;
end $$;

drop trigger if exists trg_liga_mesmo_esquema on esquema_ligacoes;
create trigger trg_liga_mesmo_esquema before insert or update on esquema_ligacoes
  for each row execute function fn_valida_ligacao_mesmo_esquema();

alter table esquema_nos      enable row level security;
alter table esquema_ligacoes enable row level security;

drop policy if exists esquema_nos_sel on esquema_nos;
create policy esquema_nos_sel on esquema_nos for select to authenticated using (true);
drop policy if exists esquema_nos_ins on esquema_nos;
create policy esquema_nos_ins on esquema_nos for insert to authenticated with check (eh_gestor());
drop policy if exists esquema_nos_upd on esquema_nos;
create policy esquema_nos_upd on esquema_nos for update to authenticated using (eh_gestor()) with check (eh_gestor());
drop policy if exists esquema_nos_del on esquema_nos;
create policy esquema_nos_del on esquema_nos for delete to authenticated using (eh_gestor());

drop policy if exists esquema_liga_sel on esquema_ligacoes;
create policy esquema_liga_sel on esquema_ligacoes for select to authenticated using (true);
drop policy if exists esquema_liga_ins on esquema_ligacoes;
create policy esquema_liga_ins on esquema_ligacoes for insert to authenticated with check (eh_gestor());
drop policy if exists esquema_liga_upd on esquema_ligacoes;
create policy esquema_liga_upd on esquema_ligacoes for update to authenticated using (eh_gestor()) with check (eh_gestor());
drop policy if exists esquema_liga_del on esquema_ligacoes;
create policy esquema_liga_del on esquema_ligacoes for delete to authenticated using (eh_gestor());

revoke all on esquema_nos      from anon;
revoke all on esquema_ligacoes from anon;

-- O nó carregando a saúde do que está debaixo dele. É o cruzamento que
-- interessa: "a etapa que mais para é justo a que todo mundo depende".
create or replace view vw_esquema_nos with (security_invoker = on) as
select
  n.id            as no_id,
  n.esquema_id,
  es.nome         as esquema_nome,
  es.cor          as esquema_cor,
  es.icone        as esquema_icone,
  n.unidade_id,
  n.planta_id,
  n.setor_id,
  n.nome,
  n.descricao,
  n.pos_x_m,
  n.pos_y_m,
  n.ordem,
  u.nome          as unidade,
  s.nome          as setor,
  p.nome          as planta,
  coalesce(m.qtd, 0)          as qtd_maquinas,
  coalesce(m.paradas, 0)      as maquinas_paradas,
  coalesce(m.em_conserto, 0)  as maquinas_em_conserto,
  coalesce(m.criticas_a, 0)   as maquinas_criticas,
  coalesce(m.custo_12m, 0)    as custo_12m,
  coalesce(m.os_abertas, 0)   as os_abertas
from esquema_nos n
join esquemas es       on es.id = n.esquema_id
join unidades u        on u.id = n.unidade_id
left join setores s    on s.id = n.setor_id
left join plantas p    on p.id = n.planta_id
left join lateral (
  select
    count(*)                                             as qtd,
    count(*) filter (where v.situacao = 'parado')        as paradas,
    count(*) filter (where v.situacao = 'em_manutencao') as em_conserto,
    count(*) filter (where v.criticidade = 'A')          as criticas_a,
    sum(v.custo_12m)                                     as custo_12m,
    sum(v.os_abertas)                                    as os_abertas
  from vw_planta_ativos v
  join ativos a on a.id = v.ativo_id
  where n.setor_id is not null and a.setor_id = n.setor_id
) m on true
where n.ativo and es.ativo;

grant select on vw_esquema_nos to authenticated;
revoke all on vw_esquema_nos from anon;

-- As setas, com as duas pontas já resolvidas.
create or replace view vw_esquema_ligacoes with (security_invoker = on) as
select
  f.id           as ligacao_id,
  f.tipo,
  f.rotulo,
  de.esquema_id,
  de.id          as de_id,
  de.nome        as de_nome,
  de.planta_id   as de_planta_id,
  de.pos_x_m     as de_x,
  de.pos_y_m     as de_y,
  de.unidade_id,
  pa.id          as para_id,
  pa.nome        as para_nome,
  pa.planta_id   as para_planta_id,
  pa.pos_x_m     as para_x,
  pa.pos_y_m     as para_y,
  (de.planta_id is distinct from pa.planta_id) as sai_do_galpao
from esquema_ligacoes f
join esquema_nos de on de.id = f.de_id
join esquema_nos pa on pa.id = f.para_id
where de.ativo and pa.ativo;

grant select on vw_esquema_ligacoes to authenticated;
revoke all on vw_esquema_ligacoes from anon;

-- =====================================================================
-- 8.6 ALERTAS: SOM POR EVENTO E MÁQUINAS SILENCIADAS
-- =====================================================================
--
-- Cada pessoa escolhe o próprio menu: qual som toca para qual evento, e
-- quais máquinas ela não quer ouvir (a que está sempre parada porque foi
-- desativada, por exemplo). Por isso a preferência é por perfil, não
-- global — a TV do chão de fábrica tocando para todo mundo é uma escolha,
-- não a única forma de usar.
--
-- Sem linha = padrão (evento ligado, som 'sino'). Só grava quando a pessoa
-- muda algo, então a maioria nunca terá linha nenhuma aqui.

create table if not exists alerta_preferencias (
  perfil_id     uuid not null references perfis(id) on delete cascade,
  evento        text not null check (evento in (
                  'emergencia', 'maquina_parada', 'nova_solicitacao', 'os_pausada'
                )),
  som           text not null default 'sino',
  ativo         boolean not null default true,
  atualizado_em timestamptz not null default now(),
  primary key (perfil_id, evento)
);

drop trigger if exists trg_alerta_prefs_atualizado on alerta_preferencias;
create trigger trg_alerta_prefs_atualizado before update on alerta_preferencias
  for each row execute function fn_atualizado_em();

alter table alerta_preferencias enable row level security;
drop policy if exists alerta_prefs_all on alerta_preferencias;
create policy alerta_prefs_all on alerta_preferencias for all to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
revoke all on alerta_preferencias from anon;

create table if not exists alerta_ativos_silenciados (
  perfil_id  uuid not null references perfis(id) on delete cascade,
  ativo_id   uuid not null references ativos(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (perfil_id, ativo_id)
);

alter table alerta_ativos_silenciados enable row level security;
drop policy if exists alerta_silenc_all on alerta_ativos_silenciados;
create policy alerta_silenc_all on alerta_ativos_silenciados for all to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
revoke all on alerta_ativos_silenciados from anon;

-- A TV escuta mudança em tempo real nessas três tabelas. Sem entrar na
-- publicação, o canal do Supabase Realtime não recebe nada — e sem
-- replica identity full, o evento de UPDATE chega sem o valor antigo,
-- que é exatamente o que decide "acabou de parar" vs. "já estava parada".
alter table ativos               replica identity full;
alter table ordens_servico       replica identity full;
alter table solicitacoes_servico replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ativos'
  ) then
    alter publication supabase_realtime add table ativos;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ordens_servico'
  ) then
    alter publication supabase_realtime add table ordens_servico;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'solicitacoes_servico'
  ) then
    alter publication supabase_realtime add table solicitacoes_servico;
  end if;
end $$;

-- =====================================================================
-- 8.2 BUCKET DOS ÁUDIOS
-- =====================================================================
--
-- O operador grava sem ter conta, então o anônimo precisa poder enviar.
-- Ele envia e nada mais: não lista, não apaga, não sobrescreve.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audios', 'audios', true, 10485760,
        array['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/aac'])
on conflict (id) do update
  set public = true, file_size_limit = 10485760,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists audios_envio_anonimo on storage.objects;
create policy audios_envio_anonimo on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'audios');

drop policy if exists audios_leitura on storage.objects;
create policy audios_leitura on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'audios');

-- Mesma lógica pra foto: quem não sabe escrever bem, tira uma foto do
-- problema. Mais simples de "ler" que qualquer frase.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 8388608,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
  set public = true, file_size_limit = 8388608,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fotos_envio_anonimo on storage.objects;
create policy fotos_envio_anonimo on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'fotos');

drop policy if exists fotos_leitura on storage.objects;
create policy fotos_leitura on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'fotos');

-- =====================================================================
-- 8.1 CRIANDO USUÁRIO POR SQL (leia antes de usar)
-- =====================================================================
--
-- O caminho recomendado é o painel: Authentication -> Add user. Ele preenche
-- corretamente as colunas de token que o GoTrue exige.
--
-- Se precisar criar por SQL, as colunas de token PRECISAM ser string vazia,
-- nunca NULL. Deixá-las NULL faz o login falhar com
-- "Database error querying schema", porque o GoTrue tenta ler NULL como texto:
--   error finding user: Scan error on column "confirmation_token"
--
-- Modelo correto:
--
--   do $$
--   declare v_id uuid := gen_random_uuid();
--   begin
--     insert into auth.users (
--       instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
--       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
--       confirmation_token, recovery_token, email_change, email_change_token_new,
--       email_change_token_current, phone_change, phone_change_token, reauthentication_token
--     ) values (
--       '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
--       'fulano@leycolchoes.com.br',
--       extensions.crypt('senha-provisoria', extensions.gen_salt('bf')), now(),
--       '{"provider":"email","providers":["email"]}'::jsonb,
--       '{"nome":"Fulano","papel":"gestor"}'::jsonb, now(), now(),
--       '', '', '', '', '', '', '', ''            -- <= obrigatoriamente vazias
--     );
--     insert into auth.identities (provider_id, user_id, identity_data, provider,
--                                  last_sign_in_at, created_at, updated_at)
--     values (v_id::text, v_id,
--             jsonb_build_object('sub', v_id::text, 'email', 'fulano@leycolchoes.com.br',
--                                'email_verified', true, 'phone_verified', false),
--             'email', now(), now(), now());
--   end $$;
--
-- Conserto, se algum usuário já foi criado com NULL:
--
--   update auth.users set
--     confirmation_token = coalesce(confirmation_token, ''),
--     recovery_token = coalesce(recovery_token, ''),
--     email_change = coalesce(email_change, ''),
--     email_change_token_new = coalesce(email_change_token_new, ''),
--     email_change_token_current = coalesce(email_change_token_current, ''),
--     phone_change = coalesce(phone_change, ''),
--     phone_change_token = coalesce(phone_change_token, ''),
--     reauthentication_token = coalesce(reauthentication_token, '');
--
-- O papel sai de raw_user_meta_data->>'papel' pelo trigger acima; na dúvida:
--   update perfis set papel = 'gestor' where email = 'fulano@leycolchoes.com.br';

-- =====================================================================
-- 8.10 RELATÓRIO DO CHÃO DE FÁBRICA: DESPERDÍCIOS E REAPROVEITAMENTO
-- =====================================================================
--
-- Um relatório diário (molde igual ordens_servico: numeração própria,
-- status com histórico, mídias) que agrupa a inspeção de um dia: quais
-- setores foram olhados, o que se achou de resíduo/reaproveitamento, e
-- a nota de limpeza de cada setor.
--
-- Desperdício e reaproveitamento NÃO são tabelas separadas: são o MESMO
-- livro-razão (residuo_lancamentos), diferenciado por tipo_movimentacao.
-- É isso que evita contar o mesmo material duas vezes conforme ele anda
-- de "gerado" -> "separado" -> "moído" -> "reutilizado": cada etapa é uma
-- linha nova no mesmo material, e o saldo (view mais abaixo) faz a conta
-- geração − consumo definitivo, nunca soma etapa com etapa.
--
-- Decisão importante: "quadrante" (ex. "7C") NÃO tem cadastro no banco —
-- é geometria calculada em vw_planta_ativos a partir da posição x/y na
-- planta. Por isso aqui ele é texto livre (mesmo formato), com setor_id
-- como o vínculo de verdade pro cadastro real de setores.

do $$ begin
  create type status_relatorio_chao as enum ('aberta', 'em_andamento', 'concluida', 'reaberta', 'cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unidade_medida_residuo as enum ('kg', 'unidade', 'conjunto', 'm3', 'big_bag');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_movimentacao_residuo as enum (
    'geracao', 'identificado_reaproveitavel', 'separado', 'enviado_moagem', 'moido',
    'reutilizacao_interna', 'venda_reciclagem', 'descarte', 'ajuste_positivo', 'ajuste_negativo'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type origem_residuo as enum (
    'producao', 'corte', 'colagem', 'montagem', 'reforma_colchoes', 'devolucao',
    'manutencao', 'estoque', 'outro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type condicao_residuo as enum (
    'limpo', 'parcialmente_aproveitavel', 'contaminado', 'sem_aproveitamento', 'aguardando_avaliacao'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type destinacao_residuo as enum (
    'estoque_residuos', 'separacao', 'moagem', 'reutilizacao_interna', 'venda_reciclagem',
    'descarte', 'aguardando_definicao'
  );
exception when duplicate_object then null; end $$;

-- Checklist 5S da avaliação de limpeza por setor: 4 níveis de resposta,
-- "não inspecionado" é por pergunta (não deu pra julgar aquele S), não
-- confundir com o nao_inspecionado da tabela de setor (setor inteiro
-- não visitado hoje).
do $$ begin
  create type resposta_5s as enum ('conforme', 'parcial', 'nao_conforme', 'nao_inspecionado');
exception when duplicate_object then null; end $$;

create sequence if not exists seq_numero_relatorio_chao start 1;

-- (32) relatorios_chao -----------------------------------------------------
-- O cabeçalho agrupador do dia. "turno" é texto livre (não toda unidade
-- trabalha em turnos) — quando usado, normalmente será manhã/tarde/noite.
create table if not exists relatorios_chao (
  id                       uuid primary key default gen_random_uuid(),
  numero                   text unique,
  unidade_id               uuid not null references unidades(id) on delete restrict,
  data                     date not null default current_date,
  turno                    text,
  responsavel_id           uuid references perfis(id) on delete set null,
  status                   status_relatorio_chao not null default 'aberta',
  horario_previsto         time,
  observacao_inicial       text,
  -- exigidos só na conclusão (a RPC concluir_relatorio_chao valida isso)
  conclusao_situacao       text,
  conclusao_atencao        text,
  conclusao_providencias   text,
  sem_desperdicio_confirmado boolean not null default false,
  sem_reaproveitamento_confirmado boolean not null default false,
  -- se foi aberto driblando a checagem de duplicidade, fica registrado aqui
  justificativa_duplicidade text,
  aberta_em                timestamptz not null default now(),
  concluida_em             timestamptz,
  concluida_por            uuid references perfis(id) on delete set null,
  reaberta_em              timestamptz,
  reaberta_por             uuid references perfis(id) on delete set null,
  motivo_reabertura        text,
  cancelada_em             timestamptz,
  cancelada_por            uuid references perfis(id) on delete set null,
  motivo_cancelamento      text,
  criado_por               uuid references perfis(id) on delete set null,
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now()
);

create index if not exists idx_rel_chao_unidade_data on relatorios_chao(unidade_id, data desc);
create index if not exists idx_rel_chao_status on relatorios_chao(status);
create index if not exists idx_rel_chao_responsavel on relatorios_chao(responsavel_id);

drop trigger if exists trg_rel_chao_atualizado on relatorios_chao;
create trigger trg_rel_chao_atualizado before update on relatorios_chao
  for each row execute function fn_atualizado_em();

-- (33) relatorio_chao_setores -----------------------------------------
-- Setor previsto na abertura + avaliação de limpeza do dia (a mesma
-- linha: um setor por relatório). "nota" e a confirmação ficam nulas até
-- a inspeção acontecer. nota é numeric (não mais smallint) porque agora
-- é calculada automaticamente a partir do checklist 5S (ver tabela
-- seguinte), não escolhida à mão — pode sair com casa decimal (ex.: 3.4).
-- quadrantes_inspecionados/principais_problemas/observacao/acao_recomendada
-- ficam mantidas por compatibilidade mas não são mais preenchidas pelo
-- fluxo atual — o detalhe de cada problema mora em relatorio_chao_setor_5s.
create table if not exists relatorio_chao_setores (
  id                        uuid primary key default gen_random_uuid(),
  relatorio_id              uuid not null references relatorios_chao(id) on delete cascade,
  setor_id                  uuid not null references setores(id) on delete restrict,
  nota                      numeric(3, 1) check (nota is null or (nota >= 1 and nota <= 5)),
  nao_inspecionado          boolean not null default false,
  justificativa_nao_inspecionado text,
  quadrantes_inspecionados  text[] not null default '{}',
  principais_problemas      text,
  observacao                text,
  acao_recomendada          text,
  confirmado_em             timestamptz,
  confirmado_por            uuid references perfis(id) on delete set null,
  criado_em                 timestamptz not null default now(),
  unique (relatorio_id, setor_id),
  check (nota is null or nao_inspecionado = false)
);

create index if not exists idx_rel_chao_setores_rel on relatorio_chao_setores(relatorio_id);

-- (33b) relatorio_chao_setor_5s ------------------------------------------
-- Uma linha por (avaliação de setor, item do 5S) — 5 linhas por setor
-- visitado. "Não inspecionado" aqui é por pergunta (não deu pra julgar
-- aquele S específico), diferente do nao_inspecionado da tabela acima
-- (o setor inteiro não foi visitado hoje). Fase de aprendizado do 5S:
-- pergunta simples, só pede detalhe quando a resposta é Parcial ou Não
-- conforme — sem ranking nem cobrança por enquanto.
create table if not exists relatorio_chao_setor_5s (
  id                  uuid primary key default gen_random_uuid(),
  setor_avaliacao_id  uuid not null references relatorio_chao_setores(id) on delete cascade,
  item                text not null check (item in ('seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke')),
  resposta            resposta_5s not null,
  descricao_problema  text,
  quadrante           text,
  sugestao            text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  unique (setor_avaliacao_id, item)
);

create index if not exists idx_rel_chao_setor_5s_setor on relatorio_chao_setor_5s(setor_avaliacao_id);

-- (34) materiais_residuo ------------------------------------------------
-- "categoria" é texto livre (não enum): a fábrica vai inventar material
-- novo com categoria nova sem precisar de migração pra isso.
create table if not exists materiais_residuo (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null unique,
  categoria              text not null,
  descricao              text,
  unidade_principal      unidade_medida_residuo not null,
  permite_reaproveitamento boolean not null default true,
  ativo                  boolean not null default true,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

drop trigger if exists trg_materiais_residuo_atualizado on materiais_residuo;
create trigger trg_materiais_residuo_atualizado before update on materiais_residuo
  for each row execute function fn_atualizado_em();

-- (35) residuo_lancamentos ----------------------------------------------
-- O livro-razão único de desperdício + reaproveitamento. Todo lançamento
-- pertence a um relatório (vínculo obrigatório com a inspeção de origem).
create table if not exists residuo_lancamentos (
  id                        uuid primary key default gen_random_uuid(),
  relatorio_id              uuid not null references relatorios_chao(id) on delete cascade,
  material_id               uuid not null references materiais_residuo(id) on delete restrict,
  tipo_movimentacao         tipo_movimentacao_residuo not null,
  origem                    origem_residuo,
  condicao                  condicao_residuo,
  destinacao                destinacao_residuo,
  motivo                    text,
  setor_id                  uuid references setores(id) on delete set null,
  quadrante                 text,
  localizacao_complementar  text,
  -- setor/processo que provavelmente GEROU o resíduo — diferente de onde
  -- foi ENCONTRADO (setor_id). Nunca assumir que são o mesmo.
  provavel_setor_origem_id  uuid references setores(id) on delete set null,
  ativo_id                  uuid references ativos(id) on delete set null,
  observacao                text,
  registrado_por            uuid references perfis(id) on delete set null,
  criado_em                 timestamptz not null default now()
);

create index if not exists idx_residuo_lanc_relatorio on residuo_lancamentos(relatorio_id);
create index if not exists idx_residuo_lanc_material on residuo_lancamentos(material_id, tipo_movimentacao);
create index if not exists idx_residuo_lanc_setor on residuo_lancamentos(setor_id);
create index if not exists idx_residuo_lanc_criado on residuo_lancamentos(criado_em desc);

-- (36) residuo_medicoes --------------------------------------------------
-- Um lançamento pode ter mais de uma medição (EPS: unidade + kg + m³ ao
-- mesmo tempo). Nunca somamos entre unidade_medida diferentes.
create table if not exists residuo_medicoes (
  id             uuid primary key default gen_random_uuid(),
  lancamento_id  uuid not null references residuo_lancamentos(id) on delete cascade,
  unidade_medida unidade_medida_residuo not null,
  quantidade     numeric(14,3) not null check (quantidade > 0),
  unique (lancamento_id, unidade_medida)
);

create index if not exists idx_residuo_med_lanc on residuo_medicoes(lancamento_id);

-- (37) residuo_bigbags ---------------------------------------------------
-- O big bag físico, que pode acumular pesagens em vários dias antes de
-- ser esvaziado/trocado.
create table if not exists residuo_bigbags (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    uuid not null references unidades(id) on delete restrict,
  identificacao text not null,
  material_id   uuid references materiais_residuo(id) on delete set null,
  setor_id      uuid references setores(id) on delete set null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  unique (unidade_id, identificacao)
);

-- (38) residuo_bigbag_pesagens --------------------------------------------
-- Cada pesagem manual na balança do setor. peso_liquido às vezes é
-- CALCULADO (bruto − tara) e às vezes é a própria LEITURA do dia no modo
-- de acúmulo — por isso fica como coluna própria, não só derivada.
create table if not exists residuo_bigbag_pesagens (
  id                    uuid primary key default gen_random_uuid(),
  bigbag_id             uuid not null references residuo_bigbags(id) on delete cascade,
  relatorio_id          uuid references relatorios_chao(id) on delete set null,
  lancamento_id         uuid references residuo_lancamentos(id) on delete set null,
  data                  date not null default current_date,
  peso_bruto            numeric(10,2),
  tara                  numeric(10,2),
  peso_liquido          numeric(10,2),
  quantidade_bigbags    int,
  -- modo de acúmulo (o mesmo bigbag junta resíduo por vários dias)
  peso_liquido_inicial  numeric(10,2),
  peso_liquido_final    numeric(10,2),
  quantidade_retirada   numeric(10,2),
  quantidade_gerada_dia numeric(10,2),
  registrado_por        uuid references perfis(id) on delete set null,
  criado_em             timestamptz not null default now()
);

create index if not exists idx_bigbag_pesagens_bigbag on residuo_bigbag_pesagens(bigbag_id, data desc);

-- (39) relatorio_chao_midias ----------------------------------------------
-- Uma tabela só pros 3 pontos de anexo do módulo (relatório geral,
-- lançamento, avaliação de setor) em vez de triplicar a tabela de mídia
-- — os 3 pertencem ao mesmo relatório, então o vínculo opcional resolve
-- sem regredir a rastreabilidade.
create table if not exists relatorio_chao_midias (
  id                  uuid primary key default gen_random_uuid(),
  relatorio_id        uuid not null references relatorios_chao(id) on delete cascade,
  lancamento_id       uuid references residuo_lancamentos(id) on delete cascade,
  setor_avaliacao_id  uuid references relatorio_chao_setores(id) on delete cascade,
  -- Foto de um problema específico do checklist 5S (opcional, só quando
  -- a resposta é Parcial/Não conforme) — além de setor_avaliacao_id
  -- (o setor inteiro), pra saber qual dos 5 itens é a foto.
  setor_5s_id         uuid references relatorio_chao_setor_5s(id) on delete cascade,
  url                 text not null,
  storage_path        text,
  mime_type           text,
  legenda             text,
  enviado_por         uuid references perfis(id) on delete set null,
  criado_em           timestamptz not null default now(),
  check (lancamento_id is null or (setor_avaliacao_id is null and setor_5s_id is null))
);

create index if not exists idx_rel_chao_midias_rel on relatorio_chao_midias(relatorio_id);
create index if not exists idx_rel_chao_midias_lanc on relatorio_chao_midias(lancamento_id);
create index if not exists idx_rel_chao_midias_setor on relatorio_chao_midias(setor_avaliacao_id);
create index if not exists idx_rel_chao_midias_setor_5s on relatorio_chao_midias(setor_5s_id);

-- (40) relatorio_chao_producao ---------------------------------------------
-- Registro opcional de produção do dia, pra depois calcular kg de
-- resíduo por 100 colchões / índice de perda sem inventar proxy nenhum.
create table if not exists relatorio_chao_producao (
  id                       uuid primary key default gen_random_uuid(),
  relatorio_id             uuid not null references relatorios_chao(id) on delete cascade,
  setor_id                 uuid references setores(id) on delete set null,
  colchoes_produzidos      int,
  kg_material_processado   numeric(14,2),
  quantidade_produzida     numeric(14,2),
  unidade_produzida        text,
  criado_em                timestamptz not null default now()
);

create index if not exists idx_rel_chao_producao_rel on relatorio_chao_producao(relatorio_id);

-- (41) relatorio_chao_historico --------------------------------------------
-- Trilha de status igual os_historico: toda reabertura/cancelamento fica
-- registrado aqui, além do que já vai pra tabela genérica `auditoria`.
create table if not exists relatorio_chao_historico (
  id            uuid primary key default gen_random_uuid(),
  relatorio_id  uuid not null references relatorios_chao(id) on delete cascade,
  status_de     status_relatorio_chao,
  status_para   status_relatorio_chao not null,
  comentario    text,
  autor_id      uuid references perfis(id) on delete set null,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_rel_chao_hist on relatorio_chao_historico(relatorio_id, criado_em);

-- (42) metas_chao ------------------------------------------------------
-- Fica pronta pra quando houver linha de base — não pré-cadastramos
-- meta nenhuma.
create table if not exists metas_chao (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  indicador         text not null,
  material_id       uuid references materiais_residuo(id) on delete cascade,
  setor_id          uuid references setores(id) on delete cascade,
  quadrante         text,
  unidade_medida    text,
  valor_alvo        numeric(14,3) not null,
  periodicidade     text not null check (periodicidade in ('diaria','semanal','mensal','anual')),
  periodo_base_inicio date,
  periodo_base_fim    date,
  inicio            date not null default current_date,
  termino           date,
  ativo             boolean not null default true,
  criado_por        uuid references perfis(id) on delete set null,
  criado_em         timestamptz not null default now(),
  check (indicador in (
    'max_residuo_material','max_residuo_setor','max_descarte','max_ocorrencias_quadrante',
    'min_destinacao_util','min_reaproveitamento_concluido','max_kg_por_100_colchoes',
    'max_indice_perda','min_nota_limpeza','nenhum_setor_nota_1',
    'pct_min_setores_inspecionados','pct_min_relatorios_no_prazo','reducao_percentual'
  ))
);

-- --- numeração do relatório, igual OS/solicitação ----------------------
create or replace function fn_numero_relatorio_chao()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.numero is null then
    new.numero := 'RCF-' || to_char(now(), 'YYYY') || '-' ||
                  lpad(nextval('seq_numero_relatorio_chao')::text, 5, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_rel_chao_numero on relatorios_chao;
create trigger trg_rel_chao_numero before insert on relatorios_chao
for each row execute function fn_numero_relatorio_chao();

-- --- histórico de status, igual os_historico -----------------------------
create or replace function fn_rel_chao_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into relatorio_chao_historico (relatorio_id, status_de, status_para, autor_id)
    values (new.id, null, new.status, auth.uid());
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into relatorio_chao_historico (relatorio_id, status_de, status_para, autor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;

  return new;
end $$;

drop trigger if exists trg_rel_chao_status_ins on relatorios_chao;
create trigger trg_rel_chao_status_ins after insert on relatorios_chao
for each row execute function fn_rel_chao_status();

drop trigger if exists trg_rel_chao_status_upd on relatorios_chao;
create trigger trg_rel_chao_status_upd after update of status on relatorios_chao
for each row execute function fn_rel_chao_status();

-- --- pesagem de bigbag: calcula peso líquido quando vem bruto+tara ------
-- (o modo de acúmulo informa peso_liquido_final na mão, sem bruto/tara)
create or replace function fn_bigbag_calcula_liquido()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.peso_liquido is null and new.peso_bruto is not null and new.tara is not null then
    new.peso_liquido := round(new.peso_bruto - new.tara, 2);
  end if;
  if new.peso_liquido_inicial is not null and new.peso_liquido_final is not null then
    new.quantidade_gerada_dia := round(
      new.peso_liquido_final + coalesce(new.quantidade_retirada, 0) - new.peso_liquido_inicial, 2);
  end if;
  return new;
end $$;

drop trigger if exists trg_bigbag_calcula on residuo_bigbag_pesagens;
create trigger trg_bigbag_calcula before insert or update on residuo_bigbag_pesagens
for each row execute function fn_bigbag_calcula_liquido();

-- --- RPCs -----------------------------------------------------------------

-- Abre o relatório do dia. Se já existir um pra mesma data+unidade+turno
-- (e não cancelado), bloqueia — a menos que quem chame seja gestor E tenha
-- mandado justificativa, caso em que segue e grava a justificativa.
create or replace function abrir_relatorio_chao(
  p_unidade_id       uuid,
  p_data             date default current_date,
  p_turno            text default null,
  p_responsavel_id   uuid default null,
  p_setores_ids      uuid[] default '{}',
  p_horario_previsto time default null,
  p_observacao_inicial text default null,
  p_justificativa_duplicidade text default null
)
returns table(id uuid, numero text, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_existente uuid;
  v_id uuid;
  v_numero text;
  v_setor uuid;
begin
  if not eh_tecnico_ou_gestor() then
    return query select null::uuid, null::text, 'Você não tem permissão pra abrir relatório.'::text;
    return;
  end if;

  select rc.id into v_existente
    from relatorios_chao rc
   where rc.unidade_id = p_unidade_id
     and rc.data = p_data
     and rc.turno is not distinct from p_turno
     and rc.status <> 'cancelada'
   limit 1;

  if v_existente is not null then
    if not eh_gestor() or nullif(btrim(coalesce(p_justificativa_duplicidade, '')), '') is null then
      return query select null::uuid, null::text,
        'Já existe um relatório pra essa data, unidade e turno. Só gestor pode abrir outro, com justificativa.'::text;
      return;
    end if;
  end if;

  insert into relatorios_chao (
    unidade_id, data, turno, responsavel_id, horario_previsto, observacao_inicial,
    justificativa_duplicidade, criado_por, status
  ) values (
    p_unidade_id, p_data, p_turno, p_responsavel_id, p_horario_previsto, p_observacao_inicial,
    case when v_existente is not null then p_justificativa_duplicidade else null end,
    auth.uid(), 'aberta'
  ) returning relatorios_chao.id, relatorios_chao.numero into v_id, v_numero;

  foreach v_setor in array coalesce(p_setores_ids, '{}') loop
    insert into relatorio_chao_setores (relatorio_id, setor_id)
    values (v_id, v_setor)
    on conflict (relatorio_id, setor_id) do nothing;
  end loop;

  return query select v_id, v_numero, null::text;
end $$;

revoke execute on function abrir_relatorio_chao(uuid, date, text, uuid, uuid[], time, text, text) from public;
grant execute on function abrir_relatorio_chao(uuid, date, text, uuid, uuid[], time, text, text) to authenticated;

-- Um lançamento só pode ser criado/editado enquanto o relatório está
-- aberto/em andamento/reaberto — mesmo pra gestor. Diferente de
-- pode_editar_os (que deixa gestor sempre editar), aqui a reabertura É
-- o portão de auditoria que o pedido exige: gestor não edita relatório
-- concluído sem reabrir primeiro.
create or replace function pode_editar_relatorio_chao(p_relatorio uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select eh_tecnico_ou_gestor() and exists (
    select 1 from relatorios_chao r
     where r.id = p_relatorio
       and r.status in ('aberta', 'em_andamento', 'reaberta')
  )
$$;

-- Registra um lançamento (desperdício OU etapa de reaproveitamento — o
-- que diferencia é p_tipo_movimentacao) com uma ou mais medições, tudo
-- numa transação só. p_medicoes: [{"unidade_medida":"kg","quantidade":18.5}, ...]
create or replace function registrar_residuo(
  p_relatorio_id  uuid,
  p_material_id   uuid,
  p_tipo_movimentacao tipo_movimentacao_residuo,
  p_medicoes      jsonb,
  p_origem        origem_residuo default null,
  p_condicao      condicao_residuo default null,
  p_destinacao    destinacao_residuo default null,
  p_motivo        text default null,
  p_setor_id      uuid default null,
  p_quadrante     text default null,
  p_localizacao_complementar text default null,
  p_provavel_setor_origem_id uuid default null,
  p_ativo_id      uuid default null,
  p_observacao    text default null
)
returns table(id uuid, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_medicao jsonb;
begin
  if not pode_editar_relatorio_chao(p_relatorio_id) then
    return query select null::uuid, 'Esse relatório não está mais aberto pra edição.'::text;
    return;
  end if;

  if jsonb_array_length(coalesce(p_medicoes, '[]'::jsonb)) = 0 then
    return query select null::uuid, 'Informe pelo menos uma medição (kg, unidades, m³...).'::text;
    return;
  end if;

  insert into residuo_lancamentos (
    relatorio_id, material_id, tipo_movimentacao, origem, condicao, destinacao, motivo,
    setor_id, quadrante, localizacao_complementar, provavel_setor_origem_id, ativo_id,
    observacao, registrado_por
  ) values (
    p_relatorio_id, p_material_id, p_tipo_movimentacao, p_origem, p_condicao, p_destinacao, p_motivo,
    p_setor_id, nullif(btrim(coalesce(p_quadrante, '')), ''), p_localizacao_complementar,
    p_provavel_setor_origem_id, p_ativo_id, p_observacao, auth.uid()
  ) returning residuo_lancamentos.id into v_id;

  for v_medicao in select * from jsonb_array_elements(p_medicoes) loop
    insert into residuo_medicoes (lancamento_id, unidade_medida, quantidade)
    values (
      v_id,
      (v_medicao->>'unidade_medida')::unidade_medida_residuo,
      (v_medicao->>'quantidade')::numeric
    );
  end loop;

  update relatorios_chao set status = 'em_andamento'
   where relatorios_chao.id = p_relatorio_id and relatorios_chao.status = 'aberta';

  insert into auditoria (tabela, registro_id, operacao, dados_depois, autor_id)
  values ('residuo_lancamentos', v_id::text, 'registrar_residuo',
          jsonb_build_object('relatorio_id', p_relatorio_id, 'tipo', p_tipo_movimentacao), auth.uid());

  return query select v_id, null::text;
end $$;

revoke execute on function registrar_residuo(uuid, uuid, tipo_movimentacao_residuo, jsonb, origem_residuo, condicao_residuo, destinacao_residuo, text, uuid, text, text, uuid, uuid, text) from public;
grant execute on function registrar_residuo(uuid, uuid, tipo_movimentacao_residuo, jsonb, origem_residuo, condicao_residuo, destinacao_residuo, text, uuid, text, text, uuid, uuid, text) to authenticated;

-- Nota do setor não é mais escolhida à mão: recalcula sozinha sempre
-- que uma resposta do checklist 5S muda (conforme=2, parcial=1, não
-- conforme=0, média das respondidas — "não inspecionado" não entra na
-- média — escalada de 1 a 5).
create or replace function fn_recalcula_nota_5s() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_setor_avaliacao_id uuid := coalesce(new.setor_avaliacao_id, old.setor_avaliacao_id);
  v_media numeric;
  v_qtd_respondida int;
begin
  select
    count(*) filter (where resposta <> 'nao_inspecionado'),
    avg(case resposta
          when 'conforme' then 2 when 'parcial' then 1 when 'nao_conforme' then 0
        end) filter (where resposta <> 'nao_inspecionado')
  into v_qtd_respondida, v_media
  from relatorio_chao_setor_5s
  where setor_avaliacao_id = v_setor_avaliacao_id;

  update relatorio_chao_setores set
    nota = case when v_qtd_respondida > 0 then round((1 + v_media * 2)::numeric, 1) else null end
  where id = v_setor_avaliacao_id;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_recalcula_nota_5s on relatorio_chao_setor_5s;
create trigger trg_recalcula_nota_5s
after insert or update or delete on relatorio_chao_setor_5s
for each row execute function fn_recalcula_nota_5s();

revoke execute on function fn_recalcula_nota_5s() from anon, authenticated, public;

-- Responde as 5 perguntas do checklist de uma vez (a tela manda o
-- checklist inteiro). p_respostas: jsonb array de
-- {item, resposta, descricao_problema, quadrante, sugestao}.
create or replace function responder_checklist_5s(
  p_relatorio_setor_id uuid,
  p_respostas          jsonb
)
returns table(id uuid, nota numeric, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_relatorio uuid;
  v_item jsonb;
  v_item_nome text;
  v_resposta text;
begin
  select relatorio_chao_setores.relatorio_id into v_relatorio
    from relatorio_chao_setores where relatorio_chao_setores.id = p_relatorio_setor_id;
  if v_relatorio is null then
    return query select null::uuid, null::numeric, 'Setor do relatório não encontrado.'::text;
    return;
  end if;
  if not pode_editar_relatorio_chao(v_relatorio) then
    return query select null::uuid, null::numeric, 'Esse relatório não está mais aberto pra edição.'::text;
    return;
  end if;
  if jsonb_array_length(coalesce(p_respostas, '[]'::jsonb)) <> 5 then
    return query select null::uuid, null::numeric, 'Responda as 5 perguntas do checklist.'::text;
    return;
  end if;

  for v_item in select * from jsonb_array_elements(p_respostas) loop
    v_item_nome := v_item->>'item';
    if v_item_nome not in ('seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke') then
      return query select null::uuid, null::numeric, format('Item de checklist desconhecido: %s', v_item_nome)::text;
      return;
    end if;
    v_resposta := v_item->>'resposta';
    if v_resposta not in ('conforme', 'parcial', 'nao_conforme', 'nao_inspecionado') then
      return query select null::uuid, null::numeric, format('Resposta inválida em "%s".', v_item_nome)::text;
      return;
    end if;
    if v_resposta in ('parcial', 'nao_conforme')
       and nullif(btrim(coalesce(v_item->>'descricao_problema', '')), '') is null then
      return query select null::uuid, null::numeric, format('Descreva o problema encontrado em "%s".', v_item_nome)::text;
      return;
    end if;

    insert into relatorio_chao_setor_5s (setor_avaliacao_id, item, resposta, descricao_problema, quadrante, sugestao)
    values (
      p_relatorio_setor_id, v_item_nome, v_resposta::resposta_5s,
      nullif(btrim(coalesce(v_item->>'descricao_problema', '')), ''),
      nullif(btrim(coalesce(v_item->>'quadrante', '')), ''),
      nullif(btrim(coalesce(v_item->>'sugestao', '')), '')
    )
    on conflict (setor_avaliacao_id, item) do update set
      resposta = excluded.resposta,
      descricao_problema = excluded.descricao_problema,
      quadrante = excluded.quadrante,
      sugestao = excluded.sugestao,
      atualizado_em = now();
  end loop;

  update relatorio_chao_setores set
    nao_inspecionado = false,
    justificativa_nao_inspecionado = null,
    confirmado_em = now(),
    confirmado_por = auth.uid()
  where relatorio_chao_setores.id = p_relatorio_setor_id;

  update relatorios_chao set status = 'em_andamento'
   where relatorios_chao.id = v_relatorio and relatorios_chao.status = 'aberta';

  return query
    select p_relatorio_setor_id, relatorio_chao_setores.nota, null::text
    from relatorio_chao_setores where relatorio_chao_setores.id = p_relatorio_setor_id;
end $$;

revoke execute on function responder_checklist_5s(uuid, jsonb) from public, anon;
grant execute on function responder_checklist_5s(uuid, jsonb) to authenticated;

-- Pro caso do setor inteiro não ter dado pra visitar hoje (fechado,
-- inacessível) — diferente de responder o checklist com tudo "não
-- inspecionado", que significa que a pessoa entrou mas não deu pra
-- julgar cada item.
create or replace function marcar_setor_nao_inspecionado(
  p_relatorio_setor_id uuid,
  p_justificativa       text
)
returns table(id uuid, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_relatorio uuid;
begin
  select relatorio_chao_setores.relatorio_id into v_relatorio
    from relatorio_chao_setores where relatorio_chao_setores.id = p_relatorio_setor_id;
  if v_relatorio is null then
    return query select null::uuid, 'Setor do relatório não encontrado.'::text;
    return;
  end if;
  if not pode_editar_relatorio_chao(v_relatorio) then
    return query select null::uuid, 'Esse relatório não está mais aberto pra edição.'::text;
    return;
  end if;
  if nullif(btrim(coalesce(p_justificativa, '')), '') is null then
    return query select null::uuid, 'Informe o motivo de não ter dado pra visitar esse setor.'::text;
    return;
  end if;

  delete from relatorio_chao_setor_5s where setor_avaliacao_id = p_relatorio_setor_id;
  update relatorio_chao_setores set
    nota = null,
    nao_inspecionado = true,
    justificativa_nao_inspecionado = p_justificativa,
    confirmado_em = now(),
    confirmado_por = auth.uid()
  where relatorio_chao_setores.id = p_relatorio_setor_id;

  update relatorios_chao set status = 'em_andamento'
   where relatorios_chao.id = v_relatorio and relatorios_chao.status = 'aberta';

  return query select p_relatorio_setor_id, null::text;
end $$;

revoke execute on function marcar_setor_nao_inspecionado(uuid, text) from public, anon;
grant execute on function marcar_setor_nao_inspecionado(uuid, text) to authenticated;

-- Pesagem manual de bigbag: cria (ou usa) o bigbag pela identificação,
-- registra a pesagem e, se resultar em peso líquido/gerado, já cria o
-- lançamento correspondente no livro-razão (tipo 'geracao', unidade kg) —
-- assim a balança nunca fica desconectada do saldo geral.
create or replace function registrar_pesagem_bigbag(
  p_relatorio_id     uuid,
  p_unidade_id       uuid,
  p_identificacao    text,
  p_material_id      uuid default null,
  p_setor_id         uuid default null,
  p_peso_bruto       numeric default null,
  p_tara             numeric default null,
  p_peso_liquido     numeric default null,
  p_quantidade_bigbags int default null,
  p_peso_liquido_inicial numeric default null,
  p_peso_liquido_final   numeric default null,
  p_quantidade_retirada  numeric default null,
  p_origem           origem_residuo default null,
  p_quadrante        text default null
)
returns table(id uuid, peso_liquido numeric, quantidade_gerada_dia numeric, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_bigbag uuid;
  v_pesagem uuid;
  v_liquido numeric;
  v_gerado numeric;
  v_lancamento uuid;
  v_kg_para_lancar numeric;
begin
  if not pode_editar_relatorio_chao(p_relatorio_id) then
    return query select null::uuid, null::numeric, null::numeric, 'Esse relatório não está mais aberto pra edição.'::text;
    return;
  end if;
  if nullif(btrim(coalesce(p_identificacao, '')), '') is null then
    return query select null::uuid, null::numeric, null::numeric, 'Informe a identificação do big bag.'::text;
    return;
  end if;

  insert into residuo_bigbags (unidade_id, identificacao, material_id, setor_id)
  values (p_unidade_id, btrim(p_identificacao), p_material_id, p_setor_id)
  on conflict (unidade_id, identificacao) do update set
    material_id = coalesce(excluded.material_id, residuo_bigbags.material_id),
    setor_id = coalesce(excluded.setor_id, residuo_bigbags.setor_id)
  returning residuo_bigbags.id into v_bigbag;

  insert into residuo_bigbag_pesagens (
    bigbag_id, relatorio_id, data, peso_bruto, tara, peso_liquido, quantidade_bigbags,
    peso_liquido_inicial, peso_liquido_final, quantidade_retirada, registrado_por
  ) values (
    v_bigbag, p_relatorio_id, current_date, p_peso_bruto, p_tara, p_peso_liquido, p_quantidade_bigbags,
    p_peso_liquido_inicial, p_peso_liquido_final, p_quantidade_retirada, auth.uid()
  ) returning residuo_bigbag_pesagens.id, residuo_bigbag_pesagens.peso_liquido,
              residuo_bigbag_pesagens.quantidade_gerada_dia
    into v_pesagem, v_liquido, v_gerado;

  v_kg_para_lancar := coalesce(v_gerado, v_liquido);

  if p_material_id is not null and coalesce(v_kg_para_lancar, 0) > 0 then
    insert into residuo_lancamentos (
      relatorio_id, material_id, tipo_movimentacao, origem, setor_id, quadrante, observacao, registrado_por
    ) values (
      p_relatorio_id, p_material_id, 'geracao', p_origem, p_setor_id,
      nullif(btrim(coalesce(p_quadrante, '')), ''),
      'Pesagem do big bag ' || btrim(p_identificacao), auth.uid()
    ) returning residuo_lancamentos.id into v_lancamento;

    insert into residuo_medicoes (lancamento_id, unidade_medida, quantidade)
    values (v_lancamento, 'kg', v_kg_para_lancar);

    update residuo_bigbag_pesagens set lancamento_id = v_lancamento
     where residuo_bigbag_pesagens.id = v_pesagem;
  end if;

  update relatorios_chao set status = 'em_andamento'
   where relatorios_chao.id = p_relatorio_id and relatorios_chao.status = 'aberta';

  return query select v_pesagem, v_liquido, v_gerado, null::text;
end $$;

revoke execute on function registrar_pesagem_bigbag(uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, int, numeric, numeric, numeric, origem_residuo, text) from public;
grant execute on function registrar_pesagem_bigbag(uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, int, numeric, numeric, numeric, origem_residuo, text) to authenticated;

-- Conclui: exige que todo setor previsto tenha nota OU justificativa de
-- não-inspecionado, e que desperdício/reaproveitamento tenham pelo menos
-- um lançamento OU a confirmação explícita de "nada encontrado".
create or replace function concluir_relatorio_chao(
  p_relatorio_id         uuid,
  p_conclusao_situacao   text,
  p_conclusao_atencao    text,
  p_conclusao_providencias text,
  p_sem_desperdicio      boolean default false,
  p_sem_reaproveitamento boolean default false
)
returns table(id uuid, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_tem_desperdicio boolean;
  v_tem_reaproveitamento boolean;
begin
  if not pode_editar_relatorio_chao(p_relatorio_id) then
    return query select null::uuid, 'Esse relatório não está mais aberto pra edição.'::text;
    return;
  end if;

  -- Avaliação por setor fica opcional: a adesão à inspeção completa é
  -- gradual, de acordo com o avanço do encarregado, e não deve travar a
  -- conclusão do relatório.

  select exists(
    select 1 from residuo_lancamentos
     where residuo_lancamentos.relatorio_id = p_relatorio_id and residuo_lancamentos.tipo_movimentacao = 'geracao'
  ) into v_tem_desperdicio;
  if not v_tem_desperdicio and not p_sem_desperdicio then
    return query select null::uuid,
      'Registre ao menos um desperdício ou confirme "nenhum desperdício identificado".'::text;
    return;
  end if;

  select exists(
    select 1 from residuo_lancamentos
     where residuo_lancamentos.relatorio_id = p_relatorio_id
       and residuo_lancamentos.tipo_movimentacao <> 'geracao'
  ) into v_tem_reaproveitamento;
  if not v_tem_reaproveitamento and not p_sem_reaproveitamento then
    return query select null::uuid,
      'Registre ao menos uma movimentação de reaproveitamento ou confirme que não houve.'::text;
    return;
  end if;

  if nullif(btrim(coalesce(p_conclusao_situacao, '')), '') is null
     or nullif(btrim(coalesce(p_conclusao_atencao, '')), '') is null
     or nullif(btrim(coalesce(p_conclusao_providencias, '')), '') is null then
    return query select null::uuid,
      'Preencha situação geral, pontos de atenção e providências pra concluir.'::text;
    return;
  end if;

  update relatorios_chao set
    status = 'concluida',
    conclusao_situacao = p_conclusao_situacao,
    conclusao_atencao = p_conclusao_atencao,
    conclusao_providencias = p_conclusao_providencias,
    sem_desperdicio_confirmado = p_sem_desperdicio,
    sem_reaproveitamento_confirmado = p_sem_reaproveitamento,
    concluida_em = now(),
    concluida_por = auth.uid()
  where relatorios_chao.id = p_relatorio_id;

  return query select p_relatorio_id, null::text;
end $$;

revoke execute on function concluir_relatorio_chao(uuid, text, text, text, boolean, boolean) from public;
grant execute on function concluir_relatorio_chao(uuid, text, text, text, boolean, boolean) to authenticated;

-- Reabertura: só gestor, com motivo. Fica registrado no histórico E na
-- auditoria genérica (guarda o estado anterior completo, pra rastro real).
create or replace function reabrir_relatorio_chao(p_relatorio_id uuid, p_motivo text)
returns table(id uuid, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_antes jsonb;
begin
  if not eh_gestor() then
    return query select null::uuid, 'Só gestor pode reabrir um relatório concluído.'::text;
    return;
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    return query select null::uuid, 'Informe o motivo da reabertura.'::text;
    return;
  end if;

  select to_jsonb(r) into v_antes from relatorios_chao r where r.id = p_relatorio_id;
  if v_antes is null then
    return query select null::uuid, 'Relatório não encontrado.'::text;
    return;
  end if;

  update relatorios_chao set
    status = 'reaberta',
    reaberta_em = now(),
    reaberta_por = auth.uid(),
    motivo_reabertura = p_motivo
  where relatorios_chao.id = p_relatorio_id;

  insert into auditoria (tabela, registro_id, operacao, dados_antes, dados_depois, autor_id)
  values ('relatorios_chao', p_relatorio_id::text, 'reabrir_relatorio_chao',
          v_antes, jsonb_build_object('motivo', p_motivo), auth.uid());

  return query select p_relatorio_id, null::text;
end $$;

revoke execute on function reabrir_relatorio_chao(uuid, text) from public;
grant execute on function reabrir_relatorio_chao(uuid, text) to authenticated;

-- Cancelamento: só gestor, com motivo.
create or replace function cancelar_relatorio_chao(p_relatorio_id uuid, p_motivo text)
returns table(id uuid, mensagem text)
language plpgsql security definer set search_path = public as $$
declare
  v_antes jsonb;
begin
  if not eh_gestor() then
    return query select null::uuid, 'Só gestor pode cancelar um relatório.'::text;
    return;
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    return query select null::uuid, 'Informe o motivo do cancelamento.'::text;
    return;
  end if;

  select to_jsonb(r) into v_antes from relatorios_chao r where r.id = p_relatorio_id;
  if v_antes is null then
    return query select null::uuid, 'Relatório não encontrado.'::text;
    return;
  end if;

  update relatorios_chao set
    status = 'cancelada',
    cancelada_em = now(),
    cancelada_por = auth.uid(),
    motivo_cancelamento = p_motivo
  where relatorios_chao.id = p_relatorio_id;

  insert into auditoria (tabela, registro_id, operacao, dados_antes, dados_depois, autor_id)
  values ('relatorios_chao', p_relatorio_id::text, 'cancelar_relatorio_chao',
          v_antes, jsonb_build_object('motivo', p_motivo), auth.uid());

  return query select p_relatorio_id, null::text;
end $$;

revoke execute on function cancelar_relatorio_chao(uuid, text) from public;
grant execute on function cancelar_relatorio_chao(uuid, text) to authenticated;

-- --- views ------------------------------------------------------------

-- Saldo por material + unidade de medida (nunca mistura unidade
-- diferente). Segue a fórmula conceitual do pedido: geração + ajustes
-- positivos − reutilização concluída − venda/reciclagem − descarte −
-- ajustes negativos. Envio pra moagem e "moído" são etapa, não consumo:
-- não entram na subtração do saldo geral, só nas colunas informativas.
-- unidade_id vai por último na lista de colunas (não junto de material_id,
-- onde seria mais natural) porque um `create or replace view` não deixa
-- reordenar/inserir coluna no meio — só acrescentar no fim. Groupby já
-- isola por unidade desde a primeira versão dessa view; antes dessa
-- correção faltava incluir unidade_id na saída e no group by, e o saldo
-- de Eusébio e Timon saía somado (selecionar uma unidade não filtrava
-- nada, porque a view nem sabia de qual unidade era cada linha).
create or replace view vw_residuo_saldo with (security_invoker = on) as
select
  t.material_id,
  t.unidade_medida,
  coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'geracao'), 0)                    as gerado,
  coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'ajuste_positivo'), 0)             as ajustes_positivos,
  coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'ajuste_negativo'), 0)             as ajustes_negativos,
  coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'identificado_reaproveitavel'), 0) as identificado_reaproveitavel,
  coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'separado'), 0)                    as separado,
  coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'enviado_moagem'), 0)              as enviado_moagem,
  coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'moido'), 0)                       as moido,
  coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'reutilizacao_interna'), 0)        as reutilizado_interno,
  coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'venda_reciclagem'), 0)            as vendido_reciclado,
  coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'descarte'), 0)                    as descartado,
  (
    coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'geracao'), 0)
    + coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'ajuste_positivo'), 0)
    - coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'reutilizacao_interna'), 0)
    - coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'venda_reciclagem'), 0)
    - coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'descarte'), 0)
    - coalesce(sum(t.quantidade) filter (where t.tipo_movimentacao = 'ajuste_negativo'), 0)
  ) as saldo,
  max(t.criado_em) as ultima_movimentacao,
  t.unidade_id
from (
  select r.unidade_id, l.material_id, med.unidade_medida, l.tipo_movimentacao, med.quantidade, l.criado_em
  from residuo_lancamentos l
  join residuo_medicoes med on med.lancamento_id = l.id
  join relatorios_chao r on r.id = l.relatorio_id
) t
group by t.unidade_id, t.material_id, t.unidade_medida;

grant select on vw_residuo_saldo to authenticated;
revoke all on vw_residuo_saldo from anon;

-- Uma linha por material com nome/categoria, pra tela de saldo sem outro join
create or replace view vw_residuo_saldo_material with (security_invoker = on) as
select s.*, m.nome as material_nome, m.categoria, m.permite_reaproveitamento
from vw_residuo_saldo s
join materiais_residuo m on m.id = s.material_id;

grant select on vw_residuo_saldo_material to authenticated;
revoke all on vw_residuo_saldo_material from anon;

-- Resumo de cada relatório: pra lista de histórico sem N+1 de contagem.
create or replace view vw_relatorio_chao_resumo with (security_invoker = on) as
select
  r.id,
  r.numero,
  r.data,
  r.turno,
  r.unidade_id,
  u.nome as unidade,
  r.responsavel_id,
  p.nome as responsavel,
  r.status,
  r.horario_previsto,
  r.aberta_em,
  r.concluida_em,
  (select count(*) from relatorio_chao_setores s where s.relatorio_id = r.id) as setores_previstos,
  (select count(*) from relatorio_chao_setores s where s.relatorio_id = r.id and s.nota is not null) as setores_avaliados,
  (select count(*) from relatorio_chao_setores s where s.relatorio_id = r.id and s.nao_inspecionado) as setores_nao_inspecionados,
  (select round(avg(s.nota)::numeric, 2) from relatorio_chao_setores s where s.relatorio_id = r.id and s.nota is not null) as nota_media,
  (select count(*) from residuo_lancamentos l where l.relatorio_id = r.id and l.tipo_movimentacao = 'geracao') as qtd_desperdicios,
  (select count(*) from residuo_lancamentos l where l.relatorio_id = r.id and l.tipo_movimentacao <> 'geracao') as qtd_reaproveitamentos,
  (select count(*) from relatorio_chao_midias fm where fm.relatorio_id = r.id) as qtd_fotos
from relatorios_chao r
join unidades u on u.id = r.unidade_id
left join perfis p on p.id = r.responsavel_id;

grant select on vw_relatorio_chao_resumo to authenticated;
revoke all on vw_relatorio_chao_resumo from anon;

-- Lançamentos com os nomes já resolvidos, pra tabela de histórico/detalhe
-- sem repetir join em cada tela.
create or replace view vw_residuo_lancamentos with (security_invoker = on) as
select
  l.*,
  m.nome as material_nome,
  m.categoria as material_categoria,
  m.unidade_principal,
  s.nome as setor_nome,
  so.nome as provavel_setor_origem_nome,
  a.nome as ativo_nome,
  r.numero as relatorio_numero,
  r.data as relatorio_data,
  r.unidade_id,
  (
    select jsonb_agg(jsonb_build_object('unidade_medida', med.unidade_medida, 'quantidade', med.quantidade))
    from residuo_medicoes med where med.lancamento_id = l.id
  ) as medicoes
from residuo_lancamentos l
join materiais_residuo m on m.id = l.material_id
join relatorios_chao r on r.id = l.relatorio_id
left join setores s on s.id = l.setor_id
left join setores so on so.id = l.provavel_setor_origem_id
left join ativos a on a.id = l.ativo_id;

grant select on vw_residuo_lancamentos to authenticated;
revoke all on vw_residuo_lancamentos from anon;

-- Cada avaliação de limpeza já com o nome do setor e os dados do
-- relatório (data, unidade, turno) resolvidos — usado pelo painel de
-- indicadores (nota por período/setor) e pela exportação do histórico,
-- sem repetir join nas duas telas.
create or replace view vw_relatorio_chao_setor_avaliacoes with (security_invoker = on) as
select
  s.id,
  s.relatorio_id,
  s.setor_id,
  s.nota,
  s.nao_inspecionado,
  s.justificativa_nao_inspecionado,
  s.quadrantes_inspecionados,
  s.principais_problemas,
  s.observacao,
  s.acao_recomendada,
  s.confirmado_em,
  s.confirmado_por,
  st.nome as setor_nome,
  r.numero as relatorio_numero,
  r.data as relatorio_data,
  r.unidade_id,
  r.status as relatorio_status,
  r.turno,
  r.horario_previsto,
  r.concluida_em
from relatorio_chao_setores s
join setores st on st.id = s.setor_id
join relatorios_chao r on r.id = s.relatorio_id;

grant select on vw_relatorio_chao_setor_avaliacoes to authenticated;
revoke all on vw_relatorio_chao_setor_avaliacoes from anon;

-- Cada resposta do checklist 5S já com o nome do setor e os dados do
-- relatório resolvidos — pro histórico e pra exportação.
create or replace view vw_relatorio_chao_setor_5s with (security_invoker = on) as
select
  c.id, c.setor_avaliacao_id, c.item, c.resposta, c.descricao_problema, c.quadrante, c.sugestao,
  c.criado_em,
  s.setor_id, st.nome as setor_nome,
  s.relatorio_id, r.data as relatorio_data, r.unidade_id, r.turno
from relatorio_chao_setor_5s c
join relatorio_chao_setores s on s.id = c.setor_avaliacao_id
join setores st on st.id = s.setor_id
join relatorios_chao r on r.id = s.relatorio_id;

grant select on vw_relatorio_chao_setor_5s to authenticated;
revoke all on vw_relatorio_chao_setor_5s from anon;

-- --- RLS ----------------------------------------------------------------

alter table relatorios_chao          enable row level security;
alter table relatorio_chao_setores   enable row level security;
alter table relatorio_chao_setor_5s  enable row level security;
alter table materiais_residuo        enable row level security;
alter table residuo_lancamentos      enable row level security;
alter table residuo_medicoes         enable row level security;
alter table residuo_bigbags          enable row level security;
alter table residuo_bigbag_pesagens  enable row level security;
alter table relatorio_chao_midias    enable row level security;
alter table relatorio_chao_producao  enable row level security;
alter table relatorio_chao_historico enable row level security;
alter table metas_chao               enable row level security;

drop policy if exists materiais_residuo_sel on materiais_residuo;
create policy materiais_residuo_sel on materiais_residuo for select to authenticated
  using (eh_tecnico_ou_gestor());
drop policy if exists materiais_residuo_wri on materiais_residuo;
create policy materiais_residuo_wri on materiais_residuo for all to authenticated
  using (eh_gestor()) with check (eh_gestor());

drop policy if exists rel_chao_sel on relatorios_chao;
create policy rel_chao_sel on relatorios_chao for select to authenticated
  using (eh_tecnico_ou_gestor());

drop policy if exists rel_chao_ins on relatorios_chao;
create policy rel_chao_ins on relatorios_chao for insert to authenticated
  with check (eh_tecnico_ou_gestor());

drop policy if exists rel_chao_upd_responsavel on relatorios_chao;
create policy rel_chao_upd_responsavel on relatorios_chao for update to authenticated
  using (responsavel_id = auth.uid() and status in ('aberta','em_andamento','reaberta'))
  with check (responsavel_id = auth.uid());

drop policy if exists rel_chao_upd_gestor on relatorios_chao;
create policy rel_chao_upd_gestor on relatorios_chao for update to authenticated
  using (eh_gestor()) with check (eh_gestor());

drop policy if exists rel_chao_setores_sel on relatorio_chao_setores;
create policy rel_chao_setores_sel on relatorio_chao_setores for select to authenticated
  using (eh_tecnico_ou_gestor());
drop policy if exists rel_chao_setores_wri on relatorio_chao_setores;
create policy rel_chao_setores_wri on relatorio_chao_setores for all to authenticated
  using (pode_editar_relatorio_chao(relatorio_id)) with check (pode_editar_relatorio_chao(relatorio_id));

drop policy if exists rel_chao_setor_5s_sel on relatorio_chao_setor_5s;
create policy rel_chao_setor_5s_sel on relatorio_chao_setor_5s for select to authenticated
  using (eh_tecnico_ou_gestor());
drop policy if exists rel_chao_setor_5s_wri on relatorio_chao_setor_5s;
create policy rel_chao_setor_5s_wri on relatorio_chao_setor_5s for all to authenticated
  using (pode_editar_relatorio_chao(
    (select relatorio_id from relatorio_chao_setores where id = setor_avaliacao_id)
  ))
  with check (pode_editar_relatorio_chao(
    (select relatorio_id from relatorio_chao_setores where id = setor_avaliacao_id)
  ));

drop policy if exists residuo_lanc_sel on residuo_lancamentos;
create policy residuo_lanc_sel on residuo_lancamentos for select to authenticated
  using (eh_tecnico_ou_gestor());
drop policy if exists residuo_lanc_wri on residuo_lancamentos;
create policy residuo_lanc_wri on residuo_lancamentos for all to authenticated
  using (pode_editar_relatorio_chao(relatorio_id)) with check (pode_editar_relatorio_chao(relatorio_id));

drop policy if exists residuo_med_sel on residuo_medicoes;
create policy residuo_med_sel on residuo_medicoes for select to authenticated
  using (eh_tecnico_ou_gestor());
drop policy if exists residuo_med_wri on residuo_medicoes;
create policy residuo_med_wri on residuo_medicoes for all to authenticated
  using (
    eh_tecnico_ou_gestor() and pode_editar_relatorio_chao(
      (select relatorio_id from residuo_lancamentos where id = lancamento_id)
    )
  )
  with check (
    eh_tecnico_ou_gestor() and pode_editar_relatorio_chao(
      (select relatorio_id from residuo_lancamentos where id = lancamento_id)
    )
  );

drop policy if exists residuo_bigbags_sel on residuo_bigbags;
create policy residuo_bigbags_sel on residuo_bigbags for select to authenticated
  using (eh_tecnico_ou_gestor());
drop policy if exists residuo_bigbags_wri on residuo_bigbags;
create policy residuo_bigbags_wri on residuo_bigbags for all to authenticated
  using (eh_tecnico_ou_gestor()) with check (eh_tecnico_ou_gestor());

drop policy if exists residuo_bigbag_pes_sel on residuo_bigbag_pesagens;
create policy residuo_bigbag_pes_sel on residuo_bigbag_pesagens for select to authenticated
  using (eh_tecnico_ou_gestor());
drop policy if exists residuo_bigbag_pes_wri on residuo_bigbag_pesagens;
create policy residuo_bigbag_pes_wri on residuo_bigbag_pesagens for all to authenticated
  using (eh_tecnico_ou_gestor()) with check (eh_tecnico_ou_gestor());

drop policy if exists rel_chao_midias_sel on relatorio_chao_midias;
create policy rel_chao_midias_sel on relatorio_chao_midias for select to authenticated
  using (eh_tecnico_ou_gestor());
drop policy if exists rel_chao_midias_wri on relatorio_chao_midias;
create policy rel_chao_midias_wri on relatorio_chao_midias for all to authenticated
  using (pode_editar_relatorio_chao(relatorio_id)) with check (pode_editar_relatorio_chao(relatorio_id));

drop policy if exists rel_chao_producao_sel on relatorio_chao_producao;
create policy rel_chao_producao_sel on relatorio_chao_producao for select to authenticated
  using (eh_tecnico_ou_gestor());
drop policy if exists rel_chao_producao_wri on relatorio_chao_producao;
create policy rel_chao_producao_wri on relatorio_chao_producao for all to authenticated
  using (pode_editar_relatorio_chao(relatorio_id)) with check (pode_editar_relatorio_chao(relatorio_id));

drop policy if exists rel_chao_hist_sel on relatorio_chao_historico;
create policy rel_chao_hist_sel on relatorio_chao_historico for select to authenticated
  using (eh_tecnico_ou_gestor());
-- histórico só é escrito pelos triggers (security definer) — sem policy de insert direta

drop policy if exists metas_chao_sel on metas_chao;
create policy metas_chao_sel on metas_chao for select to authenticated
  using (eh_tecnico_ou_gestor());
drop policy if exists metas_chao_wri on metas_chao;
create policy metas_chao_wri on metas_chao for all to authenticated
  using (eh_gestor()) with check (eh_gestor());

-- ninguém anônimo enxerga nada deste módulo (o operador do QR não participa)
revoke all on relatorios_chao, relatorio_chao_setores, relatorio_chao_setor_5s, materiais_residuo,
  residuo_lancamentos, residuo_medicoes, residuo_bigbags, residuo_bigbag_pesagens,
  relatorio_chao_midias, relatorio_chao_producao, relatorio_chao_historico, metas_chao
  from anon;

-- --- materiais iniciais ---------------------------------------------------
insert into materiais_residuo (nome, categoria, unidade_principal, permite_reaproveitamento)
select v.nome, v.categoria, v.unidade_principal::unidade_medida_residuo, v.permite_reaproveitamento
from (values
  ('Espuma convencional limpa',       'Espuma',   'kg', true),
  ('Espuma convencional contaminada', 'Espuma',   'kg', false),
  ('Espuma aglomerada',               'Espuma',   'kg', true),
  ('EPS/isopor',                      'EPS',      'kg', true),
  ('Molas e molejos',                 'Molejo',   'conjunto', true),
  ('Tecido e matelassê',              'Tecido',   'kg', true),
  ('Feltro',                          'Feltro',   'kg', true),
  ('Plástico',                        'Plástico', 'kg', true),
  ('Madeira',                         'Madeira',  'unidade', true),
  ('Papelão',                         'Papelão',  'kg', true),
  ('Outros',                          'Outros',   'kg', false)
) as v(nome, categoria, unidade_principal, permite_reaproveitamento)
where not exists (select 1 from materiais_residuo m where m.nome = v.nome);

-- =====================================================================
-- 9. SEED
-- =====================================================================

insert into unidades (nome, sigla, cidade, uf) values
  ('Eusébio', 'EUS', 'Eusébio', 'CE'),
  ('Timon',   'TIM', 'Timon',   'MA')
on conflict (nome) do nothing;

-- Galpão de Eusébio: vão livre, sem pilar no meio.
insert into plantas (unidade_id, nome, comprimento_m, largura_m, vao_pilar_m, observacoes)
select id, 'Galpão de produção', 72, 30, 6, 'Vão livre de 30 m, sem pilar no meio; 12 vãos de 6 m'
from unidades where sigla = 'EUS'
on conflict (unidade_id, nome) do nothing;

-- Os três esquemas de cada galpão, prontos para desenhar em cima da planta.
insert into esquemas (unidade_id, nome, cor, icone, ordem, tipo)
select unidade_id, 'Produção', '#4338ca', 'Workflow', 1, 'fluxo' from plantas
union all
select unidade_id, 'Energia', '#d97706', 'Zap', 2, 'energia' from plantas
union all
select unidade_id, 'Bombeiros', '#dc2626', 'Flame', 3, 'fluxo' from plantas
on conflict (unidade_id, nome) do nothing;

insert into categorias_ativo (nome, sigla, grupo) values
  ('Máquina de Corte',        'COR', 'producao'),
  ('Bordado de Tampos',       'BDT', 'producao'),
  ('Bordadeira de Tampo',     'BOR', 'producao'),
  ('Máquina de Molas',        'MOL', 'producao'),
  ('Máquina de Costura',      'COS', 'producao'),
  ('Prensa',                  'PRE', 'producao'),
  ('Seladora',                'SEL', 'producao'),
  ('Esteira Transportadora',  'EST', 'producao'),
  ('Quadro Elétrico',         'QDE', 'eletrica'),
  ('Subestação',              'SUB', 'eletrica'),
  ('Gerador',                 'GER', 'eletrica'),
  ('Compressor',              'CMP', 'utilidades'),
  ('Vaso de Pressão',         'VAS', 'utilidades'),
  ('Sistema de Exaustão',     'EXA', 'utilidades'),
  ('Empilhadeira',            'EMP', 'movimentacao'),
  ('Talha',                   'TAL', 'movimentacao'),
  ('Ponte Rolante',           'PON', 'movimentacao'),
  ('Bomba de Incêndio',       'BIN', 'incendio'),
  ('Hidrante',                'HID', 'incendio'),
  ('Central de Alarme',       'ALM', 'incendio'),
  ('Portão Industrial',       'POR', 'predial'),
  ('Doca',                    'DOC', 'predial'),
  ('Climatização Técnica',    'CLI', 'predial')
on conflict (nome) do nothing;

insert into setores (unidade_id, nome, sigla)
select u.id, s.nome, s.sigla
from unidades u
cross join (values
  ('Corte',        'COR'),
  ('Bordado de Tampos', 'BDT'),
  ('Molas',        'MOL'),
  ('Costura',      'CST'),
  ('Montagem',     'MTG'),
  ('Embalagem',    'EMB'),
  ('Expedição',    'EXP'),
  ('Utilidades',   'UTL'),
  ('Almoxarifado', 'ALM')
) as s(nome, sigla)
where u.sigla = 'EUS'
on conflict (unidade_id, nome) do nothing;

insert into configuracoes (chave, valor, descricao) values
  ('os_parada_dias_alerta',      '5',  'Dias sem movimento numa OS antes do alerta'),
  ('resumo_semanal_dia',         'seg','Dia de envio do resumo semanal'),
  ('notificacao_estoque_baixo',  'true','Avisar quando peça ficar abaixo do mínimo'),
  ('moeda',                      'BRL', 'Moeda usada nos custos'),
  ('rav_limite_atencao',         '10',  'RAV% a partir do qual o ativo entra em atenção'),
  ('rav_limite_substituicao',    '20',  'RAV% a partir do qual vale avaliar substituição')
on conflict (chave) do nothing;

insert into plano_templates (nome, categoria_id, base, periodicidade_dias, descricao)
select 'Preventiva Compressor', c.id, 'calendario', 90,
       'Checklist trimestral padrão para compressores de ar'
from categorias_ativo c where c.sigla = 'CMP'
on conflict (nome) do nothing;

insert into plano_template_itens (template_id, descricao, ordem)
select t.id, i.descricao, i.ordem
from plano_templates t
cross join (values
  ('Verificar nível e trocar óleo',              1),
  ('Substituir filtro de ar',                    2),
  ('Drenar reservatório e verificar purgador',   3),
  ('Inspecionar correias e tensionamento',       4),
  ('Testar válvula de segurança',                5),
  ('Medir corrente do motor e comparar à nominal',6),
  ('Verificar vazamentos na linha',              7)
) as i(descricao, ordem)
where t.nome = 'Preventiva Compressor'
  and not exists (select 1 from plano_template_itens x where x.template_id = t.id);

insert into plano_templates (nome, categoria_id, base, periodicidade_dias, descricao)
select 'Preventiva Quadro Elétrico', c.id, 'calendario', 180,
       'Inspeção semestral de quadro elétrico'
from categorias_ativo c where c.sigla = 'QDE'
on conflict (nome) do nothing;

insert into plano_template_itens (template_id, descricao, ordem)
select t.id, i.descricao, i.ordem
from plano_templates t
cross join (values
  ('Termografia dos barramentos e conexões', 1),
  ('Reaperto geral de conexões',             2),
  ('Limpeza interna do quadro',              3),
  ('Teste de DR e disjuntores',              4),
  ('Conferir identificação dos circuitos',   5),
  ('Verificar aterramento',                  6)
) as i(descricao, ordem)
where t.nome = 'Preventiva Quadro Elétrico'
  and not exists (select 1 from plano_template_itens x where x.template_id = t.id);

-- --- varredura final: fecha anon em TUDO que existe até aqui ----------
-- Vai por último de propósito: o Supabase concede execute pra anon
-- automaticamente em toda função nova (ver comentário perto da sweep
-- lá em cima, antes das primeiras grants) — então qualquer módulo
-- adicionado depois daquela sweep e antes daqui (chão de fábrica,
-- checklist 5S, e o que vier a seguir) nasce aberto pra anon de novo.
-- Rodar isto por último, numa reconstrução do zero, fecha tudo e só
-- reabre explicitamente o punhado de RPCs do fluxo de QR sem login.
revoke execute on all functions in schema public from anon;

grant execute on function ativo_por_qr(uuid) to anon;
grant execute on function abrir_solicitacao_qr(uuid, text, text, boolean, text, text, int) to anon, authenticated;
grant execute on function validar_pin_qr(uuid, text) to anon, authenticated, service_role;
grant execute on function lancar_gasto_qr(uuid, text, text, date, tipo_os, text, numeric, text, numeric, numeric, numeric, numeric, uuid, boolean, uuid) to anon, authenticated, service_role;
grant execute on function fornecedores_para_qr() to anon, authenticated, service_role;
