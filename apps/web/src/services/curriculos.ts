import { api } from './api'

export interface Curriculo {
  id: string
  conteudo: string
  ativo: boolean
  criadoEm: string
}

// Mesmo limite da API (curriculo.schemas.ts)
export const CURRICULO_MAX = 30_000

export const curriculosService = {
  list: () => api<Curriculo[]>('/curriculos'),
  create: (data: { conteudo: string; ativo?: boolean }) =>
    api<Curriculo>('/curriculos', { method: 'POST', body: data }),
  update: (id: string, data: { conteudo: string }) =>
    api<Curriculo>(`/curriculos/${id}`, { method: 'PUT', body: data }),
  activate: (id: string) => api<Curriculo>(`/curriculos/${id}/ativar`, { method: 'POST' }),
  remove: (id: string) => api<void>(`/curriculos/${id}`, { method: 'DELETE' }),
}
