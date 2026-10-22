export interface McpConfig {
  apiUrl: string
  email: string
  senha: string
}

// Quem registra o servidor no Claude (claude mcp add --env ...) é quem define estas variáveis
export function lerConfig(env: Record<string, string | undefined>): McpConfig {
  const faltando = ['JOBPILOT_EMAIL', 'JOBPILOT_SENHA'].filter((nome) => !env[nome])
  if (faltando.length) {
    throw new Error(
      `Variáveis de ambiente ausentes: ${faltando.join(', ')}. ` +
        'Veja "Usando o servidor MCP no Claude" no README.',
    )
  }

  return {
    // Sem barra no fim, para montar os caminhos com `${apiUrl}/candidaturas`
    apiUrl: (env.JOBPILOT_API_URL ?? 'http://localhost:3333').replace(/\/+$/, ''),
    email: env.JOBPILOT_EMAIL!,
    senha: env.JOBPILOT_SENHA!,
  }
}
