import { Router } from 'express'
import { requireAuth } from '../../middlewares/require-auth.js'
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas.js'
import type { AuthService } from './auth.service.js'

export function createAuthRouter(auth: AuthService) {
  const router = Router()

  router.post('/register', async (req, res) => {
    res.status(201).json(await auth.register(registerSchema.parse(req.body)))
  })

  router.post('/login', async (req, res) => {
    res.json(await auth.login(loginSchema.parse(req.body)))
  })

  router.post('/refresh', async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body)
    res.json(await auth.refresh(refreshToken))
  })

  router.get('/me', requireAuth, async (_req, res) => {
    res.json(await auth.me(res.locals.usuarioId))
  })

  return router
}
