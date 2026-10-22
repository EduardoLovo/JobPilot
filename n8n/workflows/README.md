# Workflows do n8n

Os workflows exportados do n8n (JSON) ficam nesta pasta para serem versionados no Git.

A pasta é montada no container em `/workflows`. Para exportar ou importar:

```bash
docker exec jobpilot-n8n n8n export:workflow --all --separate --output=/workflows
docker exec jobpilot-n8n n8n import:workflow --separate --input=/workflows
```

Workflows planejados (Sprint 3):

1. Análise de vaga: webhook, agente Analista de Vaga, `PUT /analises`
2. Follow-up diário: cron às 9h, candidaturas paradas há 7 dias ou mais, Telegram/e-mail
3. Resumo semanal: cron às segundas 8h, `GET /dashboard/resumo`, e-mail
