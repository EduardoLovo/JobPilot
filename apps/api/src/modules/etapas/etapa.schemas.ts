import { z } from 'zod'

// Espelha o enum TipoEtapa do schema.prisma
export const TIPOS = [
  'TRIAGEM',
  'ENTREVISTA_RH',
  'ENTREVISTA_TECNICA',
  'TESTE_TECNICO',
  'PROPOSTA',
  'OUTRO',
] as const

export type TipoEtapa = (typeof TIPOS)[number]

export const etapaSchema = z.object({
  tipo: z.enum(TIPOS, 'Tipo de etapa inválido'),
  // Um instante com fuso (ex.: 2026-11-05T14:00:00-03:00 ou ...Z), para a hora não mudar com o servidor
  data: z.iso.datetime({ offset: true, error: 'Data inválida (use o formato ISO 8601 com fuso)' }),
  anotacoes: z
    .string()
    .trim()
    .max(5000, 'As anotações devem ter no máximo 5.000 caracteres')
    .nullish(),
})

export const etapaParamsSchema = z.object({
  candidaturaId: z.uuid('ID da candidatura inválido'),
})

export const etapaIdParamsSchema = etapaParamsSchema.extend({
  etapaId: z.uuid('ID da etapa inválido'),
})

export type EtapaInput = z.infer<typeof etapaSchema>
