import { createRouter, createMemoryHistory } from 'vue-router'
import { installGuards, routes } from '@/router'
import { tokenStorage } from '@/services/token-storage'

export function jsonResponse(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

export const usuarioAna = { id: 'u1', nome: 'Ana Souza', email: 'ana@exemplo.com' }

export function logarComTokens(accessToken = 'access-1', refreshToken = 'refresh-1') {
  tokenStorage.set({ accessToken, refreshToken })
}

// Router igual ao da aplicação, mas com histórico em memória para rodar no jsdom
export function createTestRouter() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  installGuards(router)
  return router
}
