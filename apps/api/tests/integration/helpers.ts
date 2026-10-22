import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/lib/prisma.js'
import { createPrismaUsuarioRepository } from '../../src/modules/auth/usuario.repository.js'
import { createPrismaCandidaturaRepository } from '../../src/modules/candidaturas/candidatura.repository.js'
import { createPrismaCurriculoRepository } from '../../src/modules/curriculos/curriculo.repository.js'
import { createPrismaEmpresaRepository } from '../../src/modules/empresas/empresa.repository.js'
import { createPrismaVagaRepository } from '../../src/modules/vagas/vaga.repository.js'
import { assertTestDatabase } from './test-database.js'

export { prisma }

// Mesma montagem do server.ts: repositórios do Prisma no lugar dos em memória
export function createIntegrationApp() {
  return createApp({
    usuarios: createPrismaUsuarioRepository(prisma),
    empresas: createPrismaEmpresaRepository(prisma),
    vagas: createPrismaVagaRepository(prisma),
    candidaturas: createPrismaCandidaturaRepository(prisma),
    curriculos: createPrismaCurriculoRepository(prisma),
  })
}

// Esvazia todas as tabelas (menos o histórico de migrations) para cada teste começar do zero
export async function resetDatabase() {
  assertTestDatabase(process.env.DATABASE_URL ?? '')

  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "analises_ia", "etapas", "candidaturas", "curriculos", "vagas", "empresas", "usuarios" RESTART IDENTITY CASCADE',
  )
}

export const ana = { nome: 'Ana Souza', email: 'ana@exemplo.com', senha: 'senha-forte-123' }
export const bia = { nome: 'Bia Lima', email: 'bia@exemplo.com', senha: 'senha-forte-456' }

export async function cadastrar(app: ReturnType<typeof createApp>, dados = ana) {
  const res = await request(app).post('/auth/register').send(dados)
  return {
    usuario: res.body.usuario as { id: string; nome: string; email: string },
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
    refreshToken: res.body.refreshToken as string,
  }
}
