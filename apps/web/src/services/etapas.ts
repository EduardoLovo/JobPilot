import { api } from './api'

export const TIPOS_ETAPA = {
  TRIAGEM: 'Triagem',
  ENTREVISTA_RH: 'Entrevista com RH',
  ENTREVISTA_TECNICA: 'Entrevista técnica',
  TESTE_TECNICO: 'Teste técnico',
  PROPOSTA: 'Proposta',
  OUTRO: 'Outro',
} as const

export type TipoEtapa = keyof typeof TIPOS_ETAPA

export interface Etapa {
  id: string
  candidaturaId: string
  tipo: TipoEtapa
  // Instante em UTC (ISO 8601)
  data: string
  anotacoes: string | null
}

export interface EtapaInput {
  tipo: TipoEtapa
  data: string
  anotacoes?: string | null
}

const base = (candidaturaId: string) => `/candidaturas/${candidaturaId}/etapas`

export const etapasService = {
  list: (candidaturaId: string) => api<Etapa[]>(base(candidaturaId)),
  create: (candidaturaId: string, data: EtapaInput) =>
    api<Etapa>(base(candidaturaId), { method: 'POST', body: data }),
  update: (candidaturaId: string, id: string, data: EtapaInput) =>
    api<Etapa>(`${base(candidaturaId)}/${id}`, { method: 'PUT', body: data }),
  remove: (candidaturaId: string, id: string) =>
    api<void>(`${base(candidaturaId)}/${id}`, { method: 'DELETE' }),
}
