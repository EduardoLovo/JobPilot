import type { RequestHandler } from 'express'
import { AppError } from '../errors/app-error.js'
import { verifyToken } from '../modules/auth/tokens.js'

// Exige "Authorization: Bearer <accessToken>" e guarda o id em res.locals.usuarioId
export const requireAuth: RequestHandler = (req, res, next) => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? []

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Token de acesso ausente')
  }

  res.locals.usuarioId = verifyToken(token, 'access')
  next()
}
