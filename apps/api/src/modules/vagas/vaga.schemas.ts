import { z } from 'zod'

// Espelham os enums Modalidade e Senioridade do schema.prisma
export const MODALIDADES = ['REMOTO', 'HIBRIDO', 'PRESENCIAL'] as const
export const SENIORIDADES = ['ESTAGIO', 'JUNIOR', 'PLENO', 'SENIOR', 'ESPECIALISTA'] as const

export const vagaSchema = z.object({
  empresaId: z.uuid('empresaId inválido'),
  titulo: z.string().trim().min(2, 'Título deve ter pelo menos 2 caracteres'),
  descricao: z.string().trim().min(1, 'Descrição é obrigatória'),
  url: z.url('URL inválida').nullish(),
  modalidade: z.enum(MODALIDADES).nullish(),
  senioridade: z.enum(SENIORIDADES).nullish(),
})

export const listVagasQuerySchema = z.object({
  empresaId: z.uuid('empresaId inválido').optional(),
  modalidade: z.enum(MODALIDADES).optional(),
  senioridade: z.enum(SENIORIDADES).optional(),
  busca: z.string().trim().optional(),
})

export type VagaInput = z.infer<typeof vagaSchema>
export type VagaFiltros = z.infer<typeof listVagasQuerySchema>
