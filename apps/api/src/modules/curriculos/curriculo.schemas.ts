import { z } from 'zod'

const conteudo = z
  .string()
  .trim()
  .min(30, 'O currículo deve ter pelo menos 30 caracteres')
  .max(30_000, 'O currículo deve ter no máximo 30.000 caracteres')

export const editarCurriculoSchema = z.object({ conteudo })

export const criarCurriculoSchema = z.object({
  conteudo,
  // Omitido: o currículo só vira o ativo se for o primeiro da pessoa
  ativo: z.boolean().optional(),
})

export type EditarCurriculoInput = z.infer<typeof editarCurriculoSchema>
export type CriarCurriculoInput = z.infer<typeof criarCurriculoSchema>
