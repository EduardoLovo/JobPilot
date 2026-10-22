import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { bia, cadastrar, createIntegrationApp, prisma, resetDatabase } from './helpers.js'

const app = createIntegrationApp()

describe('Etapas (API + Prisma + Postgres)', () => {
  let auth: Record<string, string>
  let usuarioId: string
  let vagaId: string
  let candidaturaId: string

  beforeEach(async () => {
    await resetDatabase()
    ;({
      auth,
      usuario: { id: usuarioId },
    } = await cadastrar(app))
    const empresa = await prisma.empresa.create({ data: { nome: 'Nubank' } })
    const vaga = await prisma.vaga.create({
      data: { empresaId: empresa.id, titulo: 'Dev Vue', descricao: 'Front-end' },
    })
    vagaId = vaga.id
    candidaturaId = (await prisma.candidatura.create({ data: { usuarioId, vagaId } })).id
  })
  afterAll(() => prisma.$disconnect())

  const url = (id = candidaturaId, etapaId = '') =>
    `/candidaturas/${id}/etapas${etapaId && `/${etapaId}`}`

  const criar = (body: object, headers = auth, id = candidaturaId) =>
    request(app).post(url(id)).set(headers).send(body)

  const tipos = async () =>
    (await request(app).get(url()).set(auth)).body.map((e: { tipo: string }) => e.tipo)

  it('grava a etapa no banco com o tipo e as anotações, incluindo acentos e quebras de linha', async () => {
    const anotacoes =
      'Conversa com a Carla\nPontos: experiência com Vue e testes\n\nPróximo passo: teste técnico'

    const res = await criar({ tipo: 'ENTREVISTA_RH', data: '2026-11-05T17:00:00.000Z', anotacoes })

    expect(res.status).toBe(201)
    const salva = await prisma.etapa.findUniqueOrThrow({ where: { id: res.body.id } })
    expect(salva).toMatchObject({ candidaturaId, tipo: 'ENTREVISTA_RH', anotacoes })
  })

  it('guarda o instante exato, sem deslocar horas, seja qual for o fuso enviado', async () => {
    const emBrasilia = await criar({ tipo: 'TRIAGEM', data: '2026-11-05T14:00:00-03:00' })
    const emUtc = await criar({ tipo: 'TRIAGEM', data: '2026-11-05T17:00:00.000Z' })

    for (const etapa of [emBrasilia.body, emUtc.body]) {
      const salva = await prisma.etapa.findUniqueOrThrow({ where: { id: etapa.id } })
      expect(salva.data.toISOString()).toBe('2026-11-05T17:00:00.000Z')
      expect(etapa.data).toBe('2026-11-05T17:00:00.000Z')
    }
  })

  it('lista em ordem cronológica, mesmo criadas fora de ordem', async () => {
    await criar({ tipo: 'PROPOSTA', data: '2026-12-01T12:00:00.000Z' })
    await criar({ tipo: 'TRIAGEM', data: '2026-11-01T12:00:00.000Z' })
    await criar({ tipo: 'ENTREVISTA_TECNICA', data: '2026-11-20T12:00:00.000Z' })
    await criar({ tipo: 'ENTREVISTA_RH', data: '2026-11-10T12:00:00.000Z' })

    expect(await tipos()).toEqual(['TRIAGEM', 'ENTREVISTA_RH', 'ENTREVISTA_TECNICA', 'PROPOSTA'])
  })

  it('mantém a mesma ordem entre consultas quando duas etapas têm o mesmo horário', async () => {
    const mesmoHorario = '2026-11-05T12:00:00.000Z'
    for (const tipo of ['TRIAGEM', 'ENTREVISTA_RH', 'TESTE_TECNICO', 'PROPOSTA', 'OUTRO']) {
      await criar({ tipo, data: mesmoHorario })
    }

    const primeira = await tipos()
    const segunda = await tipos()

    expect(primeira).toHaveLength(5)
    expect(segunda).toEqual(primeira)
  })

  it('editar a data move a etapa na linha do tempo', async () => {
    const { body: triagem } = await criar({ tipo: 'TRIAGEM', data: '2026-11-01T12:00:00.000Z' })
    await criar({ tipo: 'PROPOSTA', data: '2026-11-10T12:00:00.000Z' })

    await request(app)
      .put(url(candidaturaId, triagem.id))
      .set(auth)
      .send({ tipo: 'TRIAGEM', data: '2026-11-15T12:00:00.000Z' })

    expect(await tipos()).toEqual(['PROPOSTA', 'TRIAGEM'])
  })

  describe('isolamento', () => {
    it('outra pessoa não vê nem mexe nas etapas, e o banco fica intacto', async () => {
      const { auth: authBia } = await cadastrar(app, bia)
      const { body: etapa } = await criar({ tipo: 'TRIAGEM', data: '2026-11-01T12:00:00.000Z' })

      const respostas = await Promise.all([
        request(app).get(url()).set(authBia),
        criar({ tipo: 'OUTRO', data: '2026-11-02T12:00:00.000Z' }, authBia),
        request(app)
          .put(url(candidaturaId, etapa.id))
          .set(authBia)
          .send({ tipo: 'OUTRO', data: '2026-11-02T12:00:00.000Z', anotacoes: 'invasão' }),
        request(app).delete(url(candidaturaId, etapa.id)).set(authBia),
      ])

      expect(respostas.map((r) => r.status)).toEqual([404, 404, 404, 404])
      const noBanco = await prisma.etapa.findMany()
      expect(noBanco).toHaveLength(1)
      expect(noBanco[0]).toMatchObject({ tipo: 'TRIAGEM', anotacoes: null })
    })

    it('uma etapa não pode ser alterada pela URL de outra candidatura, nem da mesma pessoa', async () => {
      const outraVaga = await prisma.vaga.create({
        data: {
          empresaId: (await prisma.empresa.findFirstOrThrow()).id,
          titulo: 'Dev Node',
          descricao: 'Back-end',
        },
      })
      const outra = await prisma.candidatura.create({ data: { usuarioId, vagaId: outraVaga.id } })
      const { body: etapa } = await criar({ tipo: 'TRIAGEM', data: '2026-11-01T12:00:00.000Z' })

      const editar = await request(app)
        .put(url(outra.id, etapa.id))
        .set(auth)
        .send({ tipo: 'OUTRO', data: '2026-11-02T12:00:00.000Z' })
      const apagar = await request(app).delete(url(outra.id, etapa.id)).set(auth)

      expect([editar.status, apagar.status]).toEqual([404, 404])
      expect(await prisma.etapa.count()).toBe(1)
    })
  })

  describe('cascata', () => {
    const comTresEtapas = async () => {
      for (const tipo of ['TRIAGEM', 'ENTREVISTA_RH', 'PROPOSTA']) {
        await criar({ tipo, data: '2026-11-05T12:00:00.000Z' })
      }
      expect(await prisma.etapa.count()).toBe(3)
    }

    it('apagar a candidatura pela API apaga as etapas dela', async () => {
      await comTresEtapas()

      const res = await request(app).delete(`/candidaturas/${candidaturaId}`).set(auth)

      expect(res.status).toBe(204)
      expect(await prisma.etapa.count()).toBe(0)
    })

    it('apagar a vaga pela API apaga as candidaturas e, junto, as etapas', async () => {
      await comTresEtapas()

      const res = await request(app).delete(`/vagas/${vagaId}`).set(auth)

      expect(res.status).toBe(204)
      expect(await prisma.candidatura.count()).toBe(0)
      expect(await prisma.etapa.count()).toBe(0)
    })

    it('apagar uma etapa não mexe nas outras nem na candidatura', async () => {
      await comTresEtapas()
      const { body: lista } = await request(app).get(url()).set(auth)

      await request(app).delete(url(candidaturaId, lista[0].id)).set(auth)

      expect(await prisma.etapa.count()).toBe(2)
      expect(await prisma.candidatura.count()).toBe(1)
    })
  })
})
