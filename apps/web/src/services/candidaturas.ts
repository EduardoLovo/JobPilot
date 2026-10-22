import { api } from './api'

// A ordem aqui é a ordem das colunas do kanban
export const STATUS = ['INTERESSE', 'APLICADO', 'ENTREVISTA', 'OFERTA', 'ENCERRADO'] as const

export type StatusCandidatura = (typeof STATUS)[number]

export const ROTULOS: Record<StatusCandidatura, string> = {
  INTERESSE: 'Interesse',
  APLICADO: 'Aplicado',
  ENTREVISTA: 'Entrevista',
  OFERTA: 'Oferta',
  ENCERRADO: 'Encerrado',
}

export interface Candidatura {
  id: string
  vagaId: string
  status: StatusCandidatura
  dataAplicacao: string | null
  proximoFollowup: string | null
  atualizadoEm: string
  vaga: { id: string; titulo: string; empresa: { id: string; nome: string } }
  // Para onde a API aceita mover esta candidatura; o kanban só deixa soltar nessas colunas
  proximosStatus: StatusCandidatura[]
}

export const candidaturasService = {
  list: () => api<Candidatura[]>('/candidaturas'),
  create: (data: { vagaId: string; proximoFollowup?: string | null }) =>
    api<Candidatura>('/candidaturas', { method: 'POST', body: data }),
  changeStatus: (id: string, status: StatusCandidatura) =>
    api<Candidatura>(`/candidaturas/${id}/status`, { method: 'PATCH', body: { status } }),
  remove: (id: string) => api<void>(`/candidaturas/${id}`, { method: 'DELETE' }),
}
