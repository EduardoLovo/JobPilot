import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { bia, cadastrar, createIntegrationApp, prisma, resetDatabase } from './helpers.js'

const app = createIntegrationApp()

const texto = (versao: string) =>
  `Ana Souza, desenvolvedora front-end com Vue 3 e TypeScript. Versão ${versao}.`

describe('Currículos (API + Prisma + Postgres)', () => {
  let auth: Record<string, string>
  let usuarioId: string

  beforeEach(async () => {
    await resetDatabase()
    ;({
      auth,
      usuario: { id: usuarioId },
    } = await cadastrar(app))
  })
  afterAll(() => prisma.$disconnect())

  const criar = (versao: string, extra: object = {}, headers = auth) =>
    request(app)
      .post('/curriculos')
      .set(headers)
      .send({ conteudo: texto(versao), ...extra })

  const ativar = (id: string) => request(app).post(`/curriculos/${id}/ativar`).set(auth)

  const quantosAtivos = (dono = usuarioId) =>
    prisma.curriculo.count({ where: { usuarioId: dono, ativo: true } })

  it('grava o primeiro currículo como ativo e os seguintes como inativos', async () => {
    const primeiro = await criar('1')
    const segundo = await criar('2')

    expect(primeiro.body.ativo).toBe(true)
    expect(segundo.body.ativo).toBe(false)

    const noBanco = await prisma.curriculo.findMany({ where: { usuarioId } })
    expect(noBanco).toHaveLength(2)
    expect(await quantosAtivos()).toBe(1)
  })

  it('mantém exatamente um ativo depois de criar e trocar várias vezes', async () => {
    const { body: a } = await criar('1')
    const { body: b } = await criar('2')
    await criar('3', { ativo: true })
    await ativar(a.id)
    await ativar(b.id)
    await criar('4', { ativo: true })

    expect(await quantosAtivos()).toBe(1)
    const ativo = await request(app).get('/curriculos/ativo').set(auth)
    expect(ativo.body.conteudo).toBe(texto('4'))
  })

  describe('índice único parcial', () => {
    it('o banco recusa dois currículos ativos da mesma pessoa, mesmo fora da API', async () => {
      await criar('1')

      await expect(
        prisma.curriculo.create({ data: { usuarioId, conteudo: texto('x'), ativo: true } }),
      ).rejects.toMatchObject({ code: 'P2002' })
    })

    it('aceita quantos currículos inativos a pessoa quiser', async () => {
      await criar('1')

      await expect(
        prisma.curriculo.createMany({
          data: [
            { usuarioId, conteudo: texto('a'), ativo: false },
            { usuarioId, conteudo: texto('b'), ativo: false },
            { usuarioId, conteudo: texto('c'), ativo: false },
          ],
        }),
      ).resolves.toMatchObject({ count: 3 })
    })

    it('cada pessoa pode ter o seu currículo ativo', async () => {
      const { auth: authBia, usuario: daBia } = await cadastrar(app, bia)

      await criar('da Ana')
      await criar('da Bia', {}, authBia)

      expect(await quantosAtivos()).toBe(1)
      expect(await quantosAtivos(daBia.id)).toBe(1)
    })
  })

  describe('requisições simultâneas', () => {
    it('três criações ativas ao mesmo tempo: sem erro 500 e um único ativo no fim', async () => {
      const respostas = await Promise.all([
        criar('1', { ativo: true }),
        criar('2', { ativo: true }),
        criar('3', { ativo: true }),
      ])

      const status = respostas.map((r) => r.status)
      expect(status.every((s) => s === 201 || s === 409)).toBe(true)
      expect(status).toContain(201)
      expect(await quantosAtivos()).toBe(1)
    })

    it('duas trocas de currículo ao mesmo tempo: sem erro 500 e um único ativo no fim', async () => {
      await criar('1')
      const { body: b } = await criar('2')
      const { body: c } = await criar('3')

      const respostas = await Promise.all([ativar(b.id), ativar(c.id)])

      const status = respostas.map((r) => r.status)
      expect(status.every((s) => s === 200 || s === 409)).toBe(true)
      expect(await quantosAtivos()).toBe(1)
    })
  })

  describe('isolamento e remoção', () => {
    it('cada pessoa vê e mexe só nos próprios currículos', async () => {
      const { auth: authBia } = await cadastrar(app, bia)
      const { body: daAna } = await criar('da Ana')

      const lista = await request(app).get('/curriculos').set(authBia)
      const ver = await request(app).get(`/curriculos/${daAna.id}`).set(authBia)
      const editar = await request(app)
        .put(`/curriculos/${daAna.id}`)
        .set(authBia)
        .send({ conteudo: texto('invasão') })
      const apagar = await request(app).delete(`/curriculos/${daAna.id}`).set(authBia)

      expect(lista.body).toEqual([])
      expect([ver.status, editar.status, apagar.status]).toEqual([404, 404, 404])
      const intacto = await prisma.curriculo.findUniqueOrThrow({ where: { id: daAna.id } })
      expect(intacto.conteudo).toBe(texto('da Ana'))
    })

    it('guarda o texto com acentos e quebras de linha sem alterar nada', async () => {
      const conteudo = `Ana Souza\nExperiência: Vue.js, TypeScript e Node.\n\nFormação: Análise e Desenvolvimento de Sistemas`

      const res = await request(app).post('/curriculos').set(auth).send({ conteudo })

      const salvo = await prisma.curriculo.findUniqueOrThrow({ where: { id: res.body.id } })
      expect(salvo.conteudo).toBe(conteudo)
    })

    it('apagar um currículo apaga as análises feitas com ele, mas preserva a candidatura', async () => {
      await criar('1')
      const { body: segundo } = await criar('2')
      const empresa = await prisma.empresa.create({ data: { nome: 'Nubank' } })
      const vaga = await prisma.vaga.create({
        data: { empresaId: empresa.id, titulo: 'Dev Vue', descricao: 'Front-end' },
      })
      const candidatura = await prisma.candidatura.create({ data: { usuarioId, vagaId: vaga.id } })
      await prisma.analiseIa.create({
        data: {
          candidaturaId: candidatura.id,
          curriculoId: segundo.id,
          score: 80,
          palavrasFaltando: ['Docker'],
          recomendacoes: 'Citar Docker',
        },
      })

      const res = await request(app).delete(`/curriculos/${segundo.id}`).set(auth)

      expect(res.status).toBe(204)
      expect(await prisma.analiseIa.count()).toBe(0)
      expect(await prisma.candidatura.count()).toBe(1)
    })

    it('o ativo só pode ser removido quando for o único', async () => {
      const { body: ativo } = await criar('1')
      await criar('2')

      const bloqueado = await request(app).delete(`/curriculos/${ativo.id}`).set(auth)
      expect(bloqueado.status).toBe(409)
      expect(await prisma.curriculo.count()).toBe(2)

      const { body: outro } = await request(app).get('/curriculos').set(auth)
      const inativo = outro.find((c: { ativo: boolean }) => !c.ativo)
      await request(app).delete(`/curriculos/${inativo.id}`).set(auth)

      const liberado = await request(app).delete(`/curriculos/${ativo.id}`).set(auth)
      expect(liberado.status).toBe(204)
      expect(await prisma.curriculo.count()).toBe(0)
    })
  })
})
