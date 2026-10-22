import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { authHeader, createTestApp } from './helpers/test-app.js'

const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000'
const bia = { nome: 'Bia Lima', email: 'bia@exemplo.com', senha: 'senha-forte-456' }

describe('Etapas da candidatura', () => {
  let app: ReturnType<typeof createTestApp>['app']
  let auth: Record<string, string>
  let candidaturaId: string

  beforeEach(async () => {
    ;({ app } = createTestApp())
    auth = await authHeader(app)
    candidaturaId = await criarCandidatura(auth)
  })

  async function criarCandidatura(headers: Record<string, string>, titulo = 'Desenvolvedora Vue') {
    const empresa = await request(app)
      .post('/empresas')
      .set(headers)
      .send({ nome: `Empresa ${titulo}` })
    const vaga = await request(app)
      .post('/vagas')
      .set(headers)
      .send({ empresaId: empresa.body.id, titulo, descricao: 'Front-end' })
    const candidatura = await request(app)
      .post('/candidaturas')
      .set(headers)
      .send({ vagaId: vaga.body.id })
    return candidatura.body.id as string
  }

  const url = (id = candidaturaId, etapaId = '') =>
    `/candidaturas/${id}/etapas${etapaId && `/${etapaId}`}`

  const etapaBase = {
    tipo: 'ENTREVISTA_RH',
    data: '2026-11-05T17:00:00.000Z',
    anotacoes: 'Conversa de 30 minutos com a Carla',
  }

  const criar = (body: object = etapaBase, headers = auth, id = candidaturaId) =>
    request(app).post(url(id)).set(headers).send(body)

  const listar = async (headers = auth, id = candidaturaId) =>
    (await request(app).get(url(id)).set(headers)).body as {
      id: string
      tipo: string
      data: string
      anotacoes: string | null
    }[]

  it('exige login', async () => {
    expect((await request(app).get(url())).status).toBe(401)
    expect((await request(app).post(url()).send(etapaBase)).status).toBe(401)
  })

  describe('criar', () => {
    it('cria a etapa e devolve os campos, sem expor dados de outras tabelas', async () => {
      const res = await criar()

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        id: expect.any(String),
        candidaturaId,
        tipo: 'ENTREVISTA_RH',
        data: '2026-11-05T17:00:00.000Z',
        anotacoes: 'Conversa de 30 minutos com a Carla',
      })
    })

    it('guarda o mesmo instante, seja qual for o fuso enviado', async () => {
      const res = await criar({ ...etapaBase, data: '2026-11-05T14:00:00-03:00' })

      expect(res.status).toBe(201)
      expect(res.body.data).toBe('2026-11-05T17:00:00.000Z')
    })

    it('anotações são opcionais e em branco viram null', async () => {
      const semAnotacoes = await criar({ tipo: 'TRIAGEM', data: etapaBase.data })
      const emBranco = await criar({ ...etapaBase, anotacoes: '   ' })

      expect(semAnotacoes.body.anotacoes).toBeNull()
      expect(emBranco.body.anotacoes).toBeNull()
    })

    it('aceita todos os tipos de etapa', async () => {
      const tipos = [
        'TRIAGEM',
        'ENTREVISTA_RH',
        'ENTREVISTA_TECNICA',
        'TESTE_TECNICO',
        'PROPOSTA',
        'OUTRO',
      ]

      for (const tipo of tipos) {
        expect((await criar({ ...etapaBase, tipo })).status).toBe(201)
      }
    })

    it('valida tipo, data e tamanho das anotações', async () => {
      const res = await criar({ tipo: 'LUA', data: '05/11/2026', anotacoes: 'a'.repeat(5001) })

      expect(res.status).toBe(400)
      expect(res.body.detalhes.map((d: { campo: string }) => d.campo).sort()).toEqual([
        'anotacoes',
        'data',
        'tipo',
      ])
      expect(await listar()).toHaveLength(0)
    })

    it('recusa data sem fuso, para a hora não depender do servidor', async () => {
      const res = await criar({ ...etapaBase, data: '2026-11-05T14:00:00' })

      expect(res.status).toBe(400)
    })
  })

  describe('listar', () => {
    it('devolve em ordem cronológica, não na ordem em que foram criadas', async () => {
      await criar({ tipo: 'PROPOSTA', data: '2026-12-01T12:00:00.000Z' })
      await criar({ tipo: 'TRIAGEM', data: '2026-11-01T12:00:00.000Z' })
      await criar({ tipo: 'ENTREVISTA_TECNICA', data: '2026-11-20T12:00:00.000Z' })

      const lista = await listar()

      expect(lista.map((e) => e.tipo)).toEqual(['TRIAGEM', 'ENTREVISTA_TECNICA', 'PROPOSTA'])
    })

    it('lista só as etapas da candidatura pedida', async () => {
      const outraCandidatura = await criarCandidatura(auth, 'Dev Node')
      await criar(etapaBase)
      await criar({ ...etapaBase, tipo: 'TESTE_TECNICO' }, auth, outraCandidatura)

      expect(await listar()).toHaveLength(1)
      expect((await listar(auth, outraCandidatura))[0].tipo).toBe('TESTE_TECNICO')
    })

    it('começa vazia', async () => {
      expect(await listar()).toEqual([])
    })
  })

  describe('editar', () => {
    it('altera a etapa e a reordena na linha do tempo', async () => {
      const { body: primeira } = await criar({ ...etapaBase, data: '2026-11-01T12:00:00.000Z' })
      await criar({ ...etapaBase, tipo: 'PROPOSTA', data: '2026-11-10T12:00:00.000Z' })

      const res = await request(app).put(url(candidaturaId, primeira.id)).set(auth).send({
        tipo: 'ENTREVISTA_TECNICA',
        data: '2026-11-20T12:00:00.000Z',
        anotacoes: 'Remarcada',
      })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ tipo: 'ENTREVISTA_TECNICA', anotacoes: 'Remarcada' })
      expect((await listar()).map((e) => e.tipo)).toEqual(['PROPOSTA', 'ENTREVISTA_TECNICA'])
    })

    it('limpa as anotações quando elas não são enviadas', async () => {
      const { body: etapa } = await criar()

      const res = await request(app)
        .put(url(candidaturaId, etapa.id))
        .set(auth)
        .send({ tipo: etapa.tipo, data: etapa.data })

      expect(res.body.anotacoes).toBeNull()
    })

    it('valida o corpo e devolve 404 para etapa que não existe', async () => {
      const { body: etapa } = await criar()

      const invalido = await request(app)
        .put(url(candidaturaId, etapa.id))
        .set(auth)
        .send({ tipo: 'LUA', data: etapa.data })
      const inexistente = await request(app)
        .put(url(candidaturaId, ID_INEXISTENTE))
        .set(auth)
        .send(etapaBase)

      expect(invalido.status).toBe(400)
      expect(inexistente.status).toBe(404)
      expect(inexistente.body.erro).toBe('Etapa não encontrada')
    })

    it('não edita uma etapa pela URL de outra candidatura da mesma pessoa', async () => {
      const outraCandidatura = await criarCandidatura(auth, 'Dev Node')
      const { body: etapa } = await criar()

      const res = await request(app)
        .put(url(outraCandidatura, etapa.id))
        .set(auth)
        .send({ ...etapaBase, anotacoes: 'trocada' })

      expect(res.status).toBe(404)
      expect((await listar())[0].anotacoes).toBe(etapaBase.anotacoes)
    })
  })

  describe('remover', () => {
    it('remove a etapa', async () => {
      const { body: etapa } = await criar()

      const res = await request(app).delete(url(candidaturaId, etapa.id)).set(auth)

      expect(res.status).toBe(204)
      expect(await listar()).toHaveLength(0)
    })

    it('devolve 404 para etapa que não existe e não remove por outra candidatura', async () => {
      const outraCandidatura = await criarCandidatura(auth, 'Dev Node')
      const { body: etapa } = await criar()

      const inexistente = await request(app).delete(url(candidaturaId, ID_INEXISTENTE)).set(auth)
      const outra = await request(app).delete(url(outraCandidatura, etapa.id)).set(auth)

      expect(inexistente.status).toBe(404)
      expect(outra.status).toBe(404)
      expect(await listar()).toHaveLength(1)
    })
  })

  describe('isolamento entre pessoas', () => {
    it('a candidatura de outra pessoa responde 404 em todas as rotas, sem revelar que existe', async () => {
      const authBia = await authHeader(app, bia)
      const { body: etapa } = await criar()

      const respostas = await Promise.all([
        request(app).get(url()).set(authBia),
        request(app).post(url()).set(authBia).send(etapaBase),
        request(app).put(url(candidaturaId, etapa.id)).set(authBia).send(etapaBase),
        request(app).delete(url(candidaturaId, etapa.id)).set(authBia),
      ])
      const inexistente = await request(app).get(url(ID_INEXISTENTE)).set(authBia)

      expect(respostas.map((r) => r.status)).toEqual([404, 404, 404, 404])
      expect(respostas[0].body).toEqual(inexistente.body)
      expect(await listar()).toHaveLength(1)
    })

    it('recusa ids que não são UUID', async () => {
      const candidatura = await request(app).get('/candidaturas/123/etapas').set(auth)
      const etapa = await request(app).delete(url(candidaturaId, '123')).set(auth)

      expect([candidatura.status, etapa.status]).toEqual([400, 400])
    })
  })
})
