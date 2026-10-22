import { randomUUID } from 'node:crypto'
import type { UsuarioRecord, UsuarioRepository } from '../../src/modules/auth/usuario.repository.js'

export function createInMemoryUsuarioRepository() {
  const items: UsuarioRecord[] = []

  const repo: UsuarioRepository = {
    findByEmail: async (email) => items.find((u) => u.email === email) ?? null,
    findById: async (id) => items.find((u) => u.id === id) ?? null,
    create: async (data) => {
      const usuario = { id: randomUUID(), ...data }
      items.push(usuario)
      return usuario
    },
  }

  return { repo, items }
}
