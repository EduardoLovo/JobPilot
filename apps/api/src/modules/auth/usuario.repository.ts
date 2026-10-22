import type { PrismaClient } from '../../generated/prisma/client.js'

export interface UsuarioRecord {
  id: string
  nome: string
  email: string
  senhaHash: string
}

// O service depende desta interface, não do Prisma, para os testes usarem um repositório em memória
export interface UsuarioRepository {
  findByEmail(email: string): Promise<UsuarioRecord | null>
  findById(id: string): Promise<UsuarioRecord | null>
  create(data: Omit<UsuarioRecord, 'id'>): Promise<UsuarioRecord>
}

export function createPrismaUsuarioRepository(prisma: PrismaClient): UsuarioRepository {
  return {
    findByEmail: (email) => prisma.usuario.findUnique({ where: { email } }),
    findById: (id) => prisma.usuario.findUnique({ where: { id } }),
    create: (data) => prisma.usuario.create({ data }),
  }
}
