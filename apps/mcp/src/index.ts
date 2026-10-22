#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const API_URL = process.env.JOBPILOT_API_URL ?? 'http://localhost:3333'

const server = new McpServer({ name: 'jobpilot', version: '0.0.0' })

// Sprint 0: só uma ferramenta para provar a ligação Claude -> MCP -> API.
// As ferramentas de candidaturas entram na Sprint 4.
server.registerTool(
  'status_api',
  {
    title: 'Status da API',
    description: 'Verifica se a API do JobPilot está no ar',
  },
  async () => {
    try {
      const res = await fetch(`${API_URL}/health`)
      const body = await res.text()
      return { content: [{ type: 'text', text: `API respondeu ${res.status}: ${body}` }] }
    } catch (err) {
      return {
        content: [{ type: 'text', text: `API fora do ar em ${API_URL}: ${String(err)}` }],
        isError: true,
      }
    }
  },
)

// stdout é o canal do protocolo MCP; logs vão para stderr
await server.connect(new StdioServerTransport())
console.error('Servidor MCP do JobPilot conectado via stdio')
