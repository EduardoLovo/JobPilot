import cors from 'cors'
import express from 'express'
import { errorHandler } from './middlewares/error-handler.js'
import { createAuthRouter } from './modules/auth/auth.routes.js'
import { createAuthService } from './modules/auth/auth.service.js'
import type { UsuarioRepository } from './modules/auth/usuario.repository.js'

export interface AppDeps {
  usuarios: UsuarioRepository
}

// O app é separado do server.ts para que os testes usem o Express sem abrir porta
// e injetem repositórios em memória no lugar do Prisma
export function createApp(deps: AppDeps) {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'jobpilot-api' })
  })

  app.use('/auth', createAuthRouter(createAuthService(deps.usuarios)))

  app.use(errorHandler)

  return app
}
