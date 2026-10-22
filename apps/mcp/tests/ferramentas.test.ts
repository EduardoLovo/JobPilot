import { describe, expect, it } from 'vitest'
import { apiFalsa, candidaturaDe, conectar, config, dadosDe, json, textoDe } from './helpers.js'

const parada10Dias = candidaturaDe()
const recente = candidaturaDe({
  id: 'c2',
  vagaId: 'v2',
  status: 'INTERESSE',
  dataAplicacao: null,
  atualizadoEm: '2026-10-21T12:00:00.000Z',
  vaga: { id: 'v2', titulo: 'Dev Node', empresa: { id: 'e2', nome: 'Stone' } },
  proximosStatus: ['APLICADO', 'ENCERRADO'],
})

describe('servidor MCP do JobPilot', () => {
  describe('ferramentas expostas', () => {
    it('anuncia as quatro ferramentas, todas com descrição', async () => {
      const { fetchFalso } = apiFalsa(() => undefined)
      const client = await conectar(fetchFalso)

      const { tools } = await client.listTools()

      expect(tools.map((t) => t.name).sort()).toEqual([
        'detalhar_candidatura',
        'listar_candidaturas',
        'mover_candidatura',
        'status_api',
      ])
      for (const ferramenta of tools) {
        expect(ferramenta.description?.length).toBeGreaterThan(20)
      }
    })

    it('marca como só de leitura todas as ferramentas, exceto a que altera dados', async () => {
      const { fetchFalso } = apiFalsa(() => undefined)
      const client = await conectar(fetchFalso)

      const { tools } = await client.listTools()

      const porNome = Object.fromEntries(tools.map((t) => [t.name, t.annotations]))
      expect(porNome.status_api?.readOnlyHint).toBe(true)
      expect(porNome.listar_candidaturas?.readOnlyHint).toBe(true)
      expect(porNome.detalhar_candidatura?.readOnlyHint).toBe(true)
      expect(porNome.mover_candidatura?.readOnlyHint).toBe(false)
    })

    it('descreve os parâmetros para o Claude saber como chamar', async () => {
      const { fetchFalso } = apiFalsa(() => undefined)
      const client = await conectar(fetchFalso)

      const { tools } = await client.listTools()
      const listar = tools.find((t) => t.name === 'listar_candidaturas')!
      const propriedades = listar.inputSchema.properties as Record<string, { description?: string }>

      expect(Object.keys(propriedades).sort()).toEqual(['parada_ha_dias', 'status'])
      expect(propriedades.parada_ha_dias.description).toContain('dias')
      expect(listar.inputSchema.required ?? []).toEqual([])
    })
  })

  describe('listar_candidaturas', () => {
    const comCandidaturas = () =>
      apiFalsa(({ caminho }) =>
        caminho.startsWith('/candidaturas') ? json(200, [parada10Dias, recente]) : undefined,
      )

    it('resume cada candidatura, com os dias parada e para onde pode ir', async () => {
      const { fetchFalso } = comCandidaturas()
      const client = await conectar(fetchFalso)

      const resultado = await client.callTool({ name: 'listar_candidaturas', arguments: {} })

      expect(resultado.isError).toBeFalsy()
      expect(dadosDe(resultado)).toEqual({
        total: 2,
        candidaturas: [
          {
            id: 'c1',
            vaga: 'Desenvolvedora Vue',
            empresa: 'Nubank',
            status: 'APLICADO',
            aplicada_em: '2026-10-15',
            proximo_followup: null,
            dias_parada: 10,
            pode_mover_para: ['INTERESSE', 'ENTREVISTA', 'OFERTA', 'ENCERRADO'],
          },
          {
            id: 'c2',
            vaga: 'Dev Node',
            empresa: 'Stone',
            status: 'INTERESSE',
            aplicada_em: null,
            proximo_followup: null,
            dias_parada: 1,
            pode_mover_para: ['APLICADO', 'ENCERRADO'],
          },
        ],
      })
    })

    it('filtra por status pedindo só isso à API', async () => {
      const { fetchFalso, chamadas } = comCandidaturas()
      const client = await conectar(fetchFalso)

      await client.callTool({ name: 'listar_candidaturas', arguments: { status: 'APLICADO' } })

      expect(chamadas.map((c) => c.caminho)).toContain('/candidaturas?status=APLICADO')
    })

    it('filtra as paradas há pelo menos N dias', async () => {
      const { fetchFalso } = comCandidaturas()
      const client = await conectar(fetchFalso)

      const resultado = await client.callTool({
        name: 'listar_candidaturas',
        arguments: { parada_ha_dias: 7 },
      })

      const { total, candidaturas } = dadosDe(resultado)
      expect(total).toBe(1)
      expect(candidaturas[0].vaga).toBe('Desenvolvedora Vue')
    })

    it('responde lista vazia, sem erro, quando não há candidaturas', async () => {
      const { fetchFalso } = apiFalsa(({ caminho }) =>
        caminho.startsWith('/candidaturas') ? json(200, []) : undefined,
      )
      const client = await conectar(fetchFalso)

      const resultado = await client.callTool({ name: 'listar_candidaturas', arguments: {} })

      expect(resultado.isError).toBeFalsy()
      expect(dadosDe(resultado)).toEqual({ total: 0, candidaturas: [] })
    })

    it('recusa um status que não existe, sem chamar a API', async () => {
      const { fetchFalso, chamadas } = comCandidaturas()
      const client = await conectar(fetchFalso)

      const resultado = await client
        .callTool({ name: 'listar_candidaturas', arguments: { status: 'LUA' } })
        .catch((erro: Error) => ({
          isError: true,
          content: [{ type: 'text', text: erro.message }],
        }))

      expect(resultado.isError).toBe(true)
      expect(chamadas).toHaveLength(0)
    })
  })

  describe('detalhar_candidatura', () => {
    const vagaCompleta = {
      titulo: 'Desenvolvedora Vue',
      descricao: 'Front-end com Vue 3, TypeScript e Pinia',
      url: 'https://nubank.com.br/vagas/1',
      modalidade: 'REMOTO',
      senioridade: 'JUNIOR',
      empresa: { nome: 'Nubank' },
    }
    const etapa = {
      tipo: 'ENTREVISTA_RH',
      data: '2026-11-05T17:00:00.000Z',
      anotacoes: 'Conversa com a Carla',
    }

    const ID = '3f2b8c9a-1d4e-4b7a-9c2d-5e6f7a8b9c0d'

    it('junta a candidatura, a vaga completa e a linha do tempo de etapas', async () => {
      const { fetchFalso, chamadas } = apiFalsa(({ caminho }) => {
        if (caminho === `/candidaturas/${ID}`) return json(200, parada10Dias)
        if (caminho === `/candidaturas/${ID}/etapas`) return json(200, [etapa])
        if (caminho === '/vagas/v1') return json(200, vagaCompleta)
      })
      const client = await conectar(fetchFalso)

      const resultado = await client.callTool({
        name: 'detalhar_candidatura',
        arguments: { id: ID },
      })

      expect(dadosDe(resultado)).toEqual({
        id: 'c1',
        status: 'APLICADO',
        pode_mover_para: ['INTERESSE', 'ENTREVISTA', 'OFERTA', 'ENCERRADO'],
        aplicada_em: '2026-10-15',
        proximo_followup: null,
        vaga: {
          titulo: 'Desenvolvedora Vue',
          empresa: 'Nubank',
          modalidade: 'REMOTO',
          senioridade: 'JUNIOR',
          link: 'https://nubank.com.br/vagas/1',
          descricao: 'Front-end com Vue 3, TypeScript e Pinia',
        },
        etapas: [etapa],
      })
      expect(chamadas.filter((c) => c.caminho !== '/auth/login')).toHaveLength(3)
    })

    it('explica que a candidatura não existe quando a API responde 404', async () => {
      const { fetchFalso } = apiFalsa(({ caminho }) =>
        caminho.startsWith('/candidaturas/')
          ? json(404, { erro: 'Candidatura não encontrada' })
          : undefined,
      )
      const client = await conectar(fetchFalso)

      const resultado = await client.callTool({
        name: 'detalhar_candidatura',
        arguments: { id: ID },
      })

      expect(resultado.isError).toBe(true)
      expect(textoDe(resultado)).toBe('Candidatura não encontrada')
    })

    it('recusa um id que não é UUID, sem chamar a API', async () => {
      const { fetchFalso, chamadas } = apiFalsa(() => undefined)
      const client = await conectar(fetchFalso)

      const resultado = await client
        .callTool({ name: 'detalhar_candidatura', arguments: { id: '123' } })
        .catch((erro: Error) => ({
          isError: true,
          content: [{ type: 'text', text: erro.message }],
        }))

      expect(resultado.isError).toBe(true)
      expect(chamadas).toHaveLength(0)
    })
  })

  describe('status_api', () => {
    it('funciona sem fazer login', async () => {
      const { fetchFalso, chamadas } = apiFalsa(({ caminho }) =>
        caminho === '/health' ? json(200, { status: 'ok', service: 'jobpilot-api' }) : undefined,
      )
      const client = await conectar(fetchFalso)

      const resultado = await client.callTool({ name: 'status_api', arguments: {} })

      expect(dadosDe(resultado)).toEqual({ status: 'ok', service: 'jobpilot-api' })
      expect(chamadas.map((c) => c.caminho)).toEqual(['/health'])
    })
  })

  describe('login e token', () => {
    it('entra uma vez e reaproveita o token nas chamadas seguintes', async () => {
      const { fetchFalso, chamadas } = apiFalsa(({ caminho }) =>
        caminho.startsWith('/candidaturas') ? json(200, []) : undefined,
      )
      const client = await conectar(fetchFalso)

      await client.callTool({ name: 'listar_candidaturas', arguments: {} })
      await client.callTool({ name: 'listar_candidaturas', arguments: {} })

      const logins = chamadas.filter((c) => c.caminho === '/auth/login')
      expect(logins).toHaveLength(1)
      expect(logins[0].body).toEqual({ email: config.email, senha: config.senha })
      const consultas = chamadas.filter((c) => c.caminho.startsWith('/candidaturas'))
      expect(consultas.map((c) => c.headers.Authorization)).toEqual([
        'Bearer token-1',
        'Bearer token-1',
      ])
    })

    it('duas ferramentas chamadas ao mesmo tempo esperam o mesmo login', async () => {
      const { fetchFalso, chamadas } = apiFalsa(({ caminho }) =>
        caminho.startsWith('/candidaturas') ? json(200, []) : undefined,
      )
      const client = await conectar(fetchFalso)

      await Promise.all([
        client.callTool({ name: 'listar_candidaturas', arguments: {} }),
        client.callTool({ name: 'listar_candidaturas', arguments: { status: 'OFERTA' } }),
      ])

      expect(chamadas.filter((c) => c.caminho === '/auth/login')).toHaveLength(1)
    })

    it('quando o token vence, entra de novo e repete a consulta sem a pessoa perceber', async () => {
      let logins = 0
      const { fetchFalso, chamadas } = apiFalsa(({ caminho, headers }) => {
        if (caminho === '/auth/login') return json(200, { accessToken: `token-${++logins}` })
        if (headers.Authorization === 'Bearer token-1')
          return json(401, { erro: 'Token inválido ou expirado' })
        return json(200, [parada10Dias])
      })
      const client = await conectar(fetchFalso)

      const resultado = await client.callTool({ name: 'listar_candidaturas', arguments: {} })

      expect(resultado.isError).toBeFalsy()
      expect(dadosDe(resultado).total).toBe(1)
      expect(chamadas.filter((c) => c.caminho === '/auth/login')).toHaveLength(2)
    })

    it('explica o que conferir quando o login é recusado, sem revelar a senha', async () => {
      const { fetchFalso } = apiFalsa(({ caminho }) =>
        caminho === '/auth/login' ? json(401, { erro: 'E-mail ou senha inválidos' }) : undefined,
      )
      const client = await conectar(fetchFalso)

      const resultado = await client.callTool({ name: 'listar_candidaturas', arguments: {} })

      expect(resultado.isError).toBe(true)
      expect(textoDe(resultado)).toContain('JOBPILOT_EMAIL')
      expect(textoDe(resultado)).toContain('JOBPILOT_SENHA')
      expect(textoDe(resultado)).not.toContain(config.senha)
    })

    it('avisa que a API está fora do ar, sem revelar a senha', async () => {
      const fetchForaDoAr = (async () => {
        throw new TypeError('fetch failed')
      }) as typeof fetch
      const client = await conectar(fetchForaDoAr)

      const resultado = await client.callTool({ name: 'listar_candidaturas', arguments: {} })

      expect(resultado.isError).toBe(true)
      expect(textoDe(resultado)).toContain('Não consegui falar com a API do JobPilot')
      expect(textoDe(resultado)).toContain(config.apiUrl)
      expect(textoDe(resultado)).not.toContain(config.senha)
    })

    it('depois de uma falha, a próxima chamada tenta de novo', async () => {
      let tentativas = 0
      const { fetchFalso } = apiFalsa(({ caminho }) => {
        if (caminho === '/auth/login' && ++tentativas === 1)
          return json(500, { erro: 'Erro interno' })
        if (caminho.startsWith('/candidaturas')) return json(200, [])
      })
      const client = await conectar(fetchFalso)

      const primeira = await client.callTool({ name: 'listar_candidaturas', arguments: {} })
      const segunda = await client.callTool({ name: 'listar_candidaturas', arguments: {} })

      expect(primeira.isError).toBe(true)
      expect(segunda.isError).toBeFalsy()
    })
  })
})
