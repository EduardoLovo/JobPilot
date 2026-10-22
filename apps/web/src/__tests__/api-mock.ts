import { vi } from 'vitest'
import { jsonResponse, usuarioAna } from './helpers'

interface MockedRequest {
  method: string
  path: string
  body: Record<string, unknown> | undefined
}

// Troca o fetch por um que responde conforme a rota; /auth/me já vem pronto para as guardas de rota
export function stubApi(handler: (req: MockedRequest) => Response | undefined) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    if (path === '/auth/me') return jsonResponse(200, usuarioAna)

    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    return (
      handler({ method: init?.method ?? 'GET', path, body }) ??
      jsonResponse(404, { erro: 'rota não mockada' })
    )
  })
  vi.stubGlobal('fetch', fetchMock)

  // Chamadas feitas à API, sem o /auth/me das guardas
  const calls = () =>
    fetchMock.mock.calls
      .map(([url, init]) => ({
        method: init?.method ?? 'GET',
        path: String(url).replace(/^https?:\/\/[^/]+/, ''),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      }))
      .filter((c) => c.path !== '/auth/me')

  return { fetchMock, calls }
}

export const nubank = { id: 'e1', nome: 'Nubank', site: null }

export function vagaDe(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    empresaId: nubank.id,
    titulo: 'Desenvolvedora Vue',
    descricao: 'Front-end com Vue 3',
    url: null,
    modalidade: 'REMOTO',
    senioridade: 'JUNIOR',
    criadoEm: '2026-10-22T12:00:00.000Z',
    empresa: { id: nubank.id, nome: nubank.nome },
    ...overrides,
  }
}
