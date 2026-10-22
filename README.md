# JobPilot

Gerenciador de candidaturas a vagas com IA: kanban de candidaturas, análise de compatibilidade currículo × vaga, lembretes automáticos de follow-up e integração com o Claude via MCP.

O planejamento completo está em [docs/JobPilot-planejamento.md](docs/JobPilot-planejamento.md), e o backlog em [docs/JobPilot-backlog.csv](docs/JobPilot-backlog.csv).

## Stack

| Parte          | Tecnologia                               |
| -------------- | ---------------------------------------- |
| Front-end      | Vue 3, Vite, Pinia, Vue Router           |
| API            | Node.js, Express, TypeScript             |
| Banco de dados | PostgreSQL (Docker)                      |
| Automações     | n8n (Docker)                             |
| IA             | Servidor MCP, agentes e skills do Claude |
| Testes         | Vitest, Supertest, Vue Test Utils        |
| Qualidade      | ESLint, Prettier, GitHub Actions         |

## Estrutura

```
apps/
  web/    front-end Vue
  api/    API REST
  mcp/    servidor MCP para o Claude
n8n/
  workflows/   workflows exportados do n8n
docs/          planejamento e backlog
```

## Como rodar

Pré-requisitos: Node.js 20+, Docker Desktop e Git.

```bash
npm install
cp .env.example .env
npm run db:up      # sobe PostgreSQL e n8n
npm run db:migrate -w apps/api   # cria as tabelas e gera o cliente Prisma
npm run dev:api    # http://localhost:3333/health
npm run dev:web    # http://localhost:5173
```

O n8n fica em http://localhost:5678.

## Scripts

| Comando                    | O que faz                                                           |
| -------------------------- | ------------------------------------------------------------------- |
| `npm test`                 | Testes rápidos de todos os apps, sem banco                          |
| `npm run test:integration` | Testes da API com Prisma e Postgres de verdade (precisa do `db:up`) |
| `npm run lint`             | ESLint em todo o monorepo                                           |
| `npm run format`           | Formata o código com Prettier                                       |
| `npm run build`            | Gera o build de todos os apps                                       |
| `npm run db:up`/`down`     | Sobe ou derruba os containers                                       |
| `npm run dev:mcp`          | Roda o servidor MCP via stdio                                       |

## Testes

- **Rápidos (`npm test`):** a API roda com repositórios em memória e o front com `fetch` simulado. Levam poucos segundos e não precisam de Docker.
- **Integração (`npm run test:integration`):** a API de verdade com Prisma e Postgres. Cobrem as regras que vivem no banco (e-mail único, cascatas, chaves estrangeiras, busca sem diferenciar maiúsculas). Rodam no banco `jobpilot_test`, que é criado e migrado sozinho, e a cada teste as tabelas são esvaziadas. Por segurança, os testes se recusam a rodar em um banco cujo nome não termine com `_test`, então os seus dados de desenvolvimento nunca são tocados.
- O CI roda os dois tipos em todo PR, com um Postgres no próprio workflow.

## API

Todas as requisições abaixo estão prontas em [apps/api/requests.http](apps/api/requests.http), para usar com a extensão [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) do VS Code. O login guarda o token automaticamente para as outras requisições.

### Autenticação

O access token vale 15 minutos e vai no header `Authorization: Bearer <token>`. O refresh token vale 7 dias e serve só para pedir um novo par de tokens.

| Método | Rota             | Corpo                    | Resposta                                  |
| ------ | ---------------- | ------------------------ | ----------------------------------------- |
| POST   | `/auth/register` | `{ nome, email, senha }` | `201` usuário + tokens                    |
| POST   | `/auth/login`    | `{ email, senha }`       | `200` usuário + tokens                    |
| POST   | `/auth/refresh`  | `{ refreshToken }`       | `200` novo `accessToken` e `refreshToken` |
| GET    | `/auth/me`       | —                        | `200` usuário logado                      |

### Empresas e vagas

Todas as rotas exigem o access token.

| Método | Rota            | Observação                                                                    |
| ------ | --------------- | ----------------------------------------------------------------------------- |
| GET    | `/empresas`     | Ordem alfabética; filtro `?busca=`                                            |
| POST   | `/empresas`     | `{ nome, site? }`                                                             |
| GET    | `/empresas/:id` |                                                                               |
| PUT    | `/empresas/:id` | `{ nome, site? }`                                                             |
| DELETE | `/empresas/:id` | `409` se a empresa ainda tem vagas                                            |
| GET    | `/vagas`        | Mais recentes primeiro; filtros `?empresaId=&modalidade=&senioridade=&busca=` |
| POST   | `/vagas`        | `{ empresaId, titulo, descricao, url?, modalidade?, senioridade? }`           |
| GET    | `/vagas/:id`    |                                                                               |
| PUT    | `/vagas/:id`    | Mesmo corpo do POST                                                           |
| DELETE | `/vagas/:id`    | Remove também as candidaturas da vaga                                         |

As vagas sempre voltam com `empresa: { id, nome }`. Valores aceitos: `modalidade` = `REMOTO`, `HIBRIDO`, `PRESENCIAL`; `senioridade` = `ESTAGIO`, `JUNIOR`, `PLENO`, `SENIOR`, `ESPECIALISTA`.

### Candidaturas

Cada pessoa vê e altera só as próprias candidaturas; a de outra pessoa responde `404`, igual a uma que não existe. Cada candidatura volta com `vaga: { id, titulo, empresa }`, as datas como `AAAA-MM-DD` e `proximosStatus`, a lista de status para onde ela pode ser movida (o kanban usa isso para saber onde o card pode ser solto).

| Método | Rota                       | Observação                                                                      |
| ------ | -------------------------- | ------------------------------------------------------------------------------- |
| GET    | `/candidaturas`            | Mais recentemente alterada primeiro; filtros `?status=&vagaId=`                 |
| POST   | `/candidaturas`            | `{ vagaId, proximoFollowup? }`; nasce como `INTERESSE`; `409` se já existe      |
| GET    | `/candidaturas/:id`        |                                                                                 |
| PATCH  | `/candidaturas/:id`        | `{ dataAplicacao?, proximoFollowup? }`; só o que for enviado muda, `null` limpa |
| PATCH  | `/candidaturas/:id/status` | `{ status }`; `409` se a transição não é permitida                              |
| DELETE | `/candidaturas/:id`        | Remove também as etapas e a análise da candidatura                              |

**Transições de status permitidas** (qualquer outra responde `409`):

| De           | Para                                             |
| ------------ | ------------------------------------------------ |
| `INTERESSE`  | `APLICADO`, `ENCERRADO`                          |
| `APLICADO`   | `INTERESSE`, `ENTREVISTA`, `OFERTA`, `ENCERRADO` |
| `ENTREVISTA` | `APLICADO`, `OFERTA`, `ENCERRADO`                |
| `OFERTA`     | `ENTREVISTA`, `ENCERRADO`                        |
| `ENCERRADO`  | `INTERESSE`, `APLICADO`, `ENTREVISTA` (reabrir)  |

Avança uma etapa por vez, pode voltar uma etapa (card arrastado sem querer) e reabrir uma candidatura encerrada. Não dá para pular direto de `INTERESSE` para `ENTREVISTA` ou `OFERTA`. As regras ficam em [status.ts](apps/api/src/modules/candidaturas/status.ts).

A gravação do status é condicional: só muda se a candidatura ainda estiver no status que foi lido para validar a transição. Se outra requisição a alterou no meio do caminho, a resposta é `409` ("A candidatura foi alterada ao mesmo tempo"), e a regra de transição nunca é furada por duas requisições simultâneas.

### Etapas da candidatura

As etapas (triagem, entrevistas, teste técnico, proposta) formam a linha do tempo de uma candidatura. Ficam aninhadas nela, e quem manda é o dono da candidatura: a de outra pessoa responde `404` em todas as rotas.

| Método | Rota                                | Observação                                                    |
| ------ | ----------------------------------- | ------------------------------------------------------------- |
| GET    | `/candidaturas/:id/etapas`          | Em ordem cronológica                                          |
| POST   | `/candidaturas/:id/etapas`          | `{ tipo, data, anotacoes? }`                                  |
| PUT    | `/candidaturas/:id/etapas/:etapaId` | Mesmo corpo do POST; sem `anotacoes`, as anotações são limpas |
| DELETE | `/candidaturas/:id/etapas/:etapaId` | `404` se a etapa pertence a outra candidatura                 |

`tipo`: `TRIAGEM`, `ENTREVISTA_RH`, `ENTREVISTA_TECNICA`, `TESTE_TECNICO`, `PROPOSTA` ou `OUTRO`. `data` é um instante em ISO 8601 **com fuso** (`2026-11-05T14:00:00-03:00` ou terminado em `Z`); datas sem fuso são recusadas, para a hora não depender do servidor, e a API sempre devolve em UTC. Anotações têm até 5.000 caracteres. Criar etapas não muda o status da candidatura.

### Currículos

Cada pessoa vê e altera só os próprios currículos (o de outra pessoa responde `404`). **Só um currículo fica ativo por vez**, e é o ativo que a análise de vagas vai usar. O banco garante isso com um índice único parcial, então nem duas requisições simultâneas conseguem deixar dois ativos.

| Método | Rota                     | Observação                                                                      |
| ------ | ------------------------ | ------------------------------------------------------------------------------- |
| GET    | `/curriculos`            | Mais recente primeiro                                                           |
| GET    | `/curriculos/ativo`      | `404` se a pessoa ainda não tem currículo                                       |
| POST   | `/curriculos`            | `{ conteudo, ativo? }`; o primeiro já nasce ativo; `ativo: true` assume o lugar |
| GET    | `/curriculos/:id`        |                                                                                 |
| PUT    | `/curriculos/:id`        | `{ conteudo }`; não muda qual está ativo                                        |
| POST   | `/curriculos/:id/ativar` | Troca o ativo: desativa o atual e ativa este                                    |
| DELETE | `/curriculos/:id`        | `409` se for o ativo e houver outros; remove também as análises feitas com ele  |

O texto tem de 30 a 30.000 caracteres. Em vez de apagar um currículo antigo, prefira ativar outro: remover apaga as análises de vagas feitas com ele.

### Erros

Erros vêm como `{ "erro": "mensagem" }`. Erros de validação (`400`) trazem também `detalhes` com o campo e a mensagem. JSON malformado responde `400` e corpo grande demais, `413`.

## Usando o servidor MCP no Claude

MCP (Model Context Protocol) é um jeito padronizado de dar **ferramentas** ao Claude. O servidor em `apps/mcp` é um programa pequeno que o Claude abre e com o qual conversa pela entrada e saída padrão (stdio). Quando você pergunta "quais candidaturas estão paradas?", o Claude escolhe uma ferramenta, o servidor consulta a API do JobPilot e devolve o resultado.

```
Claude  ⇄  servidor MCP (apps/mcp)  ⇄  API (apps/api)  ⇄  PostgreSQL
```

### Ferramentas

Quatro são só de leitura. A `mover_candidatura` **altera dados**: muda o status de uma candidatura, e por isso a descrição dela orienta o Claude a confirmar com você antes de usá-la.

| Ferramenta              | O que faz                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `listar_candidaturas`   | Lista as suas candidaturas, com os filtros `status` e `parada_ha_dias`; mostra os dias parada e para onde cada uma pode ir |
| `detalhar_candidatura`  | Mostra uma candidatura com a vaga completa (descrição) e a linha do tempo de etapas                                        |
| `obter_curriculo_ativo` | Devolve o texto do seu currículo ativo e a data em que foi salvo (usada pelas skills)                                      |
| `mover_candidatura`     | Muda o status de uma candidatura (`id` e `status`), com as mesmas regras do kanban; **altera dados**                       |
| `status_api`            | Verifica se a API está no ar (não precisa de login)                                                                        |

"Parada" quer dizer sem mudança de status nem de datas: registrar uma etapa não zera a contagem.

Como a `mover_candidatura` funciona: ela lê a candidatura e confere se o destino está na lista de `pode_mover_para` que a própria API informa; se não estiver, responde com os destinos válidos e **não escreve nada**. Pedir o status que a candidatura já tem não muda nada. Se outra mudança acontecer ao mesmo tempo, a API recusa (409) e a ferramenta mostra o motivo.

### Configurar

O servidor entra na API com o seu e-mail e a sua senha do JobPilot e renova o login sozinho (o token vale 15 minutos). Por isso ele precisa de três variáveis de ambiente:

| Variável           | Obrigatória | Exemplo                              |
| ------------------ | ----------- | ------------------------------------ |
| `JOBPILOT_EMAIL`   | sim         | `ana@exemplo.com`                    |
| `JOBPILOT_SENHA`   | sim         | a senha da conta                     |
| `JOBPILOT_API_URL` | não         | `http://localhost:3333` (é o padrão) |

1. Suba o banco e a API (`npm run db:up` e `npm run dev:api`) e gere o build do servidor:

   ```bash
   npm run build -w apps/mcp
   ```

2. Registre o servidor no Claude Code, **de uma destas formas**:

   **a) Pelo comando** (as opções vão antes do nome do servidor, e o `--` separa o nome do comando que o Claude executa):

   ```bash
   claude mcp add --env JOBPILOT_EMAIL=ana@exemplo.com --env JOBPILOT_SENHA=sua-senha jobpilot -- node D:/Dev/JobPilot/apps/mcp/dist/index.js
   ```

   **b) Por um arquivo `.mcp.json` na raiz do projeto**, que lê as variáveis do seu sistema e assim não guarda senha no arquivo:

   ```json
   {
     "mcpServers": {
       "jobpilot": {
         "command": "node",
         "args": ["apps/mcp/dist/index.js"],
         "env": {
           "JOBPILOT_EMAIL": "${JOBPILOT_EMAIL}",
           "JOBPILOT_SENHA": "${JOBPILOT_SENHA}"
         }
       }
     }
   }
   ```

3. Reinicie o Claude Code e confira se o servidor conectou (`claude mcp list`, ou `/mcp` dentro do Claude Code). Depois é só perguntar: _"Quais candidaturas minhas estão paradas há mais de 7 dias?"_

> **Atenção com a senha.** No jeito (a), ela fica em texto puro no arquivo de configuração do Claude; no (b), nas variáveis de ambiente do seu sistema. Use uma conta de desenvolvimento, e não uma senha que você usa em outro lugar.

> **Os passos 2 e 3 não foram testados neste repositório.** O servidor em si foi testado de ponta a ponta (processo real, API real, por stdio), mas o registro no Claude depende da versão e das configurações da sua instalação. Se algo não conectar, a seção abaixo ajuda a achar o motivo.

### Quando não funciona

| O que aparece                                     | Causa provável                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| Servidor "failed" na lista, ao abrir              | Faltam `JOBPILOT_EMAIL` ou `JOBPILOT_SENHA` (o motivo sai no `stderr`) |
| "O JobPilot recusou o login"                      | E-mail ou senha errados na configuração                                |
| "Não consegui falar com a API do JobPilot em ..." | A API não está rodando (`npm run dev:api`) ou a URL está errada        |
| A ferramenta não aparece                          | O build está desatualizado: rode `npm run build -w apps/mcp` de novo   |

Para ver o servidor funcionando sem o Claude, o **MCP Inspector** abre uma tela de teste (defina as variáveis no terminal antes):

```bash
npx @modelcontextprotocol/inspector node apps/mcp/dist/index.js
```

## Skills do Claude

Uma **skill** é uma pasta com um arquivo `SKILL.md`: instruções em texto que o Claude carrega **quando a tarefa pede**. O cabeçalho do arquivo tem o `name` e uma `description`, que o Claude lê para decidir se vale usar a skill; o resto é o passo a passo. A diferença para o MCP: o MCP dá ao Claude **ferramentas** (acesso aos seus dados e ações), e a skill dá **um modo de trabalhar** (um roteiro e um formato). As duas se completam: a skill diz o que fazer, e o MCP traz os dados.

As skills do projeto ficam em [.claude/skills/](.claude/skills), e o Claude Code as lê dali quando você abre este projeto.

| Skill                   | Quando usar                                                          | O que faz                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preparacao-entrevista` | "Me prepara para a entrevista da vaga X", "o que estudar?"           | Busca a candidatura, a vaga completa, as etapas anteriores e o currículo ativo, e monta um roteiro: vaga × currículo, perguntas, lacunas e estudo |
| `ajuste-curriculo`      | "Ajusta meu currículo para a vaga X", "quais palavras-chave faltam?" | Compara o currículo ativo com a vaga e **sugere** reescritas (antes e depois), apontando as lacunas e perguntando se você tem a experiência       |

Exige o servidor MCP conectado (veja acima). As skills só **leem** dados e não usam a `mover_candidatura`. A `ajuste-curriculo` também **não salva** o currículo: ela entrega o texto novo, e você cola na tela Currículo se quiser usá-lo.

A regra mais importante da `ajuste-curriculo` é **nunca inventar**: ela só reescreve o que o currículo já mostra, e uma habilidade que a vaga pede e o currículo não tem vira uma pergunta ("você tem essa experiência?"), nunca uma linha nova no texto.

**Como testar:** com o servidor registrado e uma candidatura em Entrevista (e um currículo ativo salvo), peça no Claude Code: _"Me prepara para a entrevista da candidatura da empresa X"_. O roteiro deve citar trechos da vaga e do seu currículo, usar as anotações das etapas anteriores e marcar como "exemplo" qualquer coisa que não esteja no seu currículo.

Para a `ajuste-curriculo`, escolha uma vaga cujo anúncio peça algo que o seu currículo **não** tem e peça: _"Ajusta meu currículo para a vaga da empresa X"_. O resultado certo cita trechos reais do seu currículo, mostra o antes e o depois e trata o que falta como lacuna, perguntando se você tem a experiência.

Um teste automático (`apps/mcp/tests/skills.test.ts`) confere o formato de cada skill (nome igual ao da pasta, descrição com "Use quando"), que ela só cita ferramentas que o servidor MCP realmente oferece e que toda skill que lê o currículo mantém a regra de nunca inventar experiência.

> **Não foi testado aqui o Claude de fato usando a skill.** O formato e as ferramentas citadas são verificados por testes, e os dados que a skill pede foram buscados pelo servidor real, mas o roteiro em si depende do seu Claude Code com o servidor registrado.

## Fluxo de trabalho

- GitHub Flow: uma branch `feature/JP-XX-descricao` por história, PR para a `main`.
- Conventional Commits (`feat`, `fix`, `test`, `docs`, `chore`, `refactor`).
- O CI roda lint, formatação, testes e build em todo PR.
