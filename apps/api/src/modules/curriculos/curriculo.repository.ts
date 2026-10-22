import type { PrismaClient } from '../../generated/prisma/client.js'

export interface CurriculoRecord {
  id: string
  usuarioId: string
  conteudo: string
  ativo: boolean
  criadoEm: Date
}

// Toda consulta recebe o usuarioId: cada pessoa só enxerga os próprios currículos
export interface CurriculoRepository {
  list(usuarioId: string): Promise<CurriculoRecord[]>
  findById(id: string, usuarioId: string): Promise<CurriculoRecord | null>
  findAtivo(usuarioId: string): Promise<CurriculoRecord | null>
  count(usuarioId: string): Promise<number>
  // Com ativo = true, desativa o currículo ativo anterior no mesmo passo
  create(data: { usuarioId: string; conteudo: string; ativo: boolean }): Promise<CurriculoRecord>
  update(id: string, data: { conteudo: string }): Promise<CurriculoRecord>
  // Troca o currículo ativo: desativa o atual e ativa este
  activate(id: string, usuarioId: string): Promise<CurriculoRecord>
  delete(id: string): Promise<void>
}

export function createPrismaCurriculoRepository(prisma: PrismaClient): CurriculoRepository {
  return {
    list: (usuarioId) =>
      prisma.curriculo.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'desc' } }),
    findById: (id, usuarioId) => prisma.curriculo.findFirst({ where: { id, usuarioId } }),
    findAtivo: (usuarioId) => prisma.curriculo.findFirst({ where: { usuarioId, ativo: true } }),
    count: (usuarioId) => prisma.curriculo.count({ where: { usuarioId } }),
    create: ({ usuarioId, conteudo, ativo }) =>
      prisma.$transaction(async (tx) => {
        if (ativo) {
          await tx.curriculo.updateMany({
            where: { usuarioId, ativo: true },
            data: { ativo: false },
          })
        }
        return tx.curriculo.create({ data: { usuarioId, conteudo, ativo } })
      }),
    update: (id, data) => prisma.curriculo.update({ where: { id }, data }),
    activate: (id, usuarioId) =>
      prisma.$transaction(async (tx) => {
        await tx.curriculo.updateMany({
          where: { usuarioId, ativo: true, id: { not: id } },
          data: { ativo: false },
        })
        return tx.curriculo.update({ where: { id }, data: { ativo: true } })
      }),
    delete: async (id) => {
      await prisma.curriculo.delete({ where: { id } })
    },
  }
}
