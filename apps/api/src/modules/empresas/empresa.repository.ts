import type { PrismaClient } from '../../generated/prisma/client.js'

export interface EmpresaRecord {
  id: string
  nome: string
  site: string | null
}

export type EmpresaData = Omit<EmpresaRecord, 'id'>

export interface EmpresaRepository {
  list(busca?: string): Promise<EmpresaRecord[]>
  findById(id: string): Promise<EmpresaRecord | null>
  create(data: EmpresaData): Promise<EmpresaRecord>
  update(id: string, data: EmpresaData): Promise<EmpresaRecord>
  delete(id: string): Promise<void>
  countVagas(id: string): Promise<number>
}

export function createPrismaEmpresaRepository(prisma: PrismaClient): EmpresaRepository {
  return {
    // A ordenação do Postgres depende da collation do banco (no Docker é por byte: "iFood" vem
    // depois de "Stone"), então a ordem alfabética é feita aqui. A lista de empresas é pequena.
    list: async (busca) =>
      (
        await prisma.empresa.findMany({
          where: busca ? { nome: { contains: busca, mode: 'insensitive' } } : undefined,
        })
      ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    findById: (id) => prisma.empresa.findUnique({ where: { id } }),
    create: (data) => prisma.empresa.create({ data }),
    update: (id, data) => prisma.empresa.update({ where: { id }, data }),
    delete: async (id) => {
      await prisma.empresa.delete({ where: { id } })
    },
    countVagas: (id) => prisma.vaga.count({ where: { empresaId: id } }),
  }
}
