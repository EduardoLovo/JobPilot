import { tokenStorage, type Tokens } from './token-storage'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export interface CampoInvalido {
  campo: string
  mensagem: string
}

// Erro no formato que a API devolve: { erro, detalhes? }
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detalhes: CampoInvalido[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  // false nas rotas públicas (login, cadastro), que não levam token
  auth?: boolean
}

let onSessionExpired = () => {}

// Chamado quando nem o refresh token funciona mais (ex.: depois de 7 dias)
export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler
}

function send(path: string, { method = 'GET', body }: RequestOptions, accessToken?: string) {
  return fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  const res = await send('/auth/refresh', { method: 'POST', body: { refreshToken } })
  return res.ok ? ((await res.json()) as Tokens) : null
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true } = options
  const tokens = auth ? tokenStorage.get() : null

  let res = await send(path, options, tokens?.accessToken)

  // Access token vence em 15 min: tenta renovar uma vez e repete a requisição
  if (res.status === 401 && tokens) {
    const novos = await refreshTokens(tokens.refreshToken)
    if (!novos) {
      tokenStorage.clear()
      onSessionExpired()
      throw new ApiError(401, 'Sua sessão expirou. Entre novamente.')
    }
    tokenStorage.set(novos)
    res = await send(path, options, novos.accessToken)
  }

  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data.erro ?? 'Erro inesperado. Tente novamente.', data.detalhes)
  }
  return data as T
}
