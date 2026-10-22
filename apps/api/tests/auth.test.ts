import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { createInMemoryUsuarioRepository } from './helpers/in-memory-usuario-repository.js'

const ana = { nome: 'Ana Souza', email: 'Ana@Exemplo.com', senha: 'senha-forte-123' }

describe('Auth', () => {
  let app: ReturnType<typeof createApp>
  let usuarios: ReturnType<typeof createInMemoryUsuarioRepository>

  beforeEach(() => {
    usuarios = createInMemoryUsuarioRepository()
    app = createApp({ usuarios: usuarios.repo })
  })

  const register = (body: object = ana) => request(app).post('/auth/register').send(body)

  describe('POST /auth/register', () => {
    it('cria o usuário e devolve tokens, sem expor a senha', async () => {
      const res = await register()

      expect(res.status).toBe(201)
      expect(res.body.usuario).toEqual({
        id: expect.any(String),
        nome: 'Ana Souza',
        email: 'ana@exemplo.com',
      })
      expect(res.body.accessToken).toEqual(expect.any(String))
      expect(res.body.refreshToken).toEqual(expect.any(String))
      expect(JSON.stringify(res.body)).not.toContain('senha')
    })

    it('guarda a senha como hash bcrypt', async () => {
      await register()

      const salvo = usuarios.items[0]
      expect(salvo.senhaHash).not.toBe(ana.senha)
      expect(salvo.senhaHash).toMatch(/^\$2[aby]\$10\$/)
    })

    it('recusa e-mail já cadastrado, ignorando maiúsculas', async () => {
      await register()
      const res = await register({ ...ana, email: 'ANA@exemplo.com' })

      expect(res.status).toBe(409)
      expect(res.body.erro).toBe('E-mail já cadastrado')
    })

    it('valida os campos', async () => {
      const res = await register({ nome: 'A', email: 'invalido', senha: '123' })

      expect(res.status).toBe(400)
      expect(res.body.detalhes.map((d: { campo: string }) => d.campo).sort()).toEqual([
        'email',
        'nome',
        'senha',
      ])
    })
  })

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await register()
    })

    it('autentica com e-mail e senha corretos', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'ana@exemplo.com', senha: ana.senha })

      expect(res.status).toBe(200)
      expect(res.body.usuario.email).toBe('ana@exemplo.com')
      expect(res.body.accessToken).toEqual(expect.any(String))
    })

    it('recusa senha errada com mensagem genérica', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'ana@exemplo.com', senha: 'errada' })

      expect(res.status).toBe(401)
      expect(res.body.erro).toBe('E-mail ou senha inválidos')
    })

    it('recusa e-mail inexistente com a mesma mensagem', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'ninguem@exemplo.com', senha: ana.senha })

      expect(res.status).toBe(401)
      expect(res.body.erro).toBe('E-mail ou senha inválidos')
    })
  })

  describe('GET /auth/me', () => {
    it('devolve o usuário do access token', async () => {
      const { body } = await register()

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual(body.usuario)
    })

    it('recusa requisição sem token', async () => {
      const res = await request(app).get('/auth/me')

      expect(res.status).toBe(401)
    })

    it('recusa refresh token no lugar do access token', async () => {
      const { body } = await register()

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.refreshToken}`)

      expect(res.status).toBe(401)
    })
  })

  describe('POST /auth/refresh', () => {
    it('troca o refresh token por um novo par de tokens', async () => {
      const { body } = await register()

      const res = await request(app).post('/auth/refresh').send({ refreshToken: body.refreshToken })

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toEqual(expect.any(String))
      const me = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
      expect(me.status).toBe(200)
    })

    it('recusa access token no lugar do refresh token', async () => {
      const { body } = await register()

      const res = await request(app).post('/auth/refresh').send({ refreshToken: body.accessToken })

      expect(res.status).toBe(401)
    })
  })
})
