import { randomUUID } from 'node:crypto'
import type {
  CurriculoRecord,
  CurriculoRepository,
} from '../../src/modules/curriculos/curriculo.repository.js'

export function createInMemoryCurriculos() {
  const db: CurriculoRecord[] = []

  const desativarOutros = (usuarioId: string, exceto?: string) => {
    for (const c of db) {
      if (c.usuarioId === usuarioId && c.id !== exceto) c.ativo = false
    }
  }

  const repo: CurriculoRepository = {
    // Mais recente primeiro (a ordem de inserção desempata o mesmo milissegundo)
    list: async (usuarioId) => db.filter((c) => c.usuarioId === usuarioId).reverse(),
    findById: async (id, usuarioId) =>
      db.find((c) => c.id === id && c.usuarioId === usuarioId) ?? null,
    findAtivo: async (usuarioId) => db.find((c) => c.usuarioId === usuarioId && c.ativo) ?? null,
    count: async (usuarioId) => db.filter((c) => c.usuarioId === usuarioId).length,
    create: async ({ usuarioId, conteudo, ativo }) => {
      if (ativo) desativarOutros(usuarioId)
      const curriculo = { id: randomUUID(), usuarioId, conteudo, ativo, criadoEm: new Date() }
      db.push(curriculo)
      return curriculo
    },
    update: async (id, data) => {
      const curriculo = db.find((c) => c.id === id)!
      curriculo.conteudo = data.conteudo
      return curriculo
    },
    activate: async (id, usuarioId) => {
      desativarOutros(usuarioId, id)
      const curriculo = db.find((c) => c.id === id)!
      curriculo.ativo = true
      return curriculo
    },
    delete: async (id) => {
      db.splice(
        db.findIndex((c) => c.id === id),
        1,
      )
    },
  }

  return { repo, db }
}
