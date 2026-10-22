import type { McpConfig } from './config.js'

// Erro com uma mensagem que já pode ser mostrada ao Claude (e a quem o usa), sem detalhes técnicos
export class JobPilotApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'JobPilotApiError'
  }
}

interface Opcoes {
  // false nas rotas públicas (ex.: /health), que não precisam de login
  auth?: boolean
}

export interface ApiClient {
  get<T>(caminho: string, opcoes?: Opcoes): Promise<T>
}

// Faz o login com o e-mail e a senha configurados, guarda o token e o renova sozinho: o token de
// acesso vale 15 minutos, e um servidor MCP pode ficar aberto o dia todo.
export function createApiClient(config: McpConfig, fetchImpl: typeof fetch = fetch): ApiClient {
  let token: string | null = null
  let loginEmAndamento: Promise<string> | null = null

  async function enviar(caminho: string, headers: Record<string, string> = {}) {
    try {
      return await fetchImpl(`${config.apiUrl}${caminho}`, { headers })
    } catch {
      throw new JobPilotApiError(
        0,
        `Não consegui falar com a API do JobPilot em ${config.apiUrl}. Ela está rodando?`,
      )
    }
  }

  async function entrar() {
    const res = await fetchImpl(`${config.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: config.email, senha: config.senha }),
    }).catch(() => {
      throw new JobPilotApiError(
        0,
        `Não consegui falar com a API do JobPilot em ${config.apiUrl}. Ela está rodando?`,
      )
    })

    if (res.status === 401) {
      throw new JobPilotApiError(
        401,
        'O JobPilot recusou o login. Confira JOBPILOT_EMAIL e JOBPILOT_SENHA na configuração do servidor MCP.',
      )
    }
    if (!res.ok) {
      throw new JobPilotApiError(res.status, `O login no JobPilot falhou (erro ${res.status}).`)
    }

    return ((await res.json()) as { accessToken: string }).accessToken
  }

  // Duas ferramentas chamadas ao mesmo tempo esperam o mesmo login, em vez de fazerem dois
  function garantirLogin() {
    loginEmAndamento ??= entrar()
      .then((novo) => (token = novo))
      .finally(() => (loginEmAndamento = null))
    return loginEmAndamento
  }

  async function lerCorpo<T>(res: Response): Promise<T> {
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) {
      const mensagem =
        (corpo as { erro?: string }).erro ?? `A API respondeu com erro ${res.status}.`
      throw new JobPilotApiError(res.status, mensagem)
    }
    return corpo as T
  }

  return {
    async get<T>(caminho: string, { auth = true }: Opcoes = {}) {
      if (!auth) return lerCorpo<T>(await enviar(caminho))

      const autorizado = async () =>
        enviar(caminho, { Authorization: `Bearer ${token ?? (await garantirLogin())}` })

      let res = await autorizado()
      // Token vencido: entra de novo uma vez e repete
      if (res.status === 401) {
        token = null
        res = await autorizado()
      }
      return lerCorpo<T>(res)
    },
  }
}
