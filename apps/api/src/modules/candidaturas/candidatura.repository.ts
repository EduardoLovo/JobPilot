import type { PrismaClient } from '../../generated/prisma/client.js'
import type { CandidaturaFiltros } from './candidatura.schemas.js'
import type { StatusCandidatura } from './status.js'

export interface CandidaturaRecord {
  id: string
  usuarioId: string
  vagaId: string
  status: StatusCandidatura
  dataAplicacao: Date | null
  proximoFollowup: Date | null
  atualizadoEm: Date
  vaga: { id: string; titulo: string; empresa: { id: string; nome: string } }
}

export interface CandidaturaCreate {
  usuarioId: string
  vagaId: string
  proximoFollowup: Date | null
}

export type CandidaturaUpdate = Partial<
  Pick<CandidaturaRecord, 'status' | 'dataAplicacao' | 'proximoFollowup'>
>

// Toda consulta recebe o usuarioId: cada pessoa só enxerga as próprias candidaturas
export interface CandidaturaRepository {
  list(usuarioId: string, filtros: CandidaturaFiltros): Promise<CandidaturaRecord[]>
  findById(id: string, usuarioId: string): Promise<CandidaturaRecord | null>
  findByUsuarioVaga(usuarioId: string, vagaId: string): Promise<CandidaturaRecord | null>
  create(data: CandidaturaCreate): Promise<CandidaturaRecord>
  update(id: string, data: CandidaturaUpdate): Promise<CandidaturaRecord>
  delete(id: string): Promise<void>
}

// Cada candidatura volta com a vaga e a empresa, que é o que o kanban mostra no card
const include = {
  vaga: {
    select: { id: true, titulo: true, empresa: { select: { id: true, nome: true } } },
  },
} as const

export function createPrismaCandidaturaRepository(prisma: PrismaClient): CandidaturaRepository {
  return {
    list: (usuarioId, { status, vagaId }) =>
      prisma.candidatura.findMany({
        where: { usuarioId, status, vagaId },
        include,
        orderBy: { atualizadoEm: 'desc' },
      }),
    findById: (id, usuarioId) =>
      prisma.candidatura.findFirst({ where: { id, usuarioId }, include }),
    findByUsuarioVaga: (usuarioId, vagaId) =>
      prisma.candidatura.findUnique({
        where: { usuarioId_vagaId: { usuarioId, vagaId } },
        include,
      }),
    create: (data) => prisma.candidatura.create({ data, include }),
    update: (id, data) => prisma.candidatura.update({ where: { id }, data, include }),
    delete: async (id) => {
      await prisma.candidatura.delete({ where: { id } })
    },
  }
}
