import { randomUUID } from 'node:crypto'
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

  return { empresas, vagas }
}
