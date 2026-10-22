import type { PrismaClient } from '../../generated/prisma/client.js'
import type { MODALIDADES, SENIORIDADES, VagaFiltros } from './vaga.schemas.js'

export interface VagaRecord {
  id: string
  empresaId: string
  titulo: string
  descricao: string
  url: string | null
  modalidade: (typeof MODALIDADES)[number] | null
  senioridade: (typeof SENIORIDADES)[number] | null
  criadoEm: Date
  empresa: { id: string; nome: string }
}

export type VagaData = Omit<VagaRecord, 'id' | 'criadoEm' | 'empresa'>

export interface VagaRepository {
  list(filtros: VagaFiltros): Promise<VagaRecord[]>
  findById(id: string): Promise<VagaRecord | null>
  create(data: VagaData): Promise<VagaRecord>
  update(id: string, data: VagaData): Promise<VagaRecord>
  delete(id: string): Promise<void>
}

// Toda vaga volta com o nome da empresa, que é o que as telas mostram
const include = { empresa: { select: { id: true, nome: true } } } as const

export function createPrismaVagaRepository(prisma: PrismaClient): VagaRepository {
  return {
    list: ({ empresaId, modalidade, senioridade, busca }) =>
      prisma.vaga.findMany({
        where: {
          empresaId,
          modalidade,
          senioridade,
          ...(busca && { titulo: { contains: busca, mode: 'insensitive' } }),
        },
        include,
        orderBy: { criadoEm: 'desc' },
      }),
    findById: (id) => prisma.vaga.findUnique({ where: { id }, include }),
    create: (data) => prisma.vaga.create({ data, include }),
    update: (id, data) => prisma.vaga.update({ where: { id }, data, include }),
    delete: async (id) => {
      await prisma.vaga.delete({ where: { id } })
    },
  }
}
