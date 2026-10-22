import type { PrismaClient } from '../../generated/prisma/client.js'
import type { TipoEtapa } from './etapa.schemas.js'

export interface EtapaRecord {
  id: string
  candidaturaId: string
  tipo: TipoEtapa
  data: Date
  anotacoes: string | null
}

export interface EtapaData {
  tipo: TipoEtapa
  data: Date
  anotacoes: string | null
}

// Quem confere se a candidatura é da pessoa logada é o service; aqui só se fala de etapas
export interface EtapaRepository {
  // Em ordem cronológica: é a linha do tempo da candidatura
  list(candidaturaId: string): Promise<EtapaRecord[]>
  findById(id: string, candidaturaId: string): Promise<EtapaRecord | null>
  create(candidaturaId: string, data: EtapaData): Promise<EtapaRecord>
  update(id: string, data: EtapaData): Promise<EtapaRecord>
  delete(id: string): Promise<void>
}

export function createPrismaEtapaRepository(prisma: PrismaClient): EtapaRepository {
  return {
    // O id desempata etapas marcadas para o mesmo instante, para a ordem não variar entre consultas
    list: (candidaturaId) =>
      prisma.etapa.findMany({
        where: { candidaturaId },
        orderBy: [{ data: 'asc' }, { id: 'asc' }],
      }),
    findById: (id, candidaturaId) => prisma.etapa.findFirst({ where: { id, candidaturaId } }),
    create: (candidaturaId, data) => prisma.etapa.create({ data: { candidaturaId, ...data } }),
    update: (id, data) => prisma.etapa.update({ where: { id }, data }),
    delete: async (id) => {
      await prisma.etapa.delete({ where: { id } })
    },
  }
}
