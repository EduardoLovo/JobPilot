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
npm run dev:api    # http://localhost:3333/health
npm run dev:web    # http://localhost:5173
```

O n8n fica em http://localhost:5678.

## Scripts

| Comando                | O que faz                       |
| ---------------------- | ------------------------------- |
| `npm test`             | Roda os testes de todos os apps |
| `npm run lint`         | ESLint em todo o monorepo       |
| `npm run format`       | Formata o código com Prettier   |
| `npm run build`        | Gera o build de todos os apps   |
| `npm run db:up`/`down` | Sobe ou derruba os containers   |
| `npm run dev:mcp`      | Roda o servidor MCP via stdio   |

## Usando o servidor MCP no Claude

Gere o build (`npm run build -w apps/mcp`) e adicione ao Claude Code:

```bash
claude mcp add jobpilot -- node D:/Dev/JobPilot/apps/mcp/dist/index.js
```

## Fluxo de trabalho

- GitHub Flow: uma branch `feature/JP-XX-descricao` por história, PR para a `main`.
- Conventional Commits (`feat`, `fix`, `test`, `docs`, `chore`, `refactor`).
- O CI roda lint, formatação, testes e build em todo PR.
