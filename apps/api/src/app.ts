import cors from 'cors'
import express from 'express'
import { errorHandler } from './middlewares/error-handler.js'
import { createAuthRouter } from './modules/auth/auth.routes.js'
import { createAuthService } from './modules/auth/auth.service.js'
import type { UsuarioRepository } from './modules/auth/usuario.repository.js'
import type { CandidaturaRepository } from './modules/candidaturas/candidatura.repository.js'
import { createCandidaturaRouter } from './modules/candidaturas/candidatura.routes.js'
import { createCandidaturaService } from './modules/candidaturas/candidatura.service.js'
import type { CurriculoRepository } from './modules/curriculos/curriculo.repository.js'
import { createCurriculoRouter } from './modules/curriculos/curriculo.routes.js'
import { createCurriculoService } from './modules/curriculos/curriculo.service.js'
import type { EmpresaRepository } from './modules/empresas/empresa.repository.js'
import { createEmpresaRouter } from './modules/empresas/empresa.routes.js'
import { createEmpresaService } from './modules/empresas/empresa.service.js'
import type { EtapaRepository } from './modules/etapas/etapa.repository.js'
import { createEtapaRouter } from './modules/etapas/etapa.routes.js'
import { createEtapaService } from './modules/etapas/etapa.service.js'
import type { VagaRepository } from './modules/vagas/vaga.repository.js'
import { createVagaRouter } from './modules/vagas/vaga.routes.js'
import { createVagaService } from './modules/vagas/vaga.service.js'

export interface AppDeps {
  usuarios: UsuarioRepository
  empresas: EmpresaRepository
  vagas: VagaRepository
  candidaturas: CandidaturaRepository
  curriculos: CurriculoRepository
  etapas: EtapaRepository
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
  app.use('/empresas', createEmpresaRouter(createEmpresaService(deps.empresas)))
  app.use('/vagas', createVagaRouter(createVagaService(deps.vagas, deps.empresas)))
  app.use(
    '/candidaturas',
    createCandidaturaRouter(createCandidaturaService(deps.candidaturas, deps.vagas)),
  )

  app.use(
    '/candidaturas/:candidaturaId/etapas',
    createEtapaRouter(createEtapaService(deps.etapas, deps.candidaturas)),
  )
  app.use('/curriculos', createCurriculoRouter(createCurriculoService(deps.curriculos)))

  app.use(errorHandler)

  return app
}
