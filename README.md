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

Gere o build (`npm run build -w apps/mcp`) e adicione ao Claude Code:

```bash
claude mcp add jobpilot -- node D:/Dev/JobPilot/apps/mcp/dist/index.js
```

## Fluxo de trabalho

- GitHub Flow: uma branch `feature/JP-XX-descricao` por história, PR para a `main`.
- Conventional Commits (`feat`, `fix`, `test`, `docs`, `chore`, `refactor`).
- O CI roda lint, formatação, testes e build em todo PR.
