const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET é obrigatório em produção')
}

export const env = {
  // Fallback só para dev e testes; em produção o segredo vem do ambiente
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-nao-use-em-producao',
  accessTokenTtl: '15m',
  refreshTokenTtl: '7d',
} as const
