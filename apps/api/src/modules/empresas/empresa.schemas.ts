import { z } from 'zod'

export const empresaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  site: z.url('URL inválida').nullish(),
})

export const listEmpresasQuerySchema = z.object({
  busca: z.string().trim().optional(),
})

export type EmpresaInput = z.infer<typeof empresaSchema>
