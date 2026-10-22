import { describe, expect, it } from 'vitest'
import { apiFalsa, candidaturaDe, conectar, config, dadosDe, json, textoDe } from './helpers.js'

const ID = '3f2b8c9a-1d4e-4b7a-9c2d-5e6f7a8b9c0d'

// Candidatura em APLICADO; de lá dá para ir a INTERESSE, ENTREVISTA, OFERTA e ENCERRADO
const aplicada = candidaturaDe({ id: ID })
const emEntrevista = candidaturaDe({
  id: ID,
  status: 'ENTREVISTA',
  proximosStatus: ['APLICADO', 'OFERTA', 'ENCERRADO'],
})

const mover = (client: Awaited<ReturnType<typeof conectar>>, argumentos: Record<string, unknown>) =>
  client.callTool({ name: 'mover_candidatura', arguments: argumentos })

// A API de mentira: lê a candidatura em APLICADO e aceita o PATCH, devolvendo-a em ENTREVISTA
const apiQueMove = () =>
  apiFalsa(({ method, caminho }) => {
    if (method === 'PATCH' && caminho === `/candidaturas/${ID}/status`) {
      return json(200, emEntrevista)
    }
    if (caminho === `/candidaturas/${ID}`) return json(200, aplicada)
  })

describe('mover_candidatura', () => {
  it('muda o status pela API e conta o que mudou', async () => {
    const { fetchFalso, chamadas } = apiQueMove()
    const client = await conectar(fetchFalso)

    const resultado = await mover(client, { id: ID, status: 'ENTREVISTA' })

    expect(resultado.isError).toBeFalsy()
    expect(dadosDe(resultado)).toEqual({
      mudou: true,
      mensagem: 'Candidatura a Desenvolvedora Vue (Nubank) movida de APLICADO para ENTREVISTA.',
      id: ID,
      vaga: 'Desenvolvedora Vue',
      empresa: 'Nubank',
      status_anterior: 'APLICADO',
      status_atual: 'ENTREVISTA',
      pode_mover_para: ['APLICADO', 'OFERTA', 'ENCERRADO'],
    })

    const patch = chamadas.find((c) => c.method === 'PATCH')!
    expect(patch.caminho).toBe(`/candidaturas/${ID}/status`)
    expect(patch.body).toEqual({ status: 'ENTREVISTA' })
    expect(patch.headers.Authorization).toBe('Bearer token-1')
  })

  it('não chama a API para escrever quando o status já é o pedido', async () => {
    const { fetchFalso, chamadas } = apiQueMove()
    const client = await conectar(fetchFalso)

    const resultado = await mover(client, { id: ID, status: 'APLICADO' })

    expect(resultado.isError).toBeFalsy()
    expect(dadosDe(resultado)).toMatchObject({
      mudou: false,
      status_anterior: 'APLICADO',
      status_atual: 'APLICADO',
    })
    expect(textoDe(resultado)).toContain('Nada foi alterado')
    expect(chamadas.some((c) => c.method === 'PATCH')).toBe(false)
  })

  it('explica os destinos permitidos quando a transição não é válida, sem escrever', async () => {
    // De INTERESSE não dá para ir direto a ENTREVISTA: antes vem a candidatura (APLICADO)
    const emInteresse = candidaturaDe({
      id: ID,
      status: 'INTERESSE',
      proximosStatus: ['APLICADO', 'ENCERRADO'],
    })
    const { fetchFalso, chamadas } = apiFalsa(({ caminho }) =>
      caminho === `/candidaturas/${ID}` ? json(200, emInteresse) : undefined,
    )
    const client = await conectar(fetchFalso)

    const resultado = await mover(client, { id: ID, status: 'ENTREVISTA' })

    expect(resultado.isError).toBe(true)
    expect(textoDe(resultado)).toBe(
      'Não é possível mover a candidatura a Desenvolvedora Vue (Nubank) de INTERESSE para ENTREVISTA. ' +
        'Destinos permitidos a partir de INTERESSE: APLICADO, ENCERRADO.',
    )
    expect(chamadas.some((c) => c.method === 'PATCH')).toBe(false)
  })

  it('mostra a mensagem da API quando ela recusa a mudança (alterada ao mesmo tempo)', async () => {
    const { fetchFalso } = apiFalsa(({ method, caminho }) => {
      if (method === 'PATCH') {
        return json(409, {
          erro: 'A candidatura foi alterada ao mesmo tempo. Atualize a página e tente de novo',
        })
      }
      if (caminho === `/candidaturas/${ID}`) return json(200, aplicada)
    })
    const client = await conectar(fetchFalso)

    const resultado = await mover(client, { id: ID, status: 'ENTREVISTA' })

    expect(resultado.isError).toBe(true)
    expect(textoDe(resultado)).toContain('alterada ao mesmo tempo')
  })

  it('diz que a candidatura não existe, sem tentar escrever', async () => {
    const { fetchFalso, chamadas } = apiFalsa(({ caminho }) =>
      caminho === `/candidaturas/${ID}`
        ? json(404, { erro: 'Candidatura não encontrada' })
        : undefined,
    )
    const client = await conectar(fetchFalso)

    const resultado = await mover(client, { id: ID, status: 'ENTREVISTA' })

    expect(resultado.isError).toBe(true)
    expect(textoDe(resultado)).toBe('Candidatura não encontrada')
    expect(chamadas.some((c) => c.method === 'PATCH')).toBe(false)
  })

  it('recusa status inexistente e id que não é UUID, sem chamar a API', async () => {
    const { fetchFalso, chamadas } = apiQueMove()
    const client = await conectar(fetchFalso)
    const comoErro = (erro: Error) => ({
      isError: true,
      content: [{ type: 'text', text: erro.message }],
    })

    const statusInvalido = await mover(client, { id: ID, status: 'LUA' }).catch(comoErro)
    const idInvalido = await mover(client, { id: '123', status: 'ENTREVISTA' }).catch(comoErro)
    const semStatus = await mover(client, { id: ID }).catch(comoErro)

    expect([statusInvalido.isError, idInvalido.isError, semStatus.isError]).toEqual([
      true,
      true,
      true,
    ])
    expect(chamadas).toHaveLength(0)
  })

  it('quando o token vence na hora de escrever, entra de novo e repete o pedido inteiro', async () => {
    let logins = 0
    const { fetchFalso, chamadas } = apiFalsa(({ method, caminho, headers }) => {
      if (caminho === '/auth/login') return json(200, { accessToken: `token-${++logins}` })
      if (caminho === `/candidaturas/${ID}` && method === 'GET') return json(200, aplicada)
      if (method === 'PATCH') {
        return headers.Authorization === 'Bearer token-1'
          ? json(401, { erro: 'Token inválido ou expirado' })
          : json(200, emEntrevista)
      }
    })
    const client = await conectar(fetchFalso)

    const resultado = await mover(client, { id: ID, status: 'ENTREVISTA' })

    expect(resultado.isError).toBeFalsy()
    expect(dadosDe(resultado).mudou).toBe(true)
    const patches = chamadas.filter((c) => c.method === 'PATCH')
    expect(patches.map((p) => p.headers.Authorization)).toEqual([
      'Bearer token-1',
      'Bearer token-2',
    ])
    // O corpo vai de novo na repetição
    expect(patches.map((p) => p.body)).toEqual([{ status: 'ENTREVISTA' }, { status: 'ENTREVISTA' }])
  })

  it('com o login recusado, explica o que conferir sem revelar a senha e sem escrever', async () => {
    const { fetchFalso, chamadas } = apiFalsa(({ caminho }) =>
      caminho === '/auth/login' ? json(401, { erro: 'E-mail ou senha inválidos' }) : undefined,
    )
    const client = await conectar(fetchFalso)

    const resultado = await mover(client, { id: ID, status: 'ENTREVISTA' })

    expect(resultado.isError).toBe(true)
    expect(textoDe(resultado)).toContain('JOBPILOT_SENHA')
    expect(textoDe(resultado)).not.toContain(config.senha)
    expect(chamadas.some((c) => c.method === 'PATCH')).toBe(false)
  })
})
