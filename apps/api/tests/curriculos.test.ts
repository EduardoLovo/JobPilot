import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { createInMemoryCatalogo } from './helpers/in-memory-catalogo.js'
import { createInMemoryCurriculos } from './helpers/in-memory-curriculos.js'
import { createInMemoryEtapas } from './helpers/in-memory-etapas.js'
import { createInMemoryUsuarioRepository } from './helpers/in-memory-usuario-repository.js'
import { authHeader, createTestApp } from './helpers/test-app.js'

const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000'
const bia = { nome: 'Bia Lima', email: 'bia@exemplo.com', senha: 'senha-forte-456' }

const texto = (versao: string) =>
  `Ana Souza, desenvolvedora front-end com Vue 3 e TypeScript. Versão ${versao}.`

describe('Currículos', () => {
  let app: ReturnType<typeof createTestApp>['app']
  let auth: Record<string, string>

  beforeEach(async () => {
    ;({ app } = createTestApp())
    auth = await authHeader(app)
  })

  const criar = (body: object, headers = auth) =>
    request(app).post('/curriculos').set(headers).send(body)

  const listar = async (headers = auth) =>
    (await request(app).get('/curriculos').set(headers)).body as {
      id: string
      conteudo: string
      ativo: boolean
    }[]

  const ativos = async (headers = auth) => (await listar(headers)).filter((c) => c.ativo)

  it('exige login', async () => {
    expect((await request(app).get('/curriculos')).status).toBe(401)
    expect(
      (
        await request(app)
          .post('/curriculos')
          .send({ conteudo: texto('1') })
      ).status,
    ).toBe(401)
  })

  describe('criar', () => {
    it('o primeiro currículo já nasce ativo, sem expor o dono', async () => {
      const res = await criar({ conteudo: texto('1') })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        id: expect.any(String),
        conteudo: texto('1'),
        ativo: true,
        criadoEm: expect.any(String),
      })
    })

    it('os seguintes nascem inativos, e o ativo continua o mesmo', async () => {
      const { body: primeiro } = await criar({ conteudo: texto('1') })

      const segundo = await criar({ conteudo: texto('2') })

      expect(segundo.body.ativo).toBe(false)
      expect((await ativos()).map((c) => c.id)).toEqual([primeiro.id])
    })

    it('com ativo: true, o novo assume e o anterior é desativado', async () => {
      await criar({ conteudo: texto('1') })

      const segundo = await criar({ conteudo: texto('2'), ativo: true })

      expect(segundo.body.ativo).toBe(true)
      expect((await ativos()).map((c) => c.id)).toEqual([segundo.body.id])
    })

    it('tira os espaços das pontas do texto', async () => {
      const res = await criar({ conteudo: `   ${texto('1')}\n\n` })

      expect(res.body.conteudo).toBe(texto('1'))
    })

    it('valida o tamanho do texto', async () => {
      const curto = await criar({ conteudo: 'oi' })
      const vazio = await criar({ conteudo: '    ' })
      const longo = await criar({ conteudo: 'a'.repeat(30_001) })

      expect([curto.status, vazio.status, longo.status]).toEqual([400, 400, 400])
      expect(curto.body.detalhes[0]).toMatchObject({ campo: 'conteudo' })
      expect(await listar()).toHaveLength(0)
    })

    it('recusa ativo que não é booleano', async () => {
      const res = await criar({ conteudo: texto('1'), ativo: 'sim' })

      expect(res.status).toBe(400)
    })
  })

  describe('listar e ver', () => {
    it('lista só os currículos de quem está logado, o mais recente primeiro', async () => {
      const authBia = await authHeader(app, bia)
      await criar({ conteudo: texto('1') })
      await criar({ conteudo: texto('2') })
      await criar({ conteudo: texto('da Bia') }, authBia)

      const daAna = await listar()
      const daBia = await listar(authBia)

      expect(daAna.map((c) => c.conteudo)).toEqual([texto('2'), texto('1')])
      expect(daBia.map((c) => c.conteudo)).toEqual([texto('da Bia')])
    })

    it('cada pessoa tem o seu próprio currículo ativo', async () => {
      const authBia = await authHeader(app, bia)

      await criar({ conteudo: texto('da Ana') })
      await criar({ conteudo: texto('da Bia') }, authBia)

      expect(await ativos()).toHaveLength(1)
      expect(await ativos(authBia)).toHaveLength(1)
    })

    it('devolve o currículo ativo', async () => {
      await criar({ conteudo: texto('1') })
      const { body: segundo } = await criar({ conteudo: texto('2'), ativo: true })

      const res = await request(app).get('/curriculos/ativo').set(auth)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(segundo.id)
    })

    it('responde 404 em /ativo quando a pessoa ainda não tem currículo', async () => {
      const res = await request(app).get('/curriculos/ativo').set(auth)

      expect(res.status).toBe(404)
      expect(res.body.erro).toBe('Você ainda não tem um currículo ativo')
    })

    it('busca por id e devolve 404 quando não existe ou é de outra pessoa', async () => {
      const authBia = await authHeader(app, bia)
      const { body: daAna } = await criar({ conteudo: texto('1') })

      const meu = await request(app).get(`/curriculos/${daAna.id}`).set(auth)
      const inexistente = await request(app).get(`/curriculos/${ID_INEXISTENTE}`).set(auth)
      const deOutra = await request(app).get(`/curriculos/${daAna.id}`).set(authBia)

      expect(meu.body).toEqual(daAna)
      expect([inexistente.status, deOutra.status]).toEqual([404, 404])
      expect(deOutra.body).toEqual(inexistente.body)
    })

    it('recusa id que não é UUID', async () => {
      const res = await request(app).get('/curriculos/123').set(auth)

      expect(res.status).toBe(400)
    })
  })

  describe('editar', () => {
    it('altera o texto sem mudar qual está ativo', async () => {
      const { body: criado } = await criar({ conteudo: texto('1') })

      const res = await request(app)
        .put(`/curriculos/${criado.id}`)
        .set(auth)
        .send({ conteudo: texto('corrigida') })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ id: criado.id, conteudo: texto('corrigida'), ativo: true })
    })

    it('valida o texto e não altera o de outra pessoa', async () => {
      const authBia = await authHeader(app, bia)
      const { body: daAna } = await criar({ conteudo: texto('1') })

      const curto = await request(app)
        .put(`/curriculos/${daAna.id}`)
        .set(auth)
        .send({ conteudo: 'oi' })
      const deOutra = await request(app)
        .put(`/curriculos/${daAna.id}`)
        .set(authBia)
        .send({ conteudo: texto('invasão') })

      expect(curto.status).toBe(400)
      expect(deOutra.status).toBe(404)
      expect((await listar())[0].conteudo).toBe(texto('1'))
    })
  })

  describe('ativar', () => {
    it('troca o currículo ativo, e só um fica ativo', async () => {
      const { body: primeiro } = await criar({ conteudo: texto('1') })
      const { body: segundo } = await criar({ conteudo: texto('2') })

      const res = await request(app).post(`/curriculos/${segundo.id}/ativar`).set(auth)

      expect(res.status).toBe(200)
      expect(res.body.ativo).toBe(true)
      expect((await ativos()).map((c) => c.id)).toEqual([segundo.id])
      expect((await listar()).find((c) => c.id === primeiro.id)?.ativo).toBe(false)
    })

    it('ativar o que já está ativo não muda nada', async () => {
      const { body: primeiro } = await criar({ conteudo: texto('1') })

      const res = await request(app).post(`/curriculos/${primeiro.id}/ativar`).set(auth)

      expect(res.status).toBe(200)
      expect((await ativos()).map((c) => c.id)).toEqual([primeiro.id])
    })

    it('não ativa o currículo de outra pessoa', async () => {
      const authBia = await authHeader(app, bia)
      const { body: daAna } = await criar({ conteudo: texto('1') })
      await criar({ conteudo: texto('2') })

      const res = await request(app).post(`/curriculos/${daAna.id}/ativar`).set(authBia)

      expect(res.status).toBe(404)
    })

    it('responde 409 (e não 500) quando duas trocas simultâneas se chocam no banco', async () => {
      // O repositório de mentira imita o índice único: a troca falha como falharia no Postgres
      const usuarios = createInMemoryUsuarioRepository()
      const curriculos = createInMemoryCurriculos()
      const appCorrida = createApp({
        usuarios: usuarios.repo,
        ...createInMemoryCatalogo(),
        etapas: createInMemoryEtapas().repo,
        curriculos: {
          ...curriculos.repo,
          activate: async () => {
            throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
          },
        },
      })
      const headers = await authHeader(appCorrida)
      await request(appCorrida)
        .post('/curriculos')
        .set(headers)
        .send({ conteudo: texto('1') })
      const { body: segundo } = await request(appCorrida)
        .post('/curriculos')
        .set(headers)
        .send({ conteudo: texto('2') })

      const res = await request(appCorrida).post(`/curriculos/${segundo.id}/ativar`).set(headers)

      expect(res.status).toBe(409)
    })
  })

  describe('remover', () => {
    it('remove um currículo que não é o ativo', async () => {
      await criar({ conteudo: texto('1') })
      const { body: segundo } = await criar({ conteudo: texto('2') })

      const res = await request(app).delete(`/curriculos/${segundo.id}`).set(auth)

      expect(res.status).toBe(204)
      expect(await listar()).toHaveLength(1)
    })

    it('não remove o ativo enquanto houver outros currículos', async () => {
      const { body: primeiro } = await criar({ conteudo: texto('1') })
      await criar({ conteudo: texto('2') })

      const res = await request(app).delete(`/curriculos/${primeiro.id}`).set(auth)

      expect(res.status).toBe(409)
      expect(res.body.erro).toBe('Ative outro currículo antes de remover o currículo ativo')
      expect(await listar()).toHaveLength(2)
    })

    it('quem tem só um currículo pode removê-lo', async () => {
      const { body: unico } = await criar({ conteudo: texto('1') })

      const res = await request(app).delete(`/curriculos/${unico.id}`).set(auth)

      expect(res.status).toBe(204)
      expect(await listar()).toHaveLength(0)
    })

    it('depois de ativar outro, o antigo pode ser removido', async () => {
      const { body: primeiro } = await criar({ conteudo: texto('1') })
      const { body: segundo } = await criar({ conteudo: texto('2') })
      await request(app).post(`/curriculos/${segundo.id}/ativar`).set(auth)

      const res = await request(app).delete(`/curriculos/${primeiro.id}`).set(auth)

      expect(res.status).toBe(204)
    })

    it('não remove o currículo de outra pessoa', async () => {
      const authBia = await authHeader(app, bia)
      const { body: daAna } = await criar({ conteudo: texto('1') })

      const res = await request(app).delete(`/curriculos/${daAna.id}`).set(authBia)

      expect(res.status).toBe(404)
      expect(await listar()).toHaveLength(1)
    })
  })
})
