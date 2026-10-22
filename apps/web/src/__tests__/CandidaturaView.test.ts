import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Etapa } from '@/services/etapas'
import { formatarDataHora } from '@/utils/datas'
import CandidaturaView from '@/views/CandidaturaView.vue'
import { stubApi } from './api-mock'
import { candidaturaDe } from './candidatura-mock'
import { createTestRouter, jsonResponse, logarComTokens } from './helpers'

const etapaDe = (overrides: Partial<Etapa> = {}): Etapa => ({
  id: 'e1',
  candidaturaId: 'c1',
  tipo: 'ENTREVISTA_RH',
  data: '2026-11-05T17:00:00.000Z',
  anotacoes: 'Conversa de 30 minutos com a Carla',
  ...overrides,
})

const triagem = etapaDe({
  id: 'e0',
  tipo: 'TRIAGEM',
  data: '2026-11-01T12:00:00.000Z',
  anotacoes: null,
})

// Responde a candidatura e a lista de etapas; o que mais cada teste precisa entra em `extra`
function api(
  etapas: Etapa[],
  extra: (req: { method: string; path: string }) => Response | undefined = () => undefined,
) {
  return stubApi((req) => {
    const resposta = extra(req)
    if (resposta) return resposta
    if (req.path === '/candidaturas/c1/etapas' && req.method === 'GET') {
      return jsonResponse(200, etapas)
    }
    if (req.path === '/candidaturas/c1' && req.method === 'GET') {
      return jsonResponse(200, candidaturaDe())
    }
  })
}

async function montar() {
  const router = createTestRouter()
  await router.push('/candidaturas/c1')
  const wrapper = mount(CandidaturaView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof montar>>

const titulosDaLinha = (wrapper: Wrapper) =>
  wrapper.findAll('[data-test="etapa"] .etapa-titulo').map((t) => t.text())

async function enviarEtapa(wrapper: Wrapper) {
  await wrapper.get('form [data-test="salvar-etapa"]').trigger('submit')
  await flushPromises()
}

describe('CandidaturaView', () => {
  beforeEach(() => {
    localStorage.clear()
    logarComTokens()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('exibição', () => {
    it('mostra a vaga, a empresa e o status da candidatura', async () => {
      api([])

      const wrapper = await montar()

      expect(wrapper.get('h1').text()).toBe('Desenvolvedora Vue')
      expect(wrapper.text()).toContain('Nubank')
      expect(wrapper.get('[data-test="status"]').text()).toBe('Interesse')
    })

    it('mostra as etapas na ordem em que a API manda (cronológica), com data e anotações', async () => {
      api([triagem, etapaDe()])

      const wrapper = await montar()

      expect(titulosDaLinha(wrapper)).toEqual(['Triagem', 'Entrevista com RH'])
      const segunda = wrapper.findAll('[data-test="etapa"]')[1]
      expect(segunda.text()).toContain(formatarDataHora('2026-11-05T17:00:00.000Z'))
      expect(segunda.text()).toContain('Conversa de 30 minutos com a Carla')
      // Etapa sem anotações não abre um espaço vazio
      expect(wrapper.findAll('[data-test="etapa"]')[0].find('.anotacoes').exists()).toBe(false)
    })

    it('convida a registrar a primeira etapa quando a linha do tempo está vazia', async () => {
      api([])

      const wrapper = await montar()

      expect(wrapper.get('[data-test="sem-etapas"]').text()).toContain('Nenhuma etapa')
    })

    it('avisa quando a candidatura não existe ou é de outra pessoa', async () => {
      stubApi(() => jsonResponse(404, { erro: 'Candidatura não encontrada' }))

      const wrapper = await montar()

      expect(wrapper.get('[data-test="nao-encontrada"]').text()).toContain('removida')
      expect(wrapper.find('[data-test="status"]').exists()).toBe(false)
    })

    it('mostra o erro quando a API falha', async () => {
      stubApi(() => jsonResponse(500, { erro: 'Erro interno do servidor' }))

      const wrapper = await montar()

      expect(wrapper.get('[data-test="erro"]').text()).toBe('Erro interno do servidor')
    })
  })

  describe('adicionar etapa', () => {
    it('envia o tipo, o instante em UTC e as anotações, e atualiza a linha do tempo', async () => {
      const nova = etapaDe({ id: 'e2', tipo: 'TESTE_TECNICO', anotacoes: 'Desafio de 3 horas' })
      let lista = [triagem]
      const { calls } = api(lista, ({ method, path }) => {
        if (method === 'POST') {
          lista = [triagem, nova]
          return jsonResponse(201, nova)
        }
        if (method === 'GET' && path.endsWith('/etapas')) return jsonResponse(200, lista)
      })
      const wrapper = await montar()

      await wrapper.get('[data-test="tipo"]').setValue('TESTE_TECNICO')
      await wrapper.get('[data-test="data"]').setValue('2026-11-10T14:30')
      await wrapper.get('[data-test="anotacoes"]').setValue('Desafio de 3 horas')
      await enviarEtapa(wrapper)

      const post = calls().find((c) => c.method === 'POST')
      expect(post).toMatchObject({
        path: '/candidaturas/c1/etapas',
        body: {
          tipo: 'TESTE_TECNICO',
          // O campo é hora local; a API recebe o mesmo instante em UTC
          data: new Date('2026-11-10T14:30').toISOString(),
          anotacoes: 'Desafio de 3 horas',
        },
      })
      expect(titulosDaLinha(wrapper)).toEqual(['Triagem', 'Teste técnico'])
    })

    it('limpa o formulário depois de salvar', async () => {
      let lista: Etapa[] = []
      api(lista, ({ method, path }) => {
        if (method === 'POST') {
          lista = [etapaDe()]
          return jsonResponse(201, lista[0])
        }
        if (method === 'GET' && path.endsWith('/etapas')) return jsonResponse(200, lista)
      })
      const wrapper = await montar()

      await wrapper.get('[data-test="anotacoes"]').setValue('algo')
      await enviarEtapa(wrapper)

      const campo = wrapper.get('[data-test="anotacoes"]').element as HTMLTextAreaElement
      expect(campo.value).toBe('')
    })

    it('pede a data antes de chamar a API', async () => {
      const { calls } = api([])
      const wrapper = await montar()

      await wrapper.get('[data-test="data"]').setValue('')
      await enviarEtapa(wrapper)

      expect(wrapper.get('[data-test="erro-data"]').text()).toBe('Informe a data e a hora')
      expect(calls().some((c) => c.method === 'POST')).toBe(false)
    })

    it('mostra o erro de validação da API embaixo do campo, sem perder o que foi digitado', async () => {
      api([], ({ method }) =>
        method === 'POST'
          ? jsonResponse(400, {
              erro: 'Dados inválidos',
              detalhes: [
                {
                  campo: 'anotacoes',
                  mensagem: 'As anotações devem ter no máximo 5.000 caracteres',
                },
              ],
            })
          : undefined,
      )
      const wrapper = await montar()

      await wrapper.get('[data-test="anotacoes"]').setValue('texto longo demais')
      await enviarEtapa(wrapper)

      expect(wrapper.text()).toContain('no máximo 5.000 caracteres')
      const campo = wrapper.get('[data-test="anotacoes"]').element as HTMLTextAreaElement
      expect(campo.value).toBe('texto longo demais')
    })
  })

  describe('editar etapa', () => {
    it('leva a etapa para o formulário e salva as alterações na mesma etapa', async () => {
      const { calls } = api([triagem, etapaDe()], ({ method }) =>
        method === 'PUT' ? jsonResponse(200, etapaDe()) : undefined,
      )
      const wrapper = await montar()

      await wrapper.findAll('[data-test="editar"]')[1].trigger('click')
      const anotacoes = wrapper.get('[data-test="anotacoes"]').element as HTMLTextAreaElement
      const data = wrapper.get('[data-test="data"]').element as HTMLInputElement
      expect(anotacoes.value).toBe('Conversa de 30 minutos com a Carla')
      // O campo mostra a hora local da mesma etapa
      expect(new Date(data.value).toISOString()).toBe('2026-11-05T17:00:00.000Z')
      expect(wrapper.text()).toContain('Editar etapa')

      await wrapper.get('[data-test="anotacoes"]').setValue('Remarcada para sexta')
      await enviarEtapa(wrapper)

      expect(calls().find((c) => c.method === 'PUT')).toMatchObject({
        path: '/candidaturas/c1/etapas/e1',
        body: {
          tipo: 'ENTREVISTA_RH',
          data: '2026-11-05T17:00:00.000Z',
          anotacoes: 'Remarcada para sexta',
        },
      })
      expect(wrapper.text()).toContain('Nova etapa')
    })

    it('cancelar descarta a edição', async () => {
      const { calls } = api([etapaDe()])
      const wrapper = await montar()

      await wrapper.get('[data-test="editar"]').trigger('click')
      await wrapper.get('[data-test="cancelar"]').trigger('click')

      const anotacoes = wrapper.get('[data-test="anotacoes"]').element as HTMLTextAreaElement
      expect(anotacoes.value).toBe('')
      expect(calls().some((c) => c.method === 'PUT')).toBe(false)
    })
  })

  describe('remover etapa', () => {
    it('remove depois de confirmar e atualiza a linha do tempo', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      let lista = [triagem, etapaDe()]
      const { calls } = api(lista, ({ method, path }) => {
        if (method === 'DELETE') {
          lista = [triagem]
          return jsonResponse(204)
        }
        if (method === 'GET' && path.endsWith('/etapas')) return jsonResponse(200, lista)
      })
      const wrapper = await montar()

      await wrapper.findAll('[data-test="remover"]')[1].trigger('click')
      await flushPromises()

      expect(calls().find((c) => c.method === 'DELETE')).toMatchObject({
        path: '/candidaturas/c1/etapas/e1',
      })
      expect(titulosDaLinha(wrapper)).toEqual(['Triagem'])
    })

    it('mantém a etapa quando a pessoa cancela', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const { calls } = api([etapaDe()])
      const wrapper = await montar()

      await wrapper.get('[data-test="remover"]').trigger('click')
      await flushPromises()

      expect(calls().some((c) => c.method === 'DELETE')).toBe(false)
      expect(wrapper.findAll('[data-test="etapa"]')).toHaveLength(1)
    })
  })

  describe('datas da candidatura', () => {
    it('mostra as datas atuais nos campos', async () => {
      stubApi(({ path }) =>
        path.endsWith('/etapas')
          ? jsonResponse(200, [])
          : jsonResponse(
              200,
              candidaturaDe({ dataAplicacao: '2026-10-20', proximoFollowup: '2026-11-05' }),
            ),
      )

      const wrapper = await montar()

      const aplicacao = wrapper.get('[data-test="data-aplicacao"]').element as HTMLInputElement
      const followup = wrapper.get('[data-test="proximo-followup"]').element as HTMLInputElement
      expect([aplicacao.value, followup.value]).toEqual(['2026-10-20', '2026-11-05'])
    })

    it('salva as datas e manda null para o campo que ficou vazio', async () => {
      const { calls } = api([], ({ method }) =>
        method === 'PATCH'
          ? jsonResponse(200, candidaturaDe({ dataAplicacao: '2026-10-22', proximoFollowup: null }))
          : undefined,
      )
      const wrapper = await montar()

      await wrapper.get('[data-test="data-aplicacao"]').setValue('2026-10-22')
      await wrapper.get('[data-test="salvar-datas"]').trigger('submit')
      await flushPromises()

      expect(calls().find((c) => c.method === 'PATCH')).toMatchObject({
        path: '/candidaturas/c1',
        body: { dataAplicacao: '2026-10-22', proximoFollowup: null },
      })
      expect(wrapper.get('[data-test="datas-salvas"]').text()).toBe('Datas salvas')
    })
  })
})
