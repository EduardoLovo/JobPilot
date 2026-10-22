import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPrismaCandidaturaRepository } from '../../src/modules/candidaturas/candidatura.repository.js'
import { ana, bia, cadastrar, createIntegrationApp, prisma, resetDatabase } from './helpers.js'

const app = createIntegrationApp()

describe('Candidaturas (API + Prisma + Postgres)', () => {
  let auth: Record<string, string>
  let usuarioId: string
  let vagaId: string

  beforeEach(async () => {
    await resetDatabase()
    ;({
      auth,
      usuario: { id: usuarioId },
    } = await cadastrar(app))
    vagaId = await criarVaga('Desenvolvedora Vue')
  })
  afterAll(() => prisma.$disconnect())

  async function criarVaga(titulo: string) {
    const empresa = await prisma.empresa.create({ data: { nome: `Empresa ${titulo}` } })
    const vaga = await prisma.vaga.create({
      data: { empresaId: empresa.id, titulo, descricao: 'Front-end' },
    })
    return vaga.id
  }

  const candidatar = (headers = auth, id = vagaId) =>
    request(app).post('/candidaturas').set(headers).send({ vagaId: id })

  const mover = (id: string, status: string) =>
    request(app).patch(`/candidaturas/${id}/status`).set(auth).send({ status })

  it('grava a candidatura no banco com status INTERESSE e devolve vaga e empresa', async () => {
    const res = await candidatar()

    expect(res.status).toBe(201)
    expect(res.body.vaga).toEqual({
      id: vagaId,
      titulo: 'Desenvolvedora Vue',
      empresa: { id: expect.any(String), nome: 'Empresa Desenvolvedora Vue' },
    })

    const salva = await prisma.candidatura.findUniqueOrThrow({ where: { id: res.body.id } })
    expect(salva).toMatchObject({ usuarioId, vagaId, status: 'INTERESSE' })
  })

  it('guarda e devolve as datas sem deslocar um dia (colunas do tipo date)', async () => {
    const { body } = await candidatar()

    const res = await request(app)
      .patch(`/candidaturas/${body.id}`)
      .set(auth)
      .send({ dataAplicacao: '2026-10-31', proximoFollowup: '2026-11-01' })

    expect(res.body).toMatchObject({ dataAplicacao: '2026-10-31', proximoFollowup: '2026-11-01' })

    const salva = await prisma.candidatura.findUniqueOrThrow({ where: { id: body.id } })
    expect(salva.dataAplicacao?.toISOString().slice(0, 10)).toBe('2026-10-31')
    expect(salva.proximoFollowup?.toISOString().slice(0, 10)).toBe('2026-11-01')
  })

  it('limpa uma data ao enviar null', async () => {
    const { body } = await request(app)
      .post('/candidaturas')
      .set(auth)
      .send({ vagaId, proximoFollowup: '2026-11-05' })

    const res = await request(app)
      .patch(`/candidaturas/${body.id}`)
      .set(auth)
      .send({ proximoFollowup: null })

    expect(res.body.proximoFollowup).toBeNull()
    const salva = await prisma.candidatura.findUniqueOrThrow({ where: { id: body.id } })
    expect(salva.proximoFollowup).toBeNull()
  })

  it('só um dos dois cliques simultâneos cria a candidatura, e ninguém recebe erro 500', async () => {
    const respostas = await Promise.all([candidatar(), candidatar(), candidatar()])

    const status = respostas.map((r) => r.status).sort()
    expect(status).toEqual([201, 409, 409])
    expect(await prisma.candidatura.count()).toBe(1)
  })

  it('cada pessoa vê e mexe só nas próprias candidaturas', async () => {
    const { auth: authBia } = await cadastrar(app, bia)
    const { body: daAna } = await candidatar()
    await candidatar(authBia)

    const listaDaBia = await request(app).get('/candidaturas').set(authBia)
    expect(listaDaBia.body).toHaveLength(1)
    expect(listaDaBia.body[0].id).not.toBe(daAna.id)

    const ver = await request(app).get(`/candidaturas/${daAna.id}`).set(authBia)
    const alterar = await request(app)
      .patch(`/candidaturas/${daAna.id}/status`)
      .set(authBia)
      .send({ status: 'APLICADO' })
    const apagar = await request(app).delete(`/candidaturas/${daAna.id}`).set(authBia)

    expect([ver.status, alterar.status, apagar.status]).toEqual([404, 404, 404])
    const continua = await prisma.candidatura.findUniqueOrThrow({ where: { id: daAna.id } })
    expect(continua.status).toBe('INTERESSE')
  })

  it('filtra por status, e a mais recentemente alterada aparece primeiro', async () => {
    const outraVaga = await criarVaga('Dev Node')
    const { body: primeira } = await candidatar()
    const { body: segunda } = await candidatar(auth, outraVaga)

    await mover(primeira.id, 'APLICADO')

    const todas = await request(app).get('/candidaturas').set(auth)
    expect(todas.body.map((c: { id: string }) => c.id)).toEqual([primeira.id, segunda.id])

    const aplicadas = await request(app).get('/candidaturas?status=APLICADO').set(auth)
    expect(aplicadas.body.map((c: { id: string }) => c.id)).toEqual([primeira.id])
  })

  it('grava cada mudança de status e recusa a inválida sem alterar o banco', async () => {
    const { body } = await candidatar()

    for (const status of ['APLICADO', 'ENTREVISTA', 'OFERTA'] as const) {
      expect((await mover(body.id, status)).status).toBe(200)
      expect((await prisma.candidatura.findUniqueOrThrow({ where: { id: body.id } })).status).toBe(
        status,
      )
    }

    const invalida = await mover(body.id, 'INTERESSE')

    expect(invalida.status).toBe(409)
    expect((await prisma.candidatura.findUniqueOrThrow({ where: { id: body.id } })).status).toBe(
      'OFERTA',
    )
  })

  describe('gravação condicional do status', () => {
    const repositorio = createPrismaCandidaturaRepository(prisma)

    it('grava quando o status ainda é o esperado e devolve a candidatura com a vaga', async () => {
      const { body } = await candidatar()

      const atualizada = await repositorio.updateStatus(body.id, 'INTERESSE', 'APLICADO')

      expect(atualizada).toMatchObject({ id: body.id, status: 'APLICADO', vaga: { id: vagaId } })
      const salva = await prisma.candidatura.findUniqueOrThrow({ where: { id: body.id } })
      expect(salva.status).toBe('APLICADO')
    })

    it('não grava, e devolve null, quando o status já mudou', async () => {
      const { body } = await candidatar()
      await prisma.candidatura.update({ where: { id: body.id }, data: { status: 'OFERTA' } })

      // Quem pede achava que a candidatura ainda estava em ENTREVISTA
      const atualizada = await repositorio.updateStatus(body.id, 'ENTREVISTA', 'APLICADO')

      expect(atualizada).toBeNull()
      const salva = await prisma.candidatura.findUniqueOrThrow({ where: { id: body.id } })
      expect(salva.status).toBe('OFERTA')
    })

    it('atualiza a data de alteração, que ordena os cards do kanban', async () => {
      const { body } = await candidatar()
      const antes = (await prisma.candidatura.findUniqueOrThrow({ where: { id: body.id } }))
        .atualizadoEm

      await new Promise((resolver) => setTimeout(resolver, 20))
      await repositorio.updateStatus(body.id, 'INTERESSE', 'APLICADO')

      const depois = (await prisma.candidatura.findUniqueOrThrow({ where: { id: body.id } }))
        .atualizadoEm
      expect(depois.getTime()).toBeGreaterThan(antes.getTime())
    })

    it('mudanças simultâneas nunca furam a regra de transição', async () => {
      const { body } = await candidatar()

      // De ENTREVISTA vão OFERTA e APLICADO. Depois de OFERTA não dá para voltar a APLICADO, então
      // "ambas deram certo" só é válido na ordem APLICADO e depois OFERTA, que termina em OFERTA.
      for (let rodada = 0; rodada < 10; rodada++) {
        await prisma.candidatura.update({ where: { id: body.id }, data: { status: 'ENTREVISTA' } })

        const respostas = await Promise.all([mover(body.id, 'OFERTA'), mover(body.id, 'APLICADO')])

        const status = respostas.map((r) => r.status)
        expect(status.every((s) => s === 200 || s === 409)).toBe(true)
        expect(status).toContain(200)
        if (status.every((s) => s === 200)) {
          const salva = await prisma.candidatura.findUniqueOrThrow({ where: { id: body.id } })
          expect(salva.status).toBe('OFERTA')
        }
      }
    })
  })

  it('apagar a candidatura apaga as etapas dela, mas não a vaga', async () => {
    const { body } = await candidatar()
    await prisma.etapa.create({
      data: { candidaturaId: body.id, tipo: 'TRIAGEM', data: new Date() },
    })

    const res = await request(app).delete(`/candidaturas/${body.id}`).set(auth)

    expect(res.status).toBe(204)
    expect(await prisma.etapa.count()).toBe(0)
    expect(await prisma.vaga.count()).toBe(1)
  })

  it('apagar a vaga pela API apaga as candidaturas de todo mundo nela', async () => {
    const { auth: authBia } = await cadastrar(app, bia)
    await candidatar()
    await candidatar(authBia)

    const res = await request(app).delete(`/vagas/${vagaId}`).set(auth)

    expect(res.status).toBe(204)
    expect(await prisma.candidatura.count()).toBe(0)
    expect(await prisma.usuario.count()).toBe(2)
  })

  it('o e-mail da dona da candidatura nunca aparece na resposta', async () => {
    const res = await candidatar()

    expect(JSON.stringify(res.body)).not.toContain(ana.email)
    expect(res.body).not.toHaveProperty('usuarioId')
  })
})
