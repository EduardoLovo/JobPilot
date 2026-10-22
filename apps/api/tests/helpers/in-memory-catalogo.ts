import { randomUUID } from 'node:crypto'
import type {
  CandidaturaRecord,
  CandidaturaRepository,
} from '../../src/modules/candidaturas/candidatura.repository.js'
import type {
  EmpresaRecord,
  EmpresaRepository,
} from '../../src/modules/empresas/empresa.repository.js'
import type {
  VagaData,
  VagaRecord,
  VagaRepository,
} from '../../src/modules/vagas/vaga.repository.js'

// Empresas e vagas compartilham o mesmo "banco" porque vaga devolve o nome da empresa
export function createInMemoryCatalogo() {
  const empresasDb: EmpresaRecord[] = []
  const vagasDb: Omit<VagaRecord, 'empresa'>[] = []

  const contains = (texto: string, busca?: string) =>
    !busca || texto.toLowerCase().includes(busca.toLowerCase())

  const withEmpresa = (vaga: Omit<VagaRecord, 'empresa'>): VagaRecord => {
    const { id, nome } = empresasDb.find((e) => e.id === vaga.empresaId)!
    return { ...vaga, empresa: { id, nome } }
  }

  const empresas: EmpresaRepository = {
    list: async (busca) =>
      empresasDb
        .filter((e) => contains(e.nome, busca))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    findById: async (id) => empresasDb.find((e) => e.id === id) ?? null,
    create: async (data) => {
      const empresa = { id: randomUUID(), ...data }
      empresasDb.push(empresa)
      return empresa
    },
    update: async (id, data) => {
      const empresa = empresasDb.find((e) => e.id === id)!
      Object.assign(empresa, data)
      return empresa
    },
    delete: async (id) => {
      empresasDb.splice(
        empresasDb.findIndex((e) => e.id === id),
        1,
      )
    },
    countVagas: async (id) => vagasDb.filter((v) => v.empresaId === id).length,
  }

  const vagas: VagaRepository = {
    list: async (f) =>
      vagasDb
        .filter(
          (v) =>
            (!f.empresaId || v.empresaId === f.empresaId) &&
            (!f.modalidade || v.modalidade === f.modalidade) &&
            (!f.senioridade || v.senioridade === f.senioridade) &&
            contains(v.titulo, f.busca),
        )
        .map(withEmpresa),
    findById: async (id) => {
      const vaga = vagasDb.find((v) => v.id === id)
      return vaga ? withEmpresa(vaga) : null
    },
    create: async (data: VagaData) => {
      const vaga = { id: randomUUID(), criadoEm: new Date(), ...data }
      vagasDb.push(vaga)
      return withEmpresa(vaga)
    },
    update: async (id, data) => {
      const vaga = vagasDb.find((v) => v.id === id)!
      Object.assign(vaga, data)
      return withEmpresa(vaga)
    },
    delete: async (id) => {
      vagasDb.splice(
        vagasDb.findIndex((v) => v.id === id),
        1,
      )
    },
  }

  const candidaturasDb: Omit<CandidaturaRecord, 'vaga'>[] = []

  const withVaga = (candidatura: Omit<CandidaturaRecord, 'vaga'>): CandidaturaRecord => {
    const vaga = vagasDb.find((v) => v.id === candidatura.vagaId)!
    const { id, nome } = empresasDb.find((e) => e.id === vaga.empresaId)!
    return { ...candidatura, vaga: { id: vaga.id, titulo: vaga.titulo, empresa: { id, nome } } }
  }

  const candidaturas: CandidaturaRepository = {
    list: async (usuarioId, f) =>
      candidaturasDb
        .filter(
          (c) =>
            c.usuarioId === usuarioId &&
            (!f.status || c.status === f.status) &&
            (!f.vagaId || c.vagaId === f.vagaId),
        )
        .map(withVaga),
    findById: async (id, usuarioId) => {
      const c = candidaturasDb.find((c) => c.id === id && c.usuarioId === usuarioId)
      return c ? withVaga(c) : null
    },
    findByUsuarioVaga: async (usuarioId, vagaId) => {
      const c = candidaturasDb.find((c) => c.usuarioId === usuarioId && c.vagaId === vagaId)
      return c ? withVaga(c) : null
    },
    create: async (data) => {
      // Imita o índice único do banco (usuarioId + vagaId), que o Prisma reporta como P2002
      if (candidaturasDb.some((c) => c.usuarioId === data.usuarioId && c.vagaId === data.vagaId)) {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      }
      const candidatura = {
        id: randomUUID(),
        status: 'INTERESSE' as const,
        dataAplicacao: null,
        atualizadoEm: new Date(),
        ...data,
      }
      candidaturasDb.push(candidatura)
      return withVaga(candidatura)
    },
    update: async (id, data) => {
      const candidatura = candidaturasDb.find((c) => c.id === id)!
      Object.assign(candidatura, data, { atualizadoEm: new Date() })
      return withVaga(candidatura)
    },
    updateStatus: async (id, de, para) => {
      const candidatura = candidaturasDb.find((c) => c.id === id)
      if (!candidatura || candidatura.status !== de) return null
      Object.assign(candidatura, { status: para, atualizadoEm: new Date() })
      return withVaga(candidatura)
    },
    delete: async (id) => {
      candidaturasDb.splice(
        candidaturasDb.findIndex((c) => c.id === id),
        1,
      )
    },
  }

  return { empresas, vagas, candidaturas }
}
