import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { createInMemoryCatalogo } from './helpers/in-memory-catalogo.js'
import { createInMemoryUsuarioRepository } from './helpers/in-memory-usuario-repository.js'
import { authHeader, createTestApp } from './helpers/test-app.js'

const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000'
const bia = { nome: 'Bia Lima', email: 'bia@exemplo.com', senha: 'senha-forte-456' }

describe('Candidaturas', () => {
  let app: ReturnType<typeof createTestApp>['app']
  let auth: Record<string, string>
  let vagaId: string

  beforeEach(async () => {
    ;({ app } = createTestApp())
    auth = await authHeader(app)
    vagaId = await criarVaga(app, auth)
  })

  async function criarVaga(
    app: ReturnType<typeof createApp>,
    auth: Record<string, string>,
    titulo = 'Desenvolvedora Vue',
  ) {
    const empresa = await request(app)
      .post('/empresas')
      .set(auth)
      .send({ nome: `Empresa ${titulo}` })
    const vaga = await request(app)
      .post('/vagas')
      .set(auth)
      .send({ empresaId: empresa.body.id, titulo, descricao: 'Front-end' })
    return vaga.body.id as string
  }

  const candidatar = (body: object = { vagaId }, headers = auth) =>
    request(app).post('/candidaturas').set(headers).send(body)

  const mover = (id: string, status: string, headers = auth) =>
    request(app).patch(`/candidaturas/${id}/status`).set(headers).send({ status })

  it('exige login', async () => {
    expect((await request(app).get('/candidaturas')).status).toBe(401)
    expect((await request(app).post('/candidaturas').send({ vagaId })).status).toBe(401)
  })

  describe('criar', () => {
    it('cria a candidatura com status INTERESSE, com a vaga e a empresa', async () => {
      const res = await candidatar()

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        id: expect.any(String),
        vagaId,
        status: 'INTERESSE',
        dataAplicacao: null,
        proximoFollowup: null,
        vaga: { id: vagaId, titulo: 'Desenvolvedora Vue', empresa: { nome: expect.any(String) } },
      })
      expect(res.body).not.toHaveProperty('usuarioId')
    })

    it('informa para onde a candidatura pode ser movida', async () => {
      const res = await candidatar()

      expect(res.body.proximosStatus).toEqual(['APLICADO', 'ENCERRADO'])
    })

    it('aceita a data do próximo follow-up', async () => {
      const res = await candidatar({ vagaId, proximoFollowup: '2026-11-05' })

      expect(res.body.proximoFollowup).toBe('2026-11-05')
    })

    it('recusa vaga que não existe', async () => {
      const res = await candidatar({ vagaId: ID_INEXISTENTE })

      expect(res.status).toBe(400)
      expect(res.body.erro).toBe('Vaga informada não existe')
    })

    it('recusa candidatar duas vezes à mesma vaga', async () => {
      await candidatar()
      const res = await candidatar()

      expect(res.status).toBe(409)
      expect(res.body.erro).toBe('Você já tem uma candidatura para esta vaga')
    })

    it('responde 409 (e não 500) quando duas requisições simultâneas furam a checagem', async () => {
      // Sem a checagem prévia, a segunda criação cai no índice único, como numa corrida real
      const usuarios = createInMemoryUsuarioRepository()
      const catalogo = createInMemoryCatalogo()
      const appCorrida = createApp({
        usuarios: usuarios.repo,
        ...catalogo,
        candidaturas: { ...catalogo.candidaturas, findByUsuarioVaga: async () => null },
      })
      const headers = await authHeader(appCorrida)
      const id = await criarVaga(appCorrida, headers)
      const enviar = () =>
        request(appCorrida).post('/candidaturas').set(headers).send({ vagaId: id })

      await enviar()
      const res = await enviar()

      expect(res.status).toBe(409)
    })

    it('valida vagaId e data', async () => {
      const res = await candidatar({ vagaId: 'abc', proximoFollowup: '05/11/2026' })

      expect(res.status).toBe(400)
      expect(res.body.detalhes.map((d: { campo: string }) => d.campo).sort()).toEqual([
        'proximoFollowup',
        'vagaId',
      ])
    })

    it('duas pessoas podem se candidatar à mesma vaga', async () => {
      const authBia = await authHeader(app, bia)
      await candidatar()

      const res = await candidatar({ vagaId }, authBia)

      expect(res.status).toBe(201)
    })
  })

  describe('listar e ver', () => {
    it('lista só as candidaturas de quem está logado', async () => {
      const authBia = await authHeader(app, bia)
      await candidatar()
      await candidatar({ vagaId }, authBia)

      const ana = await request(app).get('/candidaturas').set(auth)
      const outra = await request(app).get('/candidaturas').set(authBia)

      expect(ana.body).toHaveLength(1)
      expect(outra.body).toHaveLength(1)
      expect(ana.body[0].id).not.toBe(outra.body[0].id)
    })

    it('filtra por status e por vaga', async () => {
      const outraVaga = await criarVaga(app, auth, 'Dev Node')
      const { body: primeira } = await candidatar()
      await candidatar({ vagaId: outraVaga })
      await mover(primeira.id, 'APLICADO')

      const aplicadas = await request(app).get('/candidaturas?status=APLICADO').set(auth)
      const daVaga = await request(app).get(`/candidaturas?vagaId=${outraVaga}`).set(auth)

      expect(aplicadas.body.map((c: { id: string }) => c.id)).toEqual([primeira.id])
      expect(daVaga.body.map((c: { vagaId: string }) => c.vagaId)).toEqual([outraVaga])
    })

    it('recusa filtro com status inválido', async () => {
      const res = await request(app).get('/candidaturas?status=LUA').set(auth)

      expect(res.status).toBe(400)
    })

    it('busca por id', async () => {
      const { body: criada } = await candidatar()

      const res = await request(app).get(`/candidaturas/${criada.id}`).set(auth)

      expect(res.body).toEqual(criada)
    })

    it('devolve 404 para candidatura que não existe ou é de outra pessoa', async () => {
      const authBia = await authHeader(app, bia)
      const { body: daAna } = await candidatar()

      const inexistente = await request(app).get(`/candidaturas/${ID_INEXISTENTE}`).set(auth)
      const deOutra = await request(app).get(`/candidaturas/${daAna.id}`).set(authBia)

      expect(inexistente.status).toBe(404)
      expect(deOutra.status).toBe(404)
      expect(deOutra.body).toEqual(inexistente.body)
    })

    it('recusa id que não é UUID', async () => {
      const res = await request(app).get('/candidaturas/123').set(auth)

      expect(res.status).toBe(400)
    })
  })

  describe('alterar datas', () => {
    it('altera só os campos enviados e limpa com null', async () => {
      const { body: criada } = await candidatar({ vagaId, proximoFollowup: '2026-11-05' })

      const aplicada = await request(app)
        .patch(`/candidaturas/${criada.id}`)
        .set(auth)
        .send({ dataAplicacao: '2026-10-20' })
      expect(aplicada.body).toMatchObject({
        dataAplicacao: '2026-10-20',
        proximoFollowup: '2026-11-05',
      })

      const limpa = await request(app)
        .patch(`/candidaturas/${criada.id}`)
        .set(auth)
        .send({ proximoFollowup: null })
      expect(limpa.body).toMatchObject({ dataAplicacao: '2026-10-20', proximoFollowup: null })
    })

    it('recusa corpo vazio e data inválida', async () => {
      const { body: criada } = await candidatar()

      const vazio = await request(app).patch(`/candidaturas/${criada.id}`).set(auth).send({})
      const invalida = await request(app)
        .patch(`/candidaturas/${criada.id}`)
        .set(auth)
        .send({ dataAplicacao: 'ontem' })

      expect(vazio.status).toBe(400)
      expect(invalida.status).toBe(400)
    })

    it('não altera candidatura de outra pessoa', async () => {
      const authBia = await authHeader(app, bia)
      const { body: daAna } = await candidatar()

      const res = await request(app)
        .patch(`/candidaturas/${daAna.id}`)
        .set(authBia)
        .send({ dataAplicacao: '2026-10-20' })

      expect(res.status).toBe(404)
    })
  })

  describe('mudar status', () => {
    it('percorre o caminho normal até a oferta', async () => {
      const { body: criada } = await candidatar()

      for (const status of ['APLICADO', 'ENTREVISTA', 'OFERTA']) {
        const res = await mover(criada.id, status)
        expect(res.status).toBe(200)
        expect(res.body.status).toBe(status)
      }
    })

    it('atualiza os próximos status permitidos a cada mudança', async () => {
      const { body: criada } = await candidatar()

      const res = await mover(criada.id, 'APLICADO')

      expect(res.body.proximosStatus).toEqual(['INTERESSE', 'ENTREVISTA', 'OFERTA', 'ENCERRADO'])
    })

    it('bloqueia transição inválida e mantém o status', async () => {
      const { body: criada } = await candidatar()

      const res = await mover(criada.id, 'ENTREVISTA')

      expect(res.status).toBe(409)
      expect(res.body.erro).toBe('Não é possível mover a candidatura de Interesse para Entrevista')
      const atual = await request(app).get(`/candidaturas/${criada.id}`).set(auth)
      expect(atual.body.status).toBe('INTERESSE')
    })

    it('reabre uma candidatura encerrada', async () => {
      const { body: criada } = await candidatar()
      await mover(criada.id, 'ENCERRADO')

      const res = await mover(criada.id, 'ENTREVISTA')

      expect(res.status).toBe(200)
    })

    it('soltar na mesma coluna não muda nada e não dá erro', async () => {
      const { body: criada } = await candidatar()

      const res = await mover(criada.id, 'INTERESSE')

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('INTERESSE')
    })

    it('recusa status inexistente', async () => {
      const { body: criada } = await candidatar()

      const res = await mover(criada.id, 'LUA')

      expect(res.status).toBe(400)
    })

    it('não muda o status da candidatura de outra pessoa', async () => {
      const authBia = await authHeader(app, bia)
      const { body: daAna } = await candidatar()

      const res = await mover(daAna.id, 'APLICADO', authBia)

      expect(res.status).toBe(404)
    })
  })

  describe('remover', () => {
    it('remove a própria candidatura', async () => {
      const { body: criada } = await candidatar()

      const res = await request(app).delete(`/candidaturas/${criada.id}`).set(auth)
      expect(res.status).toBe(204)

      const depois = await request(app).get(`/candidaturas/${criada.id}`).set(auth)
      expect(depois.status).toBe(404)
    })

    it('depois de remover, dá para se candidatar de novo à vaga', async () => {
      const { body: criada } = await candidatar()
      await request(app).delete(`/candidaturas/${criada.id}`).set(auth)

      const res = await candidatar()

      expect(res.status).toBe(201)
    })

    it('não remove candidatura de outra pessoa', async () => {
      const authBia = await authHeader(app, bia)
      const { body: daAna } = await candidatar()

      const res = await request(app).delete(`/candidaturas/${daAna.id}`).set(authBia)

      expect(res.status).toBe(404)
      const continua = await request(app).get(`/candidaturas/${daAna.id}`).set(auth)
      expect(continua.status).toBe(200)
    })
  })
})
