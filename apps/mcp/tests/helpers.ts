import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createApiClient } from '../src/api-client.js'
import { createServer } from '../src/server.js'

export const config = {
  apiUrl: 'http://api.teste',
  email: 'ana@exemplo.com',
  senha: 'senha-secreta-123',
}

// "Agora" fixo, para os dias parados serem previsíveis
export const AGORA = new Date('2026-10-22T12:00:00.000Z')

export interface Chamada {
  method: string
  caminho: string
  headers: Record<string, string>
  body?: unknown
}

export const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// Uma API de mentira: `rotas` diz o que ela responde (ou nada, para cair no padrão). Guarda todas
// as chamadas feitas, para o teste conferir. O login padrão sempre dá certo.
export function apiFalsa(rotas: (chamada: Chamada) => Response | Promise<Response> | undefined) {
  const chamadas: Chamada[] = []

  const fetchFalso = (async (url: string, init?: RequestInit) => {
    const chamada: Chamada = {
      method: init?.method ?? 'GET',
      caminho: url.replace(config.apiUrl, ''),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
    chamadas.push(chamada)

    const resposta = await rotas(chamada)
    if (resposta) return resposta
    if (chamada.caminho === '/auth/login') return json(200, { accessToken: 'token-1' })
    return json(404, { erro: 'rota não mockada' })
  }) as typeof fetch

  return { fetchFalso, chamadas }
}

// Liga um cliente MCP de verdade ao servidor por um canal em memória
export async function conectar(fetchFalso: typeof fetch) {
  const server = createServer(createApiClient(config, fetchFalso), () => AGORA)
  const client = new Client({ name: 'teste', version: '0.0.0' })
  const [ladoCliente, ladoServidor] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(ladoServidor), client.connect(ladoCliente)])
  return client
}

export const textoDe = (resultado: unknown) =>
  (resultado as { content: { type: string; text: string }[] }).content[0].text

export const dadosDe = (resultado: unknown) => JSON.parse(textoDe(resultado))

export const candidaturaDe = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  vagaId: 'v1',
  status: 'APLICADO',
  dataAplicacao: '2026-10-15',
  proximoFollowup: null,
  atualizadoEm: '2026-10-12T12:00:00.000Z',
  vaga: { id: 'v1', titulo: 'Desenvolvedora Vue', empresa: { id: 'e1', nome: 'Nubank' } },
  proximosStatus: ['INTERESSE', 'ENTREVISTA', 'OFERTA', 'ENCERRADO'],
  ...overrides,
})
