-- =====================================================================
-- Modelos de preventiva para as máquinas de colchão
-- Acompanha docs/manutencao/plano-manutencao-preventiva.md (seção 4)
-- =====================================================================
-- Ainda NÃO aplicado no banco vivo. Para aplicar: colar no SQL Editor do
-- Supabase (ou via MCP) e, depois de aplicado, copiar este bloco para o
-- fim dos seeds em schema-supabase.sql e na baseline, como manda o
-- cabeçalho da baseline.
--
-- Idempotente: rodar duas vezes não duplica modelo nem item.
--
-- Categoria: o modelo fica preso à categoria do ativo (a tela Preventiva
-- só oferece máquinas da mesma categoria). Os de Bordadeira ficam SEM
-- categoria de propósito: hoje as bordadeiras estão espalhadas em três
-- categorias diferentes (BOR, BDT e COS).
--
-- Só itens de técnico. Os itens diários do operador ficam no cartão da
-- máquina, não viram serviço no SGAI.
-- =====================================================================

begin;

insert into plano_templates (nome, categoria_id, base, periodicidade_dias, descricao)
select m.nome, c.id, 'calendario', m.dias, m.descricao
from (values
  ('Laminadora · Semanal',           'COR',  7, 'Lâmina de fita, guias e pedras de afiar. Laminadora horizontal e vertical.'),
  ('Laminadora · Mensal',            'COR', 30, 'Lubrificação da mesa, correias, polias e motor.'),
  ('Laminadora · Semestral',         'COR',180, 'Rolamentos, quadro/inversor, motor e alinhamento geral.'),
  ('Torno de Laminação · Semanal',   'COR',  7, 'Lâmina de fita, guias e pedras de afiar do torno.'),
  ('Torno de Laminação · Mensal',    'COR', 30, 'Mancais do eixo, fuso de avanço, centragem e transmissão.'),
  ('Torno de Laminação · Semestral', 'COR',180, 'Rolamentos, redutor, quadro/inversor e motor.'),
  ('Bordadeira · Semanal',           null,   7, 'Multi-agulha (tampo e faixa): limpeza fina, correias e pneumática.'),
  ('Bordadeira · Mensal',            null,  30, 'Multi-agulha: lubrificação de eixos, guias, bielas e sincronismo.'),
  ('Bordadeira · Semestral',         null, 180, 'Multi-agulha: ganchos, eletrônica, backup de desenhos e rolamentos.'),
  ('Fechamento · Mensal',            'COS', 30, 'Máquina de fechamento (tape edge): cabeçote, carro e mesa basculante.'),
  ('Fechamento · Semestral',         'COS',180, 'Revisão do cabeçote em bancada, trocando pelo cabeçote reserva.'),
  ('Costura Industrial · Trimestral','COS', 90, 'Reta, overlock, fitilho e passagem de faixa.'),
  ('Aglomerador · Mensal',           'PRE', 30, 'Hidráulica, moinho de aparas e misturador.'),
  ('Aglomerador · Semestral',        'PRE',180, 'Óleo hidráulico, vedações, válvula de alívio e manômetro.'),
  ('Tesoura Elétrica · Mensal',      'COR', 30, 'Escovas de carvão, motor e afiação. O que teria salvo a Tesoura 2.'),
  ('Sublimação · Trimestral',        'PRE', 90, 'Aquecimento, temperatura real, manta e transmissão.'),
  ('Climatizador · Mensal',          'CLI', 30, 'Painel evaporativo, tanque, boia e bomba.'),
  ('Aspiração de Pó · Trimestral',   'EXA', 90, 'Filtros, dutos, motor e correia. Pó de espuma é combustível.')
) as m(nome, sigla, dias, descricao)
left join categorias_ativo c on c.sigla = m.sigla
on conflict (nome) do nothing;

insert into plano_template_itens (template_id, descricao, ordem, instrucao)
select t.id, i.descricao, i.ordem, i.instrucao
from (values
  -- Laminadora · Semanal
  ('Laminadora · Semanal', 1, 'Bloquear energia e esperar a lâmina parar por completo', 'Cadeado e etiqueta no seccionador (NR-10/NR-12).'),
  ('Laminadora · Semanal', 2, 'Conferir tensão da lâmina de fita', 'Valor do manual; usar tensiômetro se houver. Repetir a cada troca de lâmina.'),
  ('Laminadora · Semanal', 3, 'Conferir alinhamento da lâmina nas polias', 'A lâmina deve correr centrada, sem subir nem descer na borracha da polia.'),
  ('Laminadora · Semanal', 4, 'Inspecionar guias da lâmina (pastilhas/rolamentos)', 'Trocar se houver sulco, folga ou rolamento travando.'),
  ('Laminadora · Semanal', 5, 'Inspecionar pedras de afiar', 'Trocar se gastas ou vitrificadas (brilhantes). Conferir se encostam por igual.'),
  ('Laminadora · Semanal', 6, 'Limpar aspiração de pó e polias', 'Pó acumulado na polia faz a lâmina sair do trilho.'),
  ('Laminadora · Semanal', 7, 'Testar emergência e proteções', null),

  -- Laminadora · Mensal
  ('Laminadora · Mensal', 1, 'Lubrificar fuso, cremalheira e guias lineares da mesa/carro', 'Limpar o pó antes de lubrificar; graxa com pó vira lixa.'),
  ('Laminadora · Mensal', 2, 'Verificar correias do motor', 'Tensão, trincas e desgaste lateral. Trocar o jogo inteiro.'),
  ('Laminadora · Mensal', 3, 'Verificar revestimento de borracha das polias', 'Desgaste, rachadura ou descolamento.'),
  ('Laminadora · Mensal', 4, 'Medir corrente do motor em corte', 'Anotar no serviço e comparar com a placa e com o mês anterior.'),
  ('Laminadora · Mensal', 5, 'Ouvir rolamentos das polias', 'Ruído novo ou aquecimento → programar troca na próxima janela.'),

  -- Laminadora · Semestral
  ('Laminadora · Semestral', 1, 'Rolamentos das polias: folga, ruído e temperatura', 'Trocar preventivamente se houver qualquer sinal.'),
  ('Laminadora · Semestral', 2, 'Limpeza interna do quadro e do inversor', 'Aspirar o pó de espuma; limpar ventiladores e dissipador.'),
  ('Laminadora · Semestral', 3, 'Reaperto de bornes e conexões', null),
  ('Laminadora · Semestral', 4, 'Teste de isolação do motor (megômetro) e do freio', 'Anotar o valor para comparar no próximo semestre.'),
  ('Laminadora · Semestral', 5, 'Nivelamento e alinhamento geral da mesa', 'Espessura irregular da lâmina de espuma é o sintoma.'),

  -- Torno de Laminação · Semanal
  ('Torno de Laminação · Semanal', 1, 'Bloquear energia e esperar a lâmina parar por completo', null),
  ('Torno de Laminação · Semanal', 2, 'Conferir tensão e alinhamento da lâmina de fita', 'Valor do manual. Repetir a cada troca de lâmina.'),
  ('Torno de Laminação · Semanal', 3, 'Inspecionar guias da lâmina e pedras de afiar', 'Trocar o que estiver gasto ou vitrificado.'),
  ('Torno de Laminação · Semanal', 4, 'Limpar pó das polias, eixo e aspiração', null),
  ('Torno de Laminação · Semanal', 5, 'Testar emergência e proteções', null),

  -- Torno de Laminação · Mensal
  ('Torno de Laminação · Mensal', 1, 'Lubrificar mancais do eixo/mandril', null),
  ('Torno de Laminação · Mensal', 2, 'Lubrificar fuso de avanço do carro', 'Limpar o pó antes.'),
  ('Torno de Laminação · Mensal', 3, 'Conferir centragem do eixo', 'Excentricidade dá espessura irregular ao longo do rolo.'),
  ('Torno de Laminação · Mensal', 4, 'Verificar correias/correntes da transmissão', null),
  ('Torno de Laminação · Mensal', 5, 'Medir corrente dos motores (giro e lâmina)', 'Anotar e comparar.'),

  -- Torno de Laminação · Semestral
  ('Torno de Laminação · Semestral', 1, 'Rolamentos das polias e mancais: folga e ruído', null),
  ('Torno de Laminação · Semestral', 2, 'Redutor do giro: nível/troca de óleo e ruído', null),
  ('Torno de Laminação · Semestral', 3, 'Limpeza interna do quadro/inversor e reaperto', null),
  ('Torno de Laminação · Semestral', 4, 'Isolação dos motores (megômetro)', null),

  -- Bordadeira · Semanal
  ('Bordadeira · Semanal', 1, 'Limpar barra de agulhas, calcadores e área dos ganchos', 'Sopro + pincel. Fiapo compactado segura o óleo e trava o gancho.'),
  ('Bordadeira · Semanal', 2, 'Limpar sensores de quebra de linha', null),
  ('Bordadeira · Semanal', 3, 'Verificar correias dentadas', 'Tensão e desgaste. Devem estar SEM óleo.'),
  ('Bordadeira · Semanal', 4, 'Esvaziar bandeja de óleo e checar lubrificação automática', 'Conferir se todos os pontos estão recebendo óleo.'),
  ('Bordadeira · Semanal', 5, 'Checar vazamentos de ar e drenar filtro regulador', null),

  -- Bordadeira · Mensal
  ('Bordadeira · Mensal', 1, 'Engraxar guias lineares dos eixos X/Y', 'Graxa indicada no manual. Limpar a graxa velha com pó.'),
  ('Bordadeira · Mensal', 2, 'Lubrificar bielas, eixo principal e acionamento de calcador', 'Pontos e quantidade conforme o mapa de lubrificação do manual.'),
  ('Bordadeira · Mensal', 3, 'Rolos de alimentação/tração do tecido', 'Limpeza e desgaste. Escorregamento entorta o desenho.'),
  ('Bordadeira · Mensal', 4, 'Folga da barra de agulha e sincronismo agulha × gancho', 'Agulha quebrando em série é o sintoma de sincronismo fora.'),
  ('Bordadeira · Mensal', 5, 'Cilindros e válvulas pneumáticas', 'Vazamento, velocidade e fim de curso.'),

  -- Bordadeira · Semestral
  ('Bordadeira · Semestral', 1, 'Trocar ganchos/lançadeiras gastos', 'Ponta do gancho com marca ou rebarba → trocar.'),
  ('Bordadeira · Semestral', 2, 'Limpar servos, drivers e ventiladores do painel', 'Pó e fiapo derrubam drive por temperatura.'),
  ('Bordadeira · Semestral', 3, 'Reaperto elétrico do painel e dos conectores', null),
  ('Bordadeira · Semestral', 4, 'Backup dos desenhos e parâmetros', 'Pendrive + nuvem. Anexar no SGAI se possível.'),
  ('Bordadeira · Semestral', 5, 'Rolamentos e alinhamento geral', null),

  -- Fechamento · Mensal
  ('Fechamento · Mensal', 1, 'Lubrificar trilho, rodízios do carro e transmissão', null),
  ('Fechamento · Mensal', 2, 'Arrastador (puller), dente e calcador: desgaste e ajuste', null),
  ('Fechamento · Mensal', 3, 'Laçador/lançadeira e sincronismo', null),
  ('Fechamento · Mensal', 4, 'Cilindros e mangueiras da mesa basculante', 'Vazamento e velocidade de basculamento.'),
  ('Fechamento · Mensal', 5, 'Debruador/guia de fita: alinhamento e desgaste', null),

  -- Fechamento · Semestral
  ('Fechamento · Semestral', 1, 'Trocar pelo cabeçote reserva e levar o cabeçote para a bancada', 'Máximo 2 fechadeiras paradas por janela.'),
  ('Fechamento · Semestral', 2, 'Revisão completa do cabeçote em bancada', 'Limpeza, peças gastas, regulagem. Ele vira o novo cabeçote reserva.'),
  ('Fechamento · Semestral', 3, 'Motor/servo, embreagem e reaperto elétrico', null),

  -- Costura Industrial · Trimestral
  ('Costura Industrial · Trimestral', 1, 'Limpeza interna completa', 'Abrir tampas, tirar fiapo da lançadeira, dente e cárter.'),
  ('Costura Industrial · Trimestral', 2, 'Óleo do cárter: trocar se escuro ou com fiapo, limpar tela', null),
  ('Costura Industrial · Trimestral', 3, 'Lançadeira, dente e calcador: desgaste', null),
  ('Costura Industrial · Trimestral', 4, 'Regulagem de ponto e sincronismo', null),
  ('Costura Industrial · Trimestral', 5, 'Correia e motor (servo/embreagem)', null),

  -- Aglomerador · Mensal
  ('Aglomerador · Mensal', 1, 'Filtro hidráulico: indicador de saturação', 'Trocar se indicar.'),
  ('Aglomerador · Mensal', 2, 'Mangueiras e conexões hidráulicas', 'Ressecamento, abaulamento e vazamento.'),
  ('Aglomerador · Mensal', 3, 'Facas do moinho de aparas: afiação e folga', null),
  ('Aglomerador · Mensal', 4, 'Misturador: rolamentos e vedação', null),
  ('Aglomerador · Mensal', 5, 'Testar emergência e proteções', null),

  -- Aglomerador · Semestral
  ('Aglomerador · Semestral', 1, 'Óleo hidráulico: análise ou troca', 'Trocar no máximo a cada 12 meses.'),
  ('Aglomerador · Semestral', 2, 'Vedações dos cilindros', 'Cilindro descendo sozinho = vedação passando.'),
  ('Aglomerador · Semestral', 3, 'Válvula de alívio e calibração do manômetro', null),
  ('Aglomerador · Semestral', 4, 'Aquecimento/vapor: se houver gerador de vapor, conferir enquadramento NR-13', null),

  -- Tesoura Elétrica · Mensal
  ('Tesoura Elétrica · Mensal', 1, 'Escovas de carvão: medir e trocar antes do limite', 'Escova no fim arranha o coletor e queima o induzido.'),
  ('Tesoura Elétrica · Mensal', 2, 'Limpar motor por dentro (pó e fiapo)', null),
  ('Tesoura Elétrica · Mensal', 3, 'Afiação da lâmina e do afiador automático', null),
  ('Tesoura Elétrica · Mensal', 4, 'Lubrificação e cabo/plugue', null),

  -- Sublimação · Trimestral
  ('Sublimação · Trimestral', 1, 'Conferir temperatura real com termômetro', 'Comparar com o que o painel mostra.'),
  ('Sublimação · Trimestral', 2, 'Resistências e termopar/termostato', null),
  ('Sublimação · Trimestral', 3, 'Manta/feltro e teflon', 'Marcas e desgaste passam para o tecido.'),
  ('Sublimação · Trimestral', 4, 'Rolamentos e corrente da calandra', null),

  -- Climatizador · Mensal
  ('Climatizador · Mensal', 1, 'Lavar painel evaporativo (colmeia)', null),
  ('Climatizador · Mensal', 2, 'Lavar tanque e conferir boia', null),
  ('Climatizador · Mensal', 3, 'Bomba e distribuição de água', null),
  ('Climatizador · Mensal', 4, 'Motor e hélice', null),

  -- Aspiração de Pó · Trimestral
  ('Aspiração de Pó · Trimestral', 1, 'Filtros/mangas: limpar ou trocar', null),
  ('Aspiração de Pó · Trimestral', 2, 'Dutos: pó acumulado nas curvas', 'Pó de espuma é combustível.'),
  ('Aspiração de Pó · Trimestral', 3, 'Motor, rotor e correia', null),
  ('Aspiração de Pó · Trimestral', 4, 'Medir corrente do motor', null)
) as i(template_nome, ordem, descricao, instrucao)
join plano_templates t on t.nome = i.template_nome
where not exists (
  select 1 from plano_template_itens x where x.template_id = t.id
);

commit;
