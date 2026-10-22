import jwt from 'jsonwebtoken'
import { env } from '../../config/env.js'
import { AppError } from '../../errors/app-error.js'

type TokenType = 'access' | 'refresh'

interface TokenPayload {
  sub: string
  type: TokenType
}

export function generateTokens(usuarioId: string) {
  return {
    accessToken: jwt.sign({ type: 'access' }, env.jwtSecret, {
      subject: usuarioId,
      expiresIn: env.accessTokenTtl,
    }),
    refreshToken: jwt.sign({ type: 'refresh' }, env.jwtSecret, {
      subject: usuarioId,
      expiresIn: env.refreshTokenTtl,
    }),
  }
}

// Retorna o id do usuário; o tipo impede usar um refresh token como access token e vice-versa
export function verifyToken(token: string, expected: TokenType): string {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as TokenPayload
    if (payload.type !== expected) throw new Error('tipo de token incorreto')
    return payload.sub
  } catch {
    throw new AppError(401, 'Token inválido ou expirado')
  }
}
