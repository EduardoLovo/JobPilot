import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { authHeader, createTestApp } from './helpers/test-app.js'

const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000'

describe('Empresas', () => {
  let app: ReturnType<typeof createTestApp>['app']
  let auth: Record<string, string>

  beforeEach(async () => {
    ;({ app } = createTestApp())
    auth = await authHeader(app)
  })

  const criar = (body: object) => request(app).post('/empresas').set(auth).send(body)

  it('exige login', async () => {
    const res = await request(app).get('/empresas')

    expect(res.status).toBe(401)
  })

  it('cria empresa com site opcional', async () => {
    const res = await criar({ nome: '  Nubank ', site: 'https://nubank.com.br' })

    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      id: expect.any(String),
      nome: 'Nubank',
      site: 'https://nubank.com.br',
    })

    const semSite = await criar({ nome: 'Stone' })
    expect(semSite.body.site).toBeNull()
  })

  it('valida nome e site', async () => {
    const res = await criar({ nome: 'N', site: 'nao-e-url' })

    expect(res.status).toBe(400)
    expect(res.body.detalhes.map((d: { campo: string }) => d.campo).sort()).toEqual([
      'nome',
      'site',
    ])
  })

  it('lista em ordem alfabética e filtra pela busca', async () => {
    await criar({ nome: 'Stone' })
    await criar({ nome: 'iFood' })
    await criar({ nome: 'Nubank' })

    const todas = await request(app).get('/empresas').set(auth)
    expect(todas.body.map((e: { nome: string }) => e.nome)).toEqual(['iFood', 'Nubank', 'Stone'])

    const busca = await request(app).get('/empresas?busca=NU').set(auth)
    expect(busca.body.map((e: { nome: string }) => e.nome)).toEqual(['Nubank'])
  })

  it('busca por id e devolve 404 quando não existe', async () => {
    const { body: criada } = await criar({ nome: 'Nubank' })

    const res = await request(app).get(`/empresas/${criada.id}`).set(auth)
    expect(res.body).toEqual(criada)

    const inexistente = await request(app).get(`/empresas/${ID_INEXISTENTE}`).set(auth)
    expect(inexistente.status).toBe(404)
  })

  it('recusa id que não é UUID', async () => {
    const res = await request(app).get('/empresas/123').set(auth)

    expect(res.status).toBe(400)
  })

  it('atualiza a empresa', async () => {
    const { body: criada } = await criar({ nome: 'Nubank' })

    const res = await request(app)
      .put(`/empresas/${criada.id}`)
      .set(auth)
      .send({ nome: 'Nu Pagamentos', site: 'https://nubank.com.br' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      id: criada.id,
      nome: 'Nu Pagamentos',
      site: 'https://nubank.com.br',
    })
  })

  it('remove empresa sem vagas', async () => {
    const { body: criada } = await criar({ nome: 'Nubank' })

    const res = await request(app).delete(`/empresas/${criada.id}`).set(auth)
    expect(res.status).toBe(204)

    const depois = await request(app).get(`/empresas/${criada.id}`).set(auth)
    expect(depois.status).toBe(404)
  })

  it('não remove empresa que tem vagas', async () => {
    const { body: criada } = await criar({ nome: 'Nubank' })
    await request(app)
      .post('/vagas')
      .set(auth)
      .send({ empresaId: criada.id, titulo: 'Dev Vue', descricao: 'Vaga front-end' })

    const res = await request(app).delete(`/empresas/${criada.id}`).set(auth)

    expect(res.status).toBe(409)
  })
})
