import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ApiClient } from './api-client.js'
import { registrarFerramentas } from './tools.js'

// Separado do index.ts para os testes montarem o servidor sem abrir um processo
export function createServer(api: ApiClient, agora?: () => Date) {
  const server = new McpServer({ name: 'jobpilot', version: '0.1.0' })
  registrarFerramentas(server, api, agora)
  return server
}
