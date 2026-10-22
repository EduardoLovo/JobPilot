#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createApiClient } from './api-client.js'
import { lerConfig } from './config.js'
import { createServer } from './server.js'

// stdout é o canal do protocolo MCP: nada além de mensagens do protocolo pode sair nele.
// Logs e erros vão para stderr.
let config
try {
  config = lerConfig(process.env)
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exit(1)
}

const server = createServer(createApiClient(config))

await server.connect(new StdioServerTransport())
console.error(`Servidor MCP do JobPilot conectado via stdio (API em ${config.apiUrl})`)
