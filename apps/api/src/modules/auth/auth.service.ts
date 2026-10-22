import bcrypt from 'bcryptjs'
import type { z } from 'zod'
import { AppError } from '../../errors/app-error.js'
import type { loginSchema, registerSchema } from './auth.schemas.js'
import { generateTokens, verifyToken } from './tokens.js'
import type { UsuarioRecord, UsuarioRepository } from './usuario.repository.js'

const SALT_ROUNDS = 10

// Nunca devolve o hash da senha para o cliente
function toPublic({ id, nome, email }: UsuarioRecord) {
  return { id, nome, email }
}

export function createAuthService(usuarios: UsuarioRepository) {
  return {
    async register(data: z.infer<typeof registerSchema>) {
      if (await usuarios.findByEmail(data.email)) {
        throw new AppError(409, 'E-mail já cadastrado')
      }

      const usuario = await usuarios.create({
        nome: data.nome,
        email: data.email,
        senhaHash: await bcrypt.hash(data.senha, SALT_ROUNDS),
      })

      return { usuario: toPublic(usuario), ...generateTokens(usuario.id) }
    },

    async login(data: z.infer<typeof loginSchema>) {
      const usuario = await usuarios.findByEmail(data.email)

      // Mesma mensagem para e-mail inexistente e senha errada, para não revelar quem tem conta
      if (!usuario || !(await bcrypt.compare(data.senha, usuario.senhaHash))) {
        throw new AppError(401, 'E-mail ou senha inválidos')
      }

      return { usuario: toPublic(usuario), ...generateTokens(usuario.id) }
    },

    async refresh(refreshToken: string) {
      const usuario = await usuarios.findById(verifyToken(refreshToken, 'refresh'))
      if (!usuario) throw new AppError(401, 'Token inválido ou expirado')

      return generateTokens(usuario.id)
    },

    async me(usuarioId: string) {
      const usuario = await usuarios.findById(usuarioId)
      if (!usuario) throw new AppError(404, 'Usuário não encontrado')

      return toPublic(usuario)
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
