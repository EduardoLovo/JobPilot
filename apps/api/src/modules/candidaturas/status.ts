// Espelha o enum StatusCandidatura do schema.prisma
export const STATUS = ['INTERESSE', 'APLICADO', 'ENTREVISTA', 'OFERTA', 'ENCERRADO'] as const

export type StatusCandidatura = (typeof STATUS)[number]

export const ROTULOS: Record<StatusCandidatura, string> = {
  INTERESSE: 'Interesse',
  APLICADO: 'Aplicado',
  ENTREVISTA: 'Entrevista',
  OFERTA: 'Oferta',
  ENCERRADO: 'Encerrado',
}

// Para onde cada status pode ir. O caminho normal avança uma etapa por vez; dá para voltar uma
// etapa (arrastar o card sem querer no kanban) e reabrir uma candidatura encerrada.
// Não pode pular etapas sem passar por elas (ex.: de INTERESSE direto para ENTREVISTA, já que
// ainda nem houve candidatura). OFERTA direto de APLICADO é permitido: acontece sem entrevista.
const TRANSICOES: Record<StatusCandidatura, readonly StatusCandidatura[]> = {
  INTERESSE: ['APLICADO', 'ENCERRADO'],
  APLICADO: ['INTERESSE', 'ENTREVISTA', 'OFERTA', 'ENCERRADO'],
  ENTREVISTA: ['APLICADO', 'OFERTA', 'ENCERRADO'],
  OFERTA: ['ENTREVISTA', 'ENCERRADO'],
  ENCERRADO: ['INTERESSE', 'APLICADO', 'ENTREVISTA'],
}

export function proximosStatus(de: StatusCandidatura) {
  return TRANSICOES[de]
}

export function podeMover(de: StatusCandidatura, para: StatusCandidatura) {
  return TRANSICOES[de].includes(para)
}
