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
  patch<T>(caminho: string, corpo: unknown): Promise<T>
}

type Metodo = 'GET' | 'PATCH'

// Faz o login com o e-mail e a senha configurados, guarda o token e o renova sozinho: o token de
// acesso vale 15 minutos, e um servidor MCP pode ficar aberto o dia todo.
export function createApiClient(config: McpConfig, fetchImpl: typeof fetch = fetch): ApiClient {
  let token: string | null = null
  let loginEmAndamento: Promise<string> | null = null

  const apiForaDoAr = () =>
    new JobPilotApiError(
      0,
      `Não consegui falar com a API do JobPilot em ${config.apiUrl}. Ela está rodando?`,
    )

  async function enviar(
    metodo: Metodo,
    caminho: string,
    corpo?: unknown,
    headers: Record<string, string> = {},
  ) {
    try {
      return await fetchImpl(`${config.apiUrl}${caminho}`, {
        method: metodo,
        headers: { ...(corpo !== undefined && { 'Content-Type': 'application/json' }), ...headers },
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      })
    } catch {
      throw apiForaDoAr()
    }
  }

  async function entrar() {
    const res = await fetchImpl(`${config.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: config.email, senha: config.senha }),
    }).catch(() => {
      throw apiForaDoAr()
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

  async function autenticada<T>(metodo: Metodo, caminho: string, corpo?: unknown) {
    const tentar = async () =>
      enviar(metodo, caminho, corpo, {
        Authorization: `Bearer ${token ?? (await garantirLogin())}`,
      })

    let res = await tentar()
    // Token vencido: entra de novo uma vez e repete. É seguro repetir até uma escrita, porque
    // um 401 significa que a API nem chegou a processar o pedido.
    if (res.status === 401) {
      token = null
      res = await tentar()
    }
    return lerCorpo<T>(res)
  }

  return {
    get: async <T>(caminho: string, { auth = true }: Opcoes = {}) =>
      auth ? autenticada<T>('GET', caminho) : lerCorpo<T>(await enviar('GET', caminho)),
    patch: <T>(caminho: string, corpo: unknown) => autenticada<T>('PATCH', caminho, corpo),
  }
}
