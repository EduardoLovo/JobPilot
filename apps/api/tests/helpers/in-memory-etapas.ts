import { randomUUID } from 'node:crypto'
import type { EtapaRecord, EtapaRepository } from '../../src/modules/etapas/etapa.repository.js'

export function createInMemoryEtapas() {
  const db: EtapaRecord[] = []

  const repo: EtapaRepository = {
    // Cronológica, como no banco; o id desempata o mesmo instante
    list: async (candidaturaId) =>
      db
        .filter((e) => e.candidaturaId === candidaturaId)
        .sort((a, b) => a.data.getTime() - b.data.getTime() || a.id.localeCompare(b.id)),
    findById: async (id, candidaturaId) =>
      db.find((e) => e.id === id && e.candidaturaId === candidaturaId) ?? null,
    create: async (candidaturaId, data) => {
      const etapa = { id: randomUUID(), candidaturaId, ...data }
      db.push(etapa)
      return etapa
    },
    update: async (id, data) => {
      const etapa = db.find((e) => e.id === id)!
      Object.assign(etapa, data)
      return etapa
    },
    delete: async (id) => {
      db.splice(
        db.findIndex((e) => e.id === id),
        1,
      )
    },
  }

  return { repo, db }
}
