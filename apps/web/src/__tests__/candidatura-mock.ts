import type { Candidatura, StatusCandidatura } from '@/services/candidaturas'

// Para onde a API deixa mover cada status (mesma tabela do status.ts da API)
export const PROXIMOS: Record<StatusCandidatura, StatusCandidatura[]> = {
  INTERESSE: ['APLICADO', 'ENCERRADO'],
  APLICADO: ['INTERESSE', 'ENTREVISTA', 'OFERTA', 'ENCERRADO'],
  ENTREVISTA: ['APLICADO', 'OFERTA', 'ENCERRADO'],
  OFERTA: ['ENTREVISTA', 'ENCERRADO'],
  ENCERRADO: ['INTERESSE', 'APLICADO', 'ENTREVISTA'],
}

export function candidaturaDe(overrides: Partial<Candidatura> = {}): Candidatura {
  const status = overrides.status ?? 'INTERESSE'
  return {
    id: 'c1',
    vagaId: 'v1',
    status,
    dataAplicacao: null,
    proximoFollowup: null,
    atualizadoEm: '2026-10-22T12:00:00.000Z',
    vaga: { id: 'v1', titulo: 'Desenvolvedora Vue', empresa: { id: 'e1', nome: 'Nubank' } },
    proximosStatus: PROXIMOS[status],
    ...overrides,
  }
}
