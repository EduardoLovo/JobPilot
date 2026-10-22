---
name: ajuste-curriculo
description: Compara o currículo ativo da pessoa com uma vaga do JobPilot e sugere reescritas de trechos para essa vaga, mostrando o antes e o depois, sem inventar nenhuma experiência. Use quando a pessoa pedir para ajustar, adaptar ou melhorar o currículo para uma vaga, ou quiser saber quais palavras-chave da vaga faltam no currículo. Exige o servidor MCP do JobPilot conectado.
---

# Ajuste de currículo

Compara o currículo ativo com uma vaga e **sugere** reescritas para ela. Esta skill só sugere: **não salva nada**. A pessoa copia o que quiser e cola na tela Currículo do JobPilot.

## A regra que vale mais que todas

O currículo representa a pessoa. **Nunca invente** habilidade, ferramenta, cargo, empresa, projeto, resultado ou número que o currículo não mostre.

Pode:

- reordenar e dar destaque ao que a pessoa já tem;
- usar o vocabulário da vaga para algo que a pessoa **de fato fez** (por exemplo, "criei telas" virar "desenvolvi interfaces em Vue", se o currículo diz que usou Vue);
- deixar uma frase mais clara, direta e com verbos de ação;
- apontar onde um número ajudaria e **pedir o dado** à pessoa.

Não pode:

- acrescentar uma tecnologia só porque a vaga pede;
- aumentar o tempo de experiência ou a senioridade;
- transformar um uso básico em domínio.

Se a vaga pede algo que o currículo não mostra, isso é uma **lacuna**. Diga que é uma lacuna e **pergunte** se a pessoa tem essa experiência. Só incorpore ao texto depois que ela confirmar, e com as palavras dela.

## Antes de começar

Ela usa as ferramentas do servidor MCP `jobpilot` (no Claude Code aparecem como `mcp__jobpilot__<nome>`): `listar_candidaturas`, `detalhar_candidatura` e `obter_curriculo_ativo`.

Se essas ferramentas não estiverem disponíveis, **pare** e explique que o servidor MCP do JobPilot não está conectado. Aponte a seção "Usando o servidor MCP no Claude" do README do projeto.

## Passo 1: descubra para qual vaga ajustar

- Se a pessoa citou a empresa ou a vaga, use `listar_candidaturas` e procure pelo nome.
- Se não citou, use `listar_candidaturas` com os status INTERESSE e APLICADO. Quem quer ajustar o currículo costuma ainda não ter se candidatado, mas pode estar refazendo o texto para outro processo. Liste (vaga e empresa) e pergunte qual.
- Se mais de uma candidatura combinar com o nome, pergunte qual é.

## Passo 2: reúna os dados

1. `detalhar_candidatura` com o id: a vaga completa (descrição, modalidade, senioridade).
2. `obter_curriculo_ativo`: o texto do currículo. Se a pessoa não tiver currículo ativo, **pare** e peça para cadastrá-lo na tela Currículo do JobPilot.

Se a descrição da vaga estiver vazia ou tiver só uma ou duas linhas, avise que o ajuste será limitado e sugira colar o anúncio da vaga na conversa.

## Passo 3: levante o que a vaga pede

Da descrição, extraia: tecnologias e ferramentas, responsabilidades, nível de senioridade e experiência pedida, habilidades de convivência e diferenciais. Separe o que é **obrigatório** do que é **diferencial** quando a vaga deixar isso claro; quando não deixar, diga que a separação é sua leitura.

## Passo 4: compare com o currículo

Monte uma tabela com as colunas "O que a vaga pede", "No seu currículo" e "Trecho do currículo". Em "No seu currículo", use uma destas situações:

- **Aparece**: está lá, com as mesmas palavras.
- **Aparece com outras palavras**: a pessoa fez, mas descreve de outro jeito. É a **melhor oportunidade** de reescrita.
- **Não aparece**: lacuna.

Em "Trecho do currículo", cite o trecho real, curto, entre aspas. Em lacunas, deixe em branco.

## Passo 5: sugira reescritas

Faça no máximo 6 sugestões, priorizando o impacto nos requisitos obrigatórios. Para cada uma, use este formato:

- **Trecho atual:** copie exatamente como está no currículo.
- **Sugestão:** o texto novo.
- **Por quê:** qual requisito da vaga ele atende e que informação do currículo o sustenta.

Se fizer sentido, sugira também a ordem das seções (por exemplo, subir a experiência mais parecida com a vaga) e um resumo de 2 a 3 linhas no topo, escrito só com fatos que já estão no currículo.

## Passo 6: lacunas e perguntas

Liste as lacunas, dizendo se cada uma é obrigatória ou diferencial. Para cada uma, pergunte se a pessoa tem essa experiência de verdade. **Não** sugira "adicionar" a habilidade: espere a resposta.

## Ao terminar

Ofereça: a versão completa do currículo com **só** as sugestões que a pessoa aprovar, para copiar; ajustar para outra vaga; ou revisar o tamanho e a clareza do texto.

Lembre que a skill não salva. Para usar o texto novo, a pessoa cola na tela Currículo do JobPilot e marca "Usar como currículo ativo". O currículo anterior fica guardado como outra versão.

## Regras

- Cite sempre trechos reais do currículo e da vaga. Evite conselhos genéricos de currículo.
- Separe o que vem dos dados (vaga e currículo) do que é leitura ou suposição sua, e diga qual é qual.
- Mantenha o idioma e o formato simples do currículo original.
- Esta skill **não altera nada** no JobPilot. Não use `mover_candidatura`.
