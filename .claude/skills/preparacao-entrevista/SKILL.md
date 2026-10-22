---
name: preparacao-entrevista
description: Monta um roteiro de preparação para uma entrevista de uma candidatura do JobPilot, usando a vaga, as etapas já registradas e o currículo ativo da pessoa. Use quando a pessoa pedir para se preparar para uma entrevista, ensaiar perguntas ou saber o que estudar antes de falar com uma empresa. Exige o servidor MCP do JobPilot conectado.
---

# Preparação de entrevista

Monta um roteiro de preparação para uma entrevista, a partir dos **dados reais** da pessoa no JobPilot: a vaga, as etapas já feitas (com as anotações) e o currículo ativo. Esta skill só **lê** dados.

## Antes de começar

Ela usa as ferramentas do servidor MCP `jobpilot` (no Claude Code aparecem como `mcp__jobpilot__<nome>`): `listar_candidaturas`, `detalhar_candidatura` e `obter_curriculo_ativo`.

Se essas ferramentas não estiverem disponíveis, **pare** e explique que o servidor MCP do JobPilot não está conectado. Aponte a seção "Usando o servidor MCP no Claude" do README do projeto. Não tente montar o roteiro de memória.

## Passo 1: descubra qual candidatura

- Se a pessoa citou a empresa ou a vaga, use `listar_candidaturas` e procure pelo nome.
- Se não citou, use `listar_candidaturas` com o status ENTREVISTA.
  - Uma só: use-a e diga qual escolheu, para a pessoa corrigir se estiver errado.
  - Várias: liste (vaga e empresa) e pergunte qual.
  - Nenhuma: tente o status APLICADO e avise que nenhuma está em ENTREVISTA.
- Se mais de uma candidatura combinar com o nome, pergunte qual é.

## Passo 2: reúna os dados

1. `detalhar_candidatura` com o id: traz a vaga completa (descrição, modalidade, senioridade) e as etapas com data e anotações.
2. `obter_curriculo_ativo`: o texto do currículo. Se a pessoa não tiver currículo ativo, **pare** e peça para cadastrá-lo na tela Currículo do JobPilot; sem ele o roteiro seria genérico.

Não invente o que faltar. Se a descrição da vaga estiver vazia ou tiver só uma ou duas linhas, avise que o roteiro será mais genérico e sugira colar o anúncio da vaga na conversa.

## Passo 3: entenda o momento da entrevista

Olhe as etapas da candidatura. A **próxima etapa** (a de data futura mais próxima) define o foco:

| Tipo da etapa          | Foco do roteiro                                                              |
| ---------------------- | ---------------------------------------------------------------------------- |
| TRIAGEM, ENTREVISTA_RH | Motivação, trajetória, comportamento, pretensão e expectativas               |
| ENTREVISTA_TECNICA     | Conceitos da stack da vaga, decisões técnicas, exemplos de código e projetos |
| TESTE_TECNICO          | Como se preparar para um desafio: o que revisar, como organizar o tempo      |
| PROPOSTA               | Negociação: prioridades, faixa, benefícios, perguntas antes de aceitar       |

Se não houver etapa futura registrada, pergunte qual é a entrevista. Se a pessoa não souber, assuma uma entrevista de RH com algumas perguntas técnicas e **diga que assumiu isso**.

Use as anotações das etapas anteriores: nomes de pessoas, temas já tratados e combinados. O roteiro deve dar continuidade, sem repetir o que já foi coberto.

## Passo 4: monte o roteiro

Use estes títulos, nesta ordem:

1. **Resumo da vaga**: 3 a 4 linhas com o que a empresa procura.
2. **Vaga × seu currículo**: uma tabela com as colunas "O que a vaga pede", "Onde aparece no seu currículo" e "Situação" (Forte, Parcial ou Lacuna).
3. **Perguntas prováveis**: de 8 a 10, conforme o foco do passo 3. Cada uma com um "Como responder": qual experiência do currículo usar e em que estrutura (situação, ação e resultado).
4. **Pontos do currículo para destacar**: de 3 a 5, os que mais conversam com a vaga.
5. **Lacunas e como abordá-las**: o que a vaga pede e o currículo não mostra, com uma forma honesta de falar disso.
6. **O que estudar antes**: no máximo 6 itens, em ordem de prioridade, cada um com o motivo.
7. **Perguntas para fazer à empresa**: 4 perguntas que mostrem interesse real.
8. **Checklist do dia**: data e hora da entrevista (no formato brasileiro, se estiver registrada), link ou local, ambiente, o que ter à mão.

## Regras

- **Nunca invente** experiência, projeto, cargo ou número que não esteja no currículo. Se precisar de um exemplo hipotético, marque como "[exemplo: troque pela sua experiência real]".
- Separe o que vem dos dados (vaga, currículo, anotações) do que é suposição sua, e diga qual é qual.
- Seja específico: cite tecnologias, trechos da vaga e trechos do currículo. Evite conselhos genéricos de entrevista.
- Ajuste a profundidade à senioridade da vaga.
- Esta skill **não altera nada** no JobPilot. Não use `mover_candidatura`. Se a pessoa pedir depois para mudar o status, confirme qual candidatura e para qual status antes de mover.

## Ao terminar

Ofereça os próximos passos: simular a entrevista com uma pergunta por vez e dar feedback nas respostas, aprofundar um tema da lista de estudo ou revisar as respostas que a pessoa escrever.
