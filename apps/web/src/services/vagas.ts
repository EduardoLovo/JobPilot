import { api } from './api'

export const MODALIDADES = {
  REMOTO: 'Remoto',
  HIBRIDO: 'Híbrido',
  PRESENCIAL: 'Presencial',
} as const

export const SENIORIDADES = {
  ESTAGIO: 'Estágio',
  JUNIOR: 'Júnior',
  PLENO: 'Pleno',
  SENIOR: 'Sênior',
  ESPECIALISTA: 'Especialista',
} as const

export type Modalidade = keyof typeof MODALIDADES
export type Senioridade = keyof typeof SENIORIDADES

export interface Empresa {
  id: string
  nome: string
  site: string | null
}

export interface Vaga {
  id: string
  empresaId: string
  titulo: string
  descricao: string
  url: string | null
  modalidade: Modalidade | null
  senioridade: Senioridade | null
  criadoEm: string
  empresa: { id: string; nome: string }
}

export interface VagaInput {
  empresaId: string
  titulo: string
  descricao: string
  url?: string | null
  modalidade?: Modalidade | null
  senioridade?: Senioridade | null
}

export interface VagaFiltros {
  modalidade?: Modalidade | ''
  senioridade?: Senioridade | ''
  busca?: string
}

// Só envia na query os filtros preenchidos
function toQuery(filtros: VagaFiltros) {
  const params = new URLSearchParams()
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) params.set(chave, valor)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const vagasService = {
  list: (filtros: VagaFiltros = {}) => api<Vaga[]>(`/vagas${toQuery(filtros)}`),
  get: (id: string) => api<Vaga>(`/vagas/${id}`),
  create: (data: VagaInput) => api<Vaga>('/vagas', { method: 'POST', body: data }),
  update: (id: string, data: VagaInput) => api<Vaga>(`/vagas/${id}`, { method: 'PUT', body: data }),
  remove: (id: string) => api<void>(`/vagas/${id}`, { method: 'DELETE' }),
}

export const empresasService = {
  list: () => api<Empresa[]>('/empresas'),
  create: (data: { nome: string; site?: string | null }) =>
    api<Empresa>('/empresas', { method: 'POST', body: data }),
}
