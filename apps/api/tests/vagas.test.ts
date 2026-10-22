import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { authHeader, createTestApp } from './helpers/test-app.js'

const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000'

describe('Vagas', () => {
  let app: ReturnType<typeof createTestApp>['app']
  let auth: Record<string, string>
  let nubankId: string

  beforeEach(async () => {
    ;({ app } = createTestApp())
    auth = await authHeader(app)
    const res = await request(app).post('/empresas').set(auth).send({ nome: 'Nubank' })
    nubankId = res.body.id
  })

  const vagaVue = () => ({
    empresaId: nubankId,
    titulo: 'Desenvolvedora Vue',
    descricao: 'Front-end com Vue 3 e TypeScript',
    url: 'https://nubank.com.br/vagas/123',
    modalidade: 'REMOTO',
    senioridade: 'JUNIOR',
  })

  const criar = (body: object) => request(app).post('/vagas').set(auth).send(body)

  it('exige login', async () => {
    const res = await request(app).get('/vagas')

    expect(res.status).toBe(401)
  })

  it('cria vaga vinculada à empresa e devolve o nome da empresa', async () => {
    const res = await criar(vagaVue())

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      id: expect.any(String),
      titulo: 'Desenvolvedora Vue',
      modalidade: 'REMOTO',
      senioridade: 'JUNIOR',
      empresa: { id: nubankId, nome: 'Nubank' },
    })
  })

  it('aceita vaga só com os campos obrigatórios', async () => {
    const res = await criar({ empresaId: nubankId, titulo: 'Dev Node', descricao: 'Back-end' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ url: null, modalidade: null, senioridade: null })
  })

  it('recusa empresa inexistente', async () => {
    const res = await criar({ ...vagaVue(), empresaId: ID_INEXISTENTE })

    expect(res.status).toBe(400)
    expect(res.body.erro).toBe('Empresa informada não existe')
  })

  it('valida os campos e os valores de modalidade e senioridade', async () => {
    const res = await criar({ empresaId: nubankId, titulo: '', descricao: '', modalidade: 'LUA' })

    expect(res.status).toBe(400)
    expect(res.body.detalhes.map((d: { campo: string }) => d.campo).sort()).toEqual([
      'descricao',
      'modalidade',
      'titulo',
    ])
  })

  it('filtra por modalidade, senioridade, empresa e busca no título', async () => {
    const { body: stone } = await request(app).post('/empresas').set(auth).send({ nome: 'Stone' })
    await criar(vagaVue())
    await criar({
      ...vagaVue(),
      titulo: 'Dev Node Pleno',
      modalidade: 'HIBRIDO',
      senioridade: 'PLENO',
    })
    await criar({
      ...vagaVue(),
      empresaId: stone.id,
      titulo: 'Dev Vue Sênior',
      senioridade: 'SENIOR',
    })

    const titulos = async (query: string) =>
      (await request(app).get(`/vagas?${query}`).set(auth)).body.map(
        (v: { titulo: string }) => v.titulo,
      )

    expect(await titulos('modalidade=HIBRIDO')).toEqual(['Dev Node Pleno'])
    expect(await titulos('senioridade=SENIOR')).toEqual(['Dev Vue Sênior'])
    expect(await titulos(`empresaId=${stone.id}`)).toEqual(['Dev Vue Sênior'])
    expect((await titulos('busca=vue')).sort()).toEqual(['Desenvolvedora Vue', 'Dev Vue Sênior'])
  })

  it('recusa filtro com valor inválido', async () => {
    const res = await request(app).get('/vagas?modalidade=LUA').set(auth)

    expect(res.status).toBe(400)
  })

  it('busca por id e devolve 404 quando não existe', async () => {
    const { body: criada } = await criar(vagaVue())

    const res = await request(app).get(`/vagas/${criada.id}`).set(auth)
    expect(res.body.titulo).toBe('Desenvolvedora Vue')

    const inexistente = await request(app).get(`/vagas/${ID_INEXISTENTE}`).set(auth)
    expect(inexistente.status).toBe(404)
  })

  it('atualiza a vaga', async () => {
    const { body: criada } = await criar(vagaVue())

    const res = await request(app)
      .put(`/vagas/${criada.id}`)
      .set(auth)
      .send({ ...vagaVue(), titulo: 'Desenvolvedora Vue Pleno', senioridade: 'PLENO' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ titulo: 'Desenvolvedora Vue Pleno', senioridade: 'PLENO' })
  })

  it('remove a vaga', async () => {
    const { body: criada } = await criar(vagaVue())

    const res = await request(app).delete(`/vagas/${criada.id}`).set(auth)
    expect(res.status).toBe(204)

    const depois = await request(app).get(`/vagas/${criada.id}`).set(auth)
    expect(depois.status).toBe(404)
  })
})
