import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ana, cadastrar, createIntegrationApp, prisma, resetDatabase } from './helpers.js'

const app = createIntegrationApp()

describe('Auth (API + Prisma + Postgres)', () => {
  beforeEach(resetDatabase)
  afterAll(() => prisma.$disconnect())

  it('grava o usuário no banco com e-mail em minúsculas e senha com hash bcrypt', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...ana, email: 'Ana@Exemplo.com' })

    expect(res.status).toBe(201)

    const salvo = await prisma.usuario.findUniqueOrThrow({ where: { id: res.body.usuario.id } })
    expect(salvo.email).toBe('ana@exemplo.com')
    expect(salvo.senhaHash).toMatch(/^\$2[aby]\$10\$/)
    expect(salvo.senhaHash).not.toContain(ana.senha)
  })

  it('recusa e-mail repetido sem criar um segundo usuário', async () => {
    await cadastrar(app)

    const res = await request(app)
      .post('/auth/register')
      .send({ ...ana, email: 'ANA@exemplo.com' })

    expect(res.status).toBe(409)
    expect(await prisma.usuario.count()).toBe(1)
  })

  it('o banco também impede e-mail duplicado, mesmo fora da API', async () => {
    await cadastrar(app)

    await expect(
      prisma.usuario.create({ data: { nome: 'Outra Ana', email: ana.email, senhaHash: 'x' } }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('percorre o fluxo completo: login, me e renovação de tokens', async () => {
    const { usuario, refreshToken } = await cadastrar(app)

    const login = await request(app)
      .post('/auth/login')
      .send({ email: ana.email, senha: ana.senha })
    expect(login.status).toBe(200)
    expect(login.body.usuario.id).toBe(usuario.id)

    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
    expect(me.body).toEqual(usuario)

    const renovado = await request(app).post('/auth/refresh').send({ refreshToken })
    expect(renovado.status).toBe(200)

    const meDeNovo = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${renovado.body.accessToken}`)
    expect(meDeNovo.status).toBe(200)
  })

  it('recusa login com senha errada e com e-mail inexistente', async () => {
    await cadastrar(app)

    const senhaErrada = await request(app)
      .post('/auth/login')
      .send({ email: ana.email, senha: 'errada' })
    const semConta = await request(app)
      .post('/auth/login')
      .send({ email: 'ninguem@exemplo.com', senha: ana.senha })

    expect(senhaErrada.status).toBe(401)
    expect(semConta.status).toBe(401)
    expect(semConta.body).toEqual(senhaErrada.body)
  })

  it('recusa token de um usuário que foi apagado do banco', async () => {
    const { usuario, auth } = await cadastrar(app)
    await prisma.usuario.delete({ where: { id: usuario.id } })

    const res = await request(app).get('/auth/me').set(auth)

    expect(res.status).toBe(404)
  })
})
