import { z } from 'zod'

const email = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'))

export const registerSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email,
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

export const loginSchema = z.object({
  email,
  senha: z.string().min(1, 'Senha é obrigatória'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken é obrigatório'),
})
