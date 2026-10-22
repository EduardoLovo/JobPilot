import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { cadastrar, createIntegrationApp, prisma, resetDatabase } from './helpers.js'

const app = createIntegrationApp()

describe('Empresas e vagas (API + Prisma + Postgres)', () => {
  let auth: Record<string, string>

  beforeEach(async () => {
    await resetDatabase()
    ;({ auth } = await cadastrar(app))
  })
  afterAll(() => prisma.$disconnect())

  const criarEmpresa = async (nome: string) =>
    (await request(app).post('/empresas').set(auth).send({ nome })).body as { id: string }

  const vagaBase = (empresaId: string) => ({
    empresaId,
    titulo: 'Desenvolvedora Vue',
    descricao: 'Front-end com Vue 3 e TypeScript',
    modalidade: 'REMOTO',
    senioridade: 'JUNIOR',
  })

  describe('empresas', () => {
    it('cria, lê, edita e remove uma empresa no banco', async () => {
      const criada = await request(app)
        .post('/empresas')
        .set(auth)
        .send({ nome: 'Nubank', site: 'https://nubank.com.br' })
      expect(criada.status).toBe(201)
      expect(await prisma.empresa.count()).toBe(1)

      const id = criada.body.id
      const editada = await request(app)
        .put(`/empresas/${id}`)
        .set(auth)
        .send({ nome: 'Nu Pagamentos' })
      expect(editada.body).toMatchObject({ nome: 'Nu Pagamentos', site: null })
      expect((await prisma.empresa.findUniqueOrThrow({ where: { id } })).nome).toBe('Nu Pagamentos')

      const removida = await request(app).delete(`/empresas/${id}`).set(auth)
      expect(removida.status).toBe(204)
      expect(await prisma.empresa.count()).toBe(0)
    })

    it('busca pelo nome sem diferenciar maiúsculas de minúsculas', async () => {
      await criarEmpresa('Nubank')
      await criarEmpresa('Stone')

      const res = await request(app).get('/empresas?busca=NUBA').set(auth)

      expect(res.body.map((e: { nome: string }) => e.nome)).toEqual(['Nubank'])
    })

    it('lista em ordem alfabética sem diferenciar maiúsculas de minúsculas', async () => {
      await criarEmpresa('Stone')
      await criarEmpresa('iFood')
      await criarEmpresa('Nubank')

      const res = await request(app).get('/empresas').set(auth)

      expect(res.body.map((e: { nome: string }) => e.nome)).toEqual(['iFood', 'Nubank', 'Stone'])
    })
  })

  describe('vagas', () => {
    it('grava a vaga com enums e devolve o nome da empresa', async () => {
      const { id: empresaId } = await criarEmpresa('Nubank')

      const res = await request(app).post('/vagas').set(auth).send(vagaBase(empresaId))

      expect(res.status).toBe(201)
      expect(res.body.empresa).toEqual({ id: empresaId, nome: 'Nubank' })

      const salva = await prisma.vaga.findUniqueOrThrow({ where: { id: res.body.id } })
      expect(salva).toMatchObject({ modalidade: 'REMOTO', senioridade: 'JUNIOR', url: null })
    })

    it('recusa empresa que não existe, sem gravar nada', async () => {
      const res = await request(app)
        .post('/vagas')
        .set(auth)
        .send(vagaBase('00000000-0000-4000-8000-000000000000'))

      expect(res.status).toBe(400)
      expect(await prisma.vaga.count()).toBe(0)
    })

    it('combina filtros de empresa, modalidade, senioridade e busca no título', async () => {
      const nubank = await criarEmpresa('Nubank')
      const stone = await criarEmpresa('Stone')
      const criar = (dados: object) => request(app).post('/vagas').set(auth).send(dados)
      await criar(vagaBase(nubank.id))
      await criar({
        ...vagaBase(nubank.id),
        titulo: 'Dev Node',
        modalidade: 'HIBRIDO',
        senioridade: 'PLENO',
      })
      await criar({ ...vagaBase(stone.id), titulo: 'DEV VUE SÊNIOR', senioridade: 'SENIOR' })

      const titulos = async (query: string) =>
        (await request(app).get(`/vagas?${query}`).set(auth)).body
          .map((v: { titulo: string }) => v.titulo)
          .sort()

      expect(await titulos('modalidade=HIBRIDO')).toEqual(['Dev Node'])
      expect(await titulos(`empresaId=${stone.id}`)).toEqual(['DEV VUE SÊNIOR'])
      expect(await titulos('busca=vue')).toEqual(['DEV VUE SÊNIOR', 'Desenvolvedora Vue'])
      expect(await titulos(`empresaId=${nubank.id}&senioridade=PLENO&modalidade=HIBRIDO`)).toEqual([
        'Dev Node',
      ])
    })

    it('limpa os campos opcionais ao editar com valores vazios', async () => {
      const { id: empresaId } = await criarEmpresa('Nubank')
      const { body: vaga } = await request(app)
        .post('/vagas')
        .set(auth)
        .send({ ...vagaBase(empresaId), url: 'https://nubank.com.br/vagas/1' })

      const res = await request(app)
        .put(`/vagas/${vaga.id}`)
        .set(auth)
        .send({ empresaId, titulo: 'Dev Vue', descricao: 'Nova descrição' })

      expect(res.body).toMatchObject({ url: null, modalidade: null, senioridade: null })
    })

    it('não deixa remover empresa com vagas e libera depois que as vagas saem', async () => {
      const { id: empresaId } = await criarEmpresa('Nubank')
      const { body: vaga } = await request(app).post('/vagas').set(auth).send(vagaBase(empresaId))

      const bloqueada = await request(app).delete(`/empresas/${empresaId}`).set(auth)
      expect(bloqueada.status).toBe(409)
      expect(await prisma.empresa.count()).toBe(1)

      await request(app).delete(`/vagas/${vaga.id}`).set(auth)
      const liberada = await request(app).delete(`/empresas/${empresaId}`).set(auth)

      expect(liberada.status).toBe(204)
      expect(await prisma.empresa.count()).toBe(0)
    })
  })

  it('exige login em todas as rotas', async () => {
    const rotas = ['/empresas', '/vagas']

    for (const rota of rotas) {
      expect((await request(app).get(rota)).status).toBe(401)
    }
  })
})
