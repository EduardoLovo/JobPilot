import { z } from 'zod'
import { STATUS } from './status.js'

const dia = z.iso.date('Data inválida (use AAAA-MM-DD)')

export const criarCandidaturaSchema = z.object({
  vagaId: z.uuid('vagaId inválido'),
  proximoFollowup: dia.nullish(),
})

// Só os campos enviados são alterados; null limpa a data
export const atualizarCandidaturaSchema = z
  .object({
    dataAplicacao: dia.nullable().optional(),
    proximoFollowup: dia.nullable().optional(),
  })
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo para alterar')

export const mudarStatusSchema = z.object({
  status: z.enum(STATUS, 'Status inválido'),
})

export const listCandidaturasQuerySchema = z.object({
  status: z.enum(STATUS, 'Status inválido').optional(),
  vagaId: z.uuid('vagaId inválido').optional(),
})

export type CriarCandidaturaInput = z.infer<typeof criarCandidaturaSchema>
export type AtualizarCandidaturaInput = z.infer<typeof atualizarCandidaturaSchema>
export type CandidaturaFiltros = z.infer<typeof listCandidaturasQuerySchema>
