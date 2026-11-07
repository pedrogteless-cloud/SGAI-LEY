# Plano de Manutenção Preventiva — Ley Colchões (Eusébio)

> **Objetivo:** nenhuma parada não planejada. Toda parada de máquina acontece
> porque nós escolhemos o dia e a hora, não porque ela escolheu por nós.

Documento montado a partir do cadastro de ativos do SGAI (consulta em
07/11/2026), de recomendações de fabricantes e de referências do setor
industrial brasileiro. As periodicidades são **ponto de partida**: valem até
que o manual do fabricante de cada máquina seja levantado (ele manda) ou que o
nosso próprio histórico no SGAI mostre que dá para espaçar ou que precisa
apertar.

---

## 1. Onde estamos hoje

### O que o SGAI mostra

| Indicador | Hoje |
| --- | --- |
| Ativos cadastrados (ativos no sistema) | 34, todos em Eusébio. Timon: nenhum |
| Ativos com fabricante/modelo/série | 0 |
| Horímetro preenchido | 0 (todos em 0,0) |
| Serviços corretivos registrados | 9 (R$ 2.700,00 lançados) |
| Serviços preventivos registrados | 1 (lubrificação, aberto em 02/09, ainda não executado) |
| Planos de preventiva ativos | 0 |
| Modelos de preventiva | 2 (compressor e quadro elétrico, para equipamentos que nem estão cadastrados) |

O histórico ainda é pequeno, e parte dele é teste, então não dá para calcular
tempo médio entre falhas. Mesmo assim ele já mostra o padrão: **o dinheiro
sai depois que quebra** (torneiro, rebobinar motor, peça recondicionada) e
nunca antes.

O caso da **Tesoura Elétrica 2** é o exemplo de livro: R$ 800 em agosto
(rebobinar motor + torneiro) e hoje ela está **baixada**. Motor de tesoura
elétrica costuma queimar por pó acumulado e escova de carvão gasta, e a
preventiva que evita isso é uma limpeza e uma troca de escova que custam uma
fração disso.

### Pontos cegos do cadastro (resolver antes de tudo)

1. **Não estão cadastrados os equipamentos que param a fábrica inteira de uma
   vez:** compressor de ar (alimenta a pneumática das bordadeiras, das mesas
   das fechadeiras e do tensionamento das laminadoras), quadro geral e quadros
   de máquina, subestação/entrada de energia, sistema de aspiração de pó de
   espuma, empilhadeira/paleteira, bombas e hidrantes de incêndio.
2. **Laminadora Vertical 2 e Tesoura Elétrica 2 estão baixadas.** A Vertical 1
   e a Tesoura 1 hoje rodam **sem reserva**, e a criticidade delas precisa
   subir.
3. **As 6 Máquinas de Fechamento estão como criticidade C.** Todo colchão passa
   por elas. Uma sozinha tem reserva (são 6), mas o grupo é gargalo. O correto
   é **B**.
4. **Categorias trocadas:** o Climatizador 2 está em "Máquina de Corte", a
   Bordadeira de Faixas está em "Máquina de Costura", e existem duas
   categorias para a mesma coisa ("Bordadeira de Tampo" e "Bordado de Tampos").
5. **Registros de teste** ("…TESTE", "…Teste2", "…Teste1") misturados com
   máquinas reais.
6. **Nenhuma máquina tem fabricante, modelo e série.** Sem isso não se acha
   manual, peça nem assistência técnica na hora da urgência.

---

## 2. Como as fábricas de colchão fazem (Brasil e fora)

O que aparece de forma consistente em estudos de caso de fábricas de colchão,
nos manuais dos fabricantes e na prática da indústria brasileira:

1. **A linha é em série: uma parada contamina tudo.** Estudo de caso numa
   fábrica de colchões em MG concluiu que todas as etapas são sequenciais e
   dependentes umas das outras, e a recomendação foi exatamente implantar a
   preventiva para dar segurança ao processo.
2. **Criticidade ABC antes de qualquer coisa.** Não se faz preventiva igual em
   tudo. Faz-se preventiva pesada no que para a linha e não tem reserva (A),
   preventiva leve no que tem reserva parcial (B), e no que tem reserva farta e
   é barato (C) deixa-se quebrar **de propósito**, com peça e máquina reserva na
   prateleira.
3. **Manutenção autônoma (pilar do TPM):** o operador limpa, lubrifica e olha a
   máquina 5–10 minutos no início do turno. Numa fábrica de colchão isso pesa
   ainda mais porque **o inimigo número um é pó de espuma e fiapo de tecido**:
   entope ventilação de motor e de inversor, cobre sensor de quebra de linha,
   gruda em guia lubrificada e vira lixa.
4. **Rota de lubrificação padronizada:** mapa de pontos por máquina, com o
   lubrificante certo e a frequência. Os fabricantes de cabeçotes multi-agulha
   (ZSK, Melco, Tajima) definem lubrificação por ponto: barra de agulha,
   calcador, biela, gancho. Alguns fazem isso por número de rotações ou horas,
   e não por calendário.
5. **Estoque mínimo de sobressalentes críticos:** lâmina de fita, pedra de
   afiar, gancho/lançadeira, agulha, correia dentada, rolamento das polias. A
   peça que falta é o que transforma uma parada de 30 minutos numa de 3 dias.
6. **Cabeçote reserva ("pool"):** para máquinas repetidas (fechadeiras,
   costura reta), mantém-se 1 cabeçote revisado na prateleira. Quebrou, troca
   em 15 minutos e o cabeçote quebrado vai para a bancada sem segurar a linha.
7. **Janela fixa de parada planejada:** um horário semanal reservado para
   manutenção, revezando as máquinas. Assim a produção planeja em volta dela.
8. **Inspeções baratas que pegam a falha antes:** termografia nos quadros
   (normalmente terceirizada, guiada pela NBR 15572/15763), medição de corrente
   dos motores e caça a vazamentos de ar comprimido.
9. **Indicadores mínimos:** % de horas de manutenção que foram planejadas,
   custo de manutenção sobre faturamento, MTBF/MTTR das máquinas A e aderência
   ao plano. Referências citadas da ABRAMAN colocam o custo de manutenção da
   indústria brasileira na faixa de **~4% do faturamento**, e apontam que cerca
   de um terço das empresas ainda trabalha só com corretiva.

### Por que a corretiva sai mais cara

A peça custa o mesmo nas duas. O que muda é todo o resto:

```
Custo de uma quebra = peça e serviço com urgência (frete expresso, técnico
                      "de plantão", torneiro no improviso)
                    + produção perdida (horas paradas × colchões/hora ×
                      margem de contribuição por colchão)
                    + mão de obra parada esperando
                    + hora extra para recuperar
                    + retrabalho/refugo (tampo bordado torto, espuma mal
                      laminada)
                    + dano em cadeia (rolamento que trava e leva o eixo; motor
                      que queima e leva o inversor)
```

**Sugestão para convencer a diretoria:** calcular uma vez o **custo da hora
parada** de cada máquina A (produção por hora × margem de contribuição + equipe
parada) e colocar o número no SGAI. Toda vez que alguém disser "não vou gastar
agora, ela está funcionando", a pergunta passa a ser: *quantas horas paradas
pagam esta preventiva?*

### Exigências legais que entram no plano

| Norma | O que pede | Onde se aplica aqui |
| --- | --- | --- |
| **NR-12** (máquinas) | Proteções, parada de emergência e dispositivos de segurança funcionando e inspecionados | Laminadoras, torno, prensa/aglomerador, tesouras |
| **NR-13** (vasos de pressão) | Prontuário, válvula de segurança, manômetro e inspeções periódicas pelo enquadramento do vaso | **Reservatório do compressor**, e caldeira/gerador de vapor se o aglomerador usar vapor |
| **NR-10** (eletricidade) | Instalações mantidas e documentadas | Quadros, subestação |
| **NR-11** (movimentação) | Inspeção dos equipamentos de transporte | Empilhadeira/paleteira |
| **Corpo de Bombeiros (AVCB)** | Hidrantes, bombas, alarme e extintores em dia | Fábrica de espuma e tecido = alta carga de incêndio |

---

## 3. Mapa de criticidade (prioridade)

Critério: **para a linha?** × **tem reserva?** × **quanto demora para
consertar/achar peça?** × **quanto custa?**

### Prioridade 1 — Criticidade A (para a linha e não tem reserva)

| Máquina (SGAI) | Por quê | Hoje no SGAI |
| --- | --- | --- |
| **Compressor de ar** *(não cadastrado)* | Para tudo que é pneumático ao mesmo tempo | — |
| **Quadro geral / entrada de energia** *(não cadastrado)* | Para a fábrica inteira | — |
| Laminadora Horizontal (EUS-COR-0010) | Toda espuma laminada passa aqui, unidade única | B → **A** |
| Laminadora Vertical 1 (EUS-COR-0011) | A Vertical 2 está baixada, então ficou sem reserva | B → **A** |
| Torno de Laminação (EUS-COR-0002) | Unidade única | B → **A** |
| Bordadeira de Tampo HC3200 (EUS-MAT-0001) | Todo tampo passa por bordadeira, peça importada demora | A |
| Bordadeira de Tampo Mutinga (EUS-MAT-0009) | Idem, é a única redundância da HC3200 | B → **A** |
| Bordadeira de Faixas (EUS-COS-0012) | Unidade única, toda faixa bordada passa aqui | B → **A** |

### Prioridade 2 — Criticidade B (reserva parcial ou gargalo em grupo)

| Máquina | Por quê | Hoje |
| --- | --- | --- |
| Máquinas de Fechamento 1–6 | Todo colchão fecha aqui. Reserva existe, mas a capacidade cai 1/6 a cada uma parada | C → **B** |
| Aglomerador (EUS-PRE-0030) | Fora da linha principal (há estoque de aparas como pulmão), mas hidráulico/caro | B |
| Máquina de Passagem de Faixa 1 | Unidade única | B |
| Máquina de Costura Fitilho 1 | Unidade única | B |
| Máquina de Costura Overlock 1 | Unidade única | B |
| Tesoura Elétrica 1 | A Tesoura 2 está baixada, e é barata de ter uma reserva | B |
| Sistema de aspiração de pó *(não cadastrado)* | Pó de espuma acumulado = risco de incêndio e de falha de motor | — |
| Máquina de Sublimação 1 | Unidade única, mas o processo tem alternativa/pulmão | B |

### Prioridade 3 — Criticidade C (reserva farta, conserto barato)

| Máquina | Estratégia |
| --- | --- |
| Máquinas de Costura 1–12 | Limpeza/óleo diário pelo operador, revisão trimestral, **1 máquina reserva revisada** e kit de peças. Quebrou, troca e conserta fora da linha. |
| Climatizadores 1 e 2 | Limpeza mensal. Conforto térmico, não para produção. |

---

## 4. O plano por tipo de máquina

Legenda: **[OP]** feito pelo operador (manutenção autônoma, sem gerar serviço
no SGAI) · **[TEC]** feito pelo técnico (gera serviço preventivo no SGAI a
partir do modelo).

> **Antes de qualquer item:** máquina desligada, energia bloqueada e
> sinalizada (NR-10/NR-12). Lâmina de fita parada por completo antes de
> encostar.

### 4.1 Laminadoras (Horizontal, Vertical 1) — Prioridade 1

Máquina de corte por **lâmina de fita** (band knife) com afiação contínua por
pedras/rebolos.

| Frequência | Quem | Tarefa |
| --- | --- | --- |
| Início de turno | OP | Soprar/aspirar pó de espuma das polias, guias e trilho da mesa |
| Início de turno | OP | Conferir se as pedras de afiar estão encostando e a aspiração funcionando |
| Início de turno | OP | Testar botão de emergência e proteções |
| Durante | OP | Avisar pelo QR quando o corte começar a "ondular", rasgar ou deixar rebarba (é sinal de lâmina cega, tensão errada ou guia gasta) |
| Semanal | TEC | Tensão da lâmina conforme manual (com tensiômetro se houver), **e a cada troca de lâmina** |
| Semanal | TEC | Alinhamento da lâmina nas polias e desgaste das guias (pastilhas/rolamentos) |
| Semanal | TEC | Estado da pedra de afiar: trocar se estiver gasta ou vitrificada |
| Mensal | TEC | Lubrificar fuso/cremalheira/guias lineares da mesa e do carro |
| Mensal | TEC | Correias do motor: tensão e trinca |
| Mensal | TEC | Revestimento das polias (borracha): desgaste e descolamento |
| Mensal | TEC | Medir corrente do motor e comparar com a placa |
| Semestral | TEC | Rolamentos das polias: ruído, folga e temperatura; trocar se preciso |
| Semestral | TEC | Limpeza interna do quadro e do inversor (pó!), reaperto de bornes |
| Semestral | TEC | Isolação do motor (megômetro), freio do motor |
| Semestral | TEC | Nivelamento e alinhamento geral da mesa |

**Sobressalentes na prateleira:** 2–3 lâminas de fita, 1 jogo de pedras de
afiar, guias da lâmina, correias, 1 jogo de rolamentos das polias.

### 4.2 Torno de Laminação de Cilindros — Prioridade 1

Mesmo princípio da laminadora (lâmina de fita), com o bloco girando num eixo.
Vale tudo do item 4.1, **mais**:

| Frequência | Quem | Tarefa |
| --- | --- | --- |
| Mensal | TEC | Lubrificar mancais do eixo/mandril e fuso de avanço do carro |
| Mensal | TEC | Conferir a centragem do eixo (excentricidade dá espessura irregular) |
| Semestral | TEC | Redutor do giro: nível/troca de óleo, ruído |

### 4.3 Bordadeiras de Tampo e Bordadeira de Faixas — Prioridade 1

Multi-agulhas: é a máquina mais complexa e cara da fábrica, e a que mais
sofre com fiapo.

| Frequência | Quem | Tarefa |
| --- | --- | --- |
| Início de turno | OP | Soprar fiapo das lançadeiras/ganchos e da área das caixas de bobina |
| Início de turno | OP | Lubrificar ganchos conforme o manual (normalmente uma gota por gancho a cada turno) |
| Início de turno | OP | Conferir o nível do reservatório de lubrificação automática |
| Início de turno | OP | Trocar agulha torta/rombuda e drenar a água do filtro de ar |
| Semanal | TEC | Limpar barra de agulhas, calcadores e sensores de quebra de linha |
| Semanal | TEC | Correias dentadas: tensão, e garantir que estão **sem óleo** |
| Semanal | TEC | Esvaziar a bandeja de óleo e checar vazamentos pneumáticos |
| Mensal | TEC | Engraxar guias lineares dos eixos X/Y e lubrificar bielas/eixo principal |
| Mensal | TEC | Rolos de alimentação/tração do tecido: limpeza e desgaste |
| Mensal | TEC | Folga da barra de agulha e sincronismo agulha × gancho |
| Mensal | TEC | Cilindros e válvulas pneumáticas |
| Semestral | TEC | Trocar ganchos/lançadeiras gastos (não esperar quebrar agulha em série) |
| Semestral | TEC | Limpeza dos servos, drivers e ventiladores do painel. Reaperto elétrico |
| Semestral | TEC | **Backup dos desenhos e parâmetros da máquina** (pendrive + nuvem) |
| Semestral | TEC | Rolamentos e alinhamento geral |

**Sobressalentes:** agulhas (caixa), ~10% dos ganchos/lançadeiras, caixas de
bobina, molas de tensão, correias dentadas, 1 sensor de linha, fusíveis.
**Ter contato de assistência técnica do fabricante já negociado.**

### 4.4 Máquinas de Fechamento 1–6 (tape edge) — Prioridade 2

| Frequência | Quem | Tarefa |
| --- | --- | --- |
| Início de turno | OP | Soprar fiapo do cabeçote, conferir óleo, trocar agulha se precisar |
| Início de turno | OP | Debruador/guia de fita alinhado; drenar filtro de ar da mesa basculante |
| Mensal | TEC | Lubrificar trilho/rodízios do carro do cabeçote, corrente/correia de tração |
| Mensal | TEC | Arrastador (puller), dente e calcador: desgaste e ajuste |
| Mensal | TEC | Laçador/lançadeira e sincronismo |
| Mensal | TEC | Cilindros e mangueiras da mesa basculante, vazamentos |
| Semestral | TEC | Revisão completa do cabeçote em bancada (com o cabeçote reserva no lugar) |
| Semestral | TEC | Motor/servo e embreagem, reaperto elétrico |

**Estratégia de custo:** **1 cabeçote reserva revisado para as 6 máquinas.**
A revisão semestral de cada uma vira uma troca de cabeçote de 15 minutos, sem
segurar a linha. Programar no máximo 2 fechadeiras paradas por janela.

### 4.5 Costura (reta 1–12, Overlock, Fitilho, Passagem de Faixa)

| Frequência | Quem | Tarefa |
| --- | --- | --- |
| Diário | OP | Soprar fiapo da lançadeira/dente, olhar o visor de óleo, agulha |
| Trimestral | TEC | Limpeza interna, regulagem de ponto, sincronismo, tensão de correia e motor |
| Trimestral | TEC | Troca de óleo do cárter (se escuro ou com fiapo) e limpeza do filtro/tela |
| Trimestral | TEC | Desgaste de lançadeira, dente e calcador |

Fitilho, Overlock e Passagem de Faixa são unidades únicas (Prioridade 2). Se o
setor disser que elas não aguentam 3 meses, passar para mensal. As 12 retas
ficam em **C: deixar quebrar com reserva na prateleira**.

### 4.6 Aglomerador — Prioridade 2

| Frequência | Quem | Tarefa |
| --- | --- | --- |
| Diário | OP | Vazamentos de óleo hidráulico, nível do tanque, limpar cola/espuma do molde |
| Mensal | TEC | Filtro hidráulico (indicador de saturação), mangueiras e conexões |
| Mensal | TEC | Facas do moinho/triturador de aparas: afiação e folga |
| Mensal | TEC | Misturador: rolamentos e vedação |
| Semestral | TEC | Análise ou troca do óleo hidráulico (troca no máximo anual), vedações dos cilindros |
| Semestral | TEC | Válvula de alívio e manômetro (calibração) |
| Semestral | TEC | Temperatura/vapor: se o processo usa vapor, **caldeira/gerador entra na NR-13** e precisa ser cadastrado |

### 4.7 Tesoura Elétrica 1 — Prioridade 2

| Frequência | Quem | Tarefa |
| --- | --- | --- |
| Diário | OP | Soprar pó do motor, conferir cabo e plugue |
| Mensal | TEC | Escovas de carvão (trocar antes de chegar ao limite), coletor, lubrificação |
| Mensal | TEC | Afiação da lâmina e do afiador automático |

Foi exatamente a falta disso que levou a Tesoura 2 a rebobinar e depois ser
baixada. **Comprar uma tesoura reserva** custa menos que uma parada do corte.

### 4.8 Sublimação, Climatizadores

- **Sublimação (trimestral):** resistência, termopar/termostato (conferir com
  termômetro), manta/feltro e teflon, rolamentos e corrente da calandra.
- **Climatizadores (mensal):** lavar painel evaporativo, tanque, boia e bomba.
  Água parada vira lodo.

### 4.9 Utilidades (cadastrar já)

- **Compressor:** diário [OP] drenar condensado e conferir nível de óleo e
  pressão. O modelo trimestral já existe no SGAI. Referência de mercado para
  parafuso: filtro de ar a cada 1.000–2.000 h, óleo mineral a cada
  2.000–4.000 h e separador a cada 2.000–8.000 h (**o manual do modelo
  manda**). **Reservatório: prontuário NR-13, válvula de segurança e
  manômetro.** Semestral: ronda de vazamentos com a fábrica parada (o ruído
  denuncia).
- **Quadros elétricos:** o modelo semestral já existe. **Termografia anual
  terceirizada** em todos os quadros das máquinas A. Limpeza do pó de espuma
  é obrigatória aqui.
- **Aspiração/exaustão de pó:** trimestral: filtros/mangas, dutos, motor e
  correia. Pó de espuma acumulado é combustível.
- **Incêndio:** bombas, hidrantes e alarme conforme o AVCB.

---

## 5. Calendário de paradas planejadas

**Regra:** uma **janela fixa semanal** (sugestão: as 2 últimas horas de sexta
ou o sábado de manhã, o que custar menos produção), revezando os grupos. A
produção já sabe com antecedência e adianta estoque intermediário (tampos
bordados, espuma laminada) na semana da parada.

| Semana do mês | Janela de manutenção | Quem para |
| --- | --- | --- |
| 1ª | Corte de espuma | Laminadora Horizontal, Vertical 1, Torno (mensais) |
| 2ª | Bordado | Bordadeiras de Tampo e Faixas (mensais) |
| 3ª | Fechamento e costura | 2 fechadeiras por vez + costuras do trimestre |
| 4ª | Utilidades e apoio | Aglomerador, tesoura, compressor, quadros, aspiração, climatizadores |

As **semanais das máquinas A** (laminadoras e bordadeiras) entram toda semana
na janela, e são rápidas (30–45 min). As **semestrais** caem em duas janelas
grandes por ano (ex.: recesso de julho e de dezembro/janeiro), quando dá para
abrir a máquina com calma.

---

## 6. Implantação: 90 dias

### Semanas 1–2: arrumar a casa (custo quase zero)
- [ ] Apagar/baixar os registros de teste e corrigir as categorias (seção 1).
- [ ] Subir a criticidade conforme a seção 3.
- [ ] Cadastrar compressor, quadros, aspiração, empilhadeira e incêndio.
- [ ] Fotografar a **plaqueta** de cada máquina e preencher fabricante,
      modelo, série e ano. Juntar os **manuais** (PDF no SGAI, tipo "manual").
- [ ] Calcular o **custo da hora parada** das máquinas A.
- [ ] Cadastrar as máquinas de **Timon**.

### Semanas 2–4: operador cuidando
- [ ] Cartão plastificado de manutenção autônoma em cada máquina, ao lado do
      QR (itens "OP" da seção 4). 5–10 min no início do turno.
- [ ] Treinar operador: **ouviu barulho diferente, avisa pelo QR na hora**
      (já funciona por áudio). Aviso cedo é preventiva de graça.
- [ ] Comprar o **estoque mínimo de sobressalentes** das máquinas A.

### Mês 2: preventiva rodando nas máquinas A
- [ ] Aplicar no SGAI os modelos de preventiva às máquinas A (tela
      Preventiva → aplicar modelo).
- [ ] Fazer uma **"revisão zero"** em cada máquina A: devolver a máquina à
      condição original antes de começar o ciclo, senão a preventiva só
      administra o desgaste acumulado.
- [ ] Contratar a **termografia** dos quadros e regularizar a **NR-13** do
      compressor.
- [ ] Começar a janela semanal.

### Mês 3: estender e medir
- [ ] Aplicar os modelos às máquinas B. Cabeçote reserva das fechadeiras.
- [ ] Máquina de costura reserva revisada.
- [ ] Começar a acompanhar os indicadores (seção 7) mensalmente.

### Mês 6: revisar o plano com dados
- [ ] Com 6 meses de histórico no SGAI, ajustar periodicidades: o que nunca
      apresenta desgaste espaça, e o que quebrou entre preventivas aperta.
- [ ] Preencher o horímetro nas máquinas A e migrar os planos delas para
      **base horímetro** (o SGAI já suporta), que é mais justo que o calendário.

---

## 7. Indicadores para acompanhar

| Indicador | Meta inicial | Meta 12 meses |
| --- | --- | --- |
| Paradas não planejadas nas máquinas A | medir | **zero** como alvo; tolerância de 1/mês |
| % de serviços preventivos sobre o total | > 30% | > 70% |
| Aderência ao plano (preventivas feitas no prazo) | > 80% | > 95% |
| Custo de corretiva por mês (R$) | medir | queda contínua |
| Custo total de manutenção / faturamento | medir | perto de ~4% (referência ABRAMAN citada) |
| MTBF das máquinas A | medir | subindo |

O SGAI já entrega custo por máquina, RAV% e preventivas vencendo. O que faltava
era **lançar as preventivas**, e os modelos que acompanham este documento
resolvem isso.

---

## 8. Modelos prontos para o SGAI

O arquivo [`templates-preventiva.sql`](./templates-preventiva.sql) cria **18
modelos de preventiva** (com os itens de checklist e instruções da seção 4)
para os tipos de máquina acima. Depois de aplicado, basta ir em **Preventiva →
aplicar modelo → escolher a máquina**, e o SGAI passa a gerar o serviço, avisar
quando estiver chegando a hora e mostrar o que está atrasado.

| Modelo | Período |
| --- | --- |
| Laminadora · Semanal / Mensal / Semestral | 7 / 30 / 180 dias |
| Torno de Laminação · Semanal / Mensal / Semestral | 7 / 30 / 180 dias |
| Bordadeira · Semanal / Mensal / Semestral | 7 / 30 / 180 dias |
| Fechamento · Mensal / Semestral | 30 / 180 dias |
| Costura Industrial · Trimestral | 90 dias |
| Aglomerador · Mensal / Semestral | 30 / 180 dias |
| Tesoura Elétrica · Mensal | 30 dias |
| Sublimação · Trimestral | 90 dias |
| Climatizador · Mensal | 30 dias |
| Aspiração de Pó · Trimestral | 90 dias |

Os itens "OP" (diários, do operador) **não** viram serviço no SGAI de
propósito: 34 máquinas × 1 serviço por dia afogaria a tela. Eles ficam no
cartão da máquina.

---

## Fontes

- Estudo de caso de gestão da manutenção numa fábrica de colchões (IFMG Bambuí):
  <https://bambui.ifmg.edu.br/jornada_cientifica/2014/resumos/Eng/Aplicação dos princípios de gestão da manutenção em uma fábr.pdf>
- Sistemas hidráulicos e pneumáticos numa fábrica de colchões (IFMG Bambuí):
  <https://bambui.ifmg.edu.br/jornada_cientifica/2014/resumos/Eng/Descrição de sistemas hidráulicos e pneumáticos em uma fábri.pdf>
- Índices da manutenção / referências ABRAMAN (IFSC): <https://wiki.ifsc.edu.br/images/d/de/%C3%8Dndices_da_Manuten%C3%A7%C3%A3o_-_5.pdf>
- Custos de manutenção (Tractian): <https://tractian.com/blog/custos-de-manutencao>
- Manual de manutenção de cabeçote multi-agulha ZSK: <https://www.zsk.de/pdf/download/manual-anwendung/05-wartung/gb/00931v10-maintenance__k_head-19-03-2008.pdf>
- Lubrificação de barra de agulha e calcador (Melco): <https://www.melco-service.com/docs/AMAYA_Tech_Manual_Web/General_Information_and_Specifications/Lubrication/Needle_Drive_-_Presser_Foot_Lubrication.htm>
- Preventiva em equipamentos de serra de fita (The Fabricator): <https://www.thefabricator.com/article/sawing/preventive-maintenance-on-sawing-equipment>
- Erros comuns de manutenção em lâminas de fita (DoALL): <https://www.doallsaws.com/news-offers/post/20-common-maintenance-mistakes-with-band-saw-blades>
- Intervalos de manutenção de compressor parafuso (Fabrico): <https://www.fabrico.io/es/blog/screw-compressor-maintenance/>
- Óleo de compressor parafuso (Atlas Copco): <https://www.atlascopco.com/pt-br/compressors/air-compressor-blog/screw-compressor-oil>
- NR-13 perguntas e respostas, incluindo compressores (MTE, 2023): <https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/perguntas-e-respostas-nr13_2023_04_28.pdf>
- Inspeção de vasos de pressão (Produttivo): <https://www.produttivo.com.br/blog/inspecao-de-vasos-de-pressao>
- NBR 15763, periodicidade de termografia: <https://www.target.com.br/produtos/normas-tecnicas/41278/nbr15763-ensaios-nao-destrutivos-termografia-criterios-de-definicao-de-periodicidade-de-inspecao-em-sistemas-eletricos-de-potencia>
- Cartilha de inspeção termográfica (Sompo): <https://sompo.com.br/documents/d/global/som01624_cartilha-inspecao-termografica_c-1-1>

> Observação honesta sobre as fontes: não há manual público de manutenção
> específico para laminadora de espuma, fechadeira (tape edge) ou aglomerador.
> As tarefas dessas máquinas foram montadas por analogia com equipamentos do
> mesmo princípio (serra de fita, cabeçote de costura industrial, prensa
> hidráulica) e com a prática comum do setor. **O manual do fabricante de cada
> máquina, quando levantado, prevalece sobre este documento.**
