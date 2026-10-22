import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Curriculo } from '@/services/curriculos'
import CurriculoView from '@/views/CurriculoView.vue'
import { stubApi } from './api-mock'
import { createTestRouter, jsonResponse, logarComTokens } from './helpers'

const curriculoDe = (overrides: Partial<Curriculo> = {}): Curriculo => ({
  id: 'k1',
  conteudo: 'Ana Souza, desenvolvedora front-end com Vue 3 e TypeScript.',
  ativo: true,
  criadoEm: '2026-10-22T12:00:00.000Z',
  ...overrides,
})

const antigo = curriculoDe({
  id: 'k2',
  ativo: false,
  conteudo: 'Versão antiga do currículo da Ana, só com HTML e CSS.',
})

async function montar() {
  const router = createTestRouter()
  await router.push('/curriculo')
  const wrapper = mount(CurriculoView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof montar>>

const textoNovo = 'Ana Souza, nova versão do currículo com Node, Express e PostgreSQL.'

async function preencherEEnviar(wrapper: Wrapper, conteudo = textoNovo) {
  await wrapper.get('[data-test="texto"]').setValue(conteudo)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

const get = (lista: Curriculo[]) => () => jsonResponse(200, lista)

describe('CurriculoView', () => {
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
    it('sem currículo, convida a salvar o primeiro e não mostra a opção de ativo', async () => {
      stubApi(get([]))

      const wrapper = await montar()

      expect(wrapper.text()).toContain('Salvar seu currículo')
      expect(wrapper.find('[data-test="ativo"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="tornar-ativo"]').exists()).toBe(false)
    })

    it('mostra o currículo ativo e os outros com uma prévia', async () => {
      stubApi(get([curriculoDe(), antigo]))

      const wrapper = await montar()

      expect(wrapper.get('[data-test="ativo-texto"]').text()).toContain('Vue 3 e TypeScript')
      const anteriores = wrapper.findAll('[data-test="anterior"]')
      expect(anteriores).toHaveLength(1)
      expect(anteriores[0].text()).toContain('Versão antiga')
    })

    it('encurta a prévia dos currículos longos', async () => {
      stubApi(
        get([curriculoDe(), curriculoDe({ id: 'k3', ativo: false, conteudo: 'x'.repeat(500) })]),
      )

      const wrapper = await montar()

      const previa = wrapper.get('[data-test="anterior"] .previa').text()
      expect(previa.length).toBeLessThan(200)
      expect(previa.endsWith('…')).toBe(true)
    })

    it('mostra o erro quando a API falha', async () => {
      stubApi(() => jsonResponse(500, { erro: 'Erro interno do servidor' }))

      const wrapper = await montar()

      expect(wrapper.get('[data-test="erro"]').text()).toBe('Erro interno do servidor')
    })
  })

  describe('salvar', () => {
    it('salva o primeiro currículo e recarrega a lista', async () => {
      let lista: Curriculo[] = []
      const { calls } = stubApi(({ method }) => {
        if (method === 'POST') {
          lista = [curriculoDe({ conteudo: textoNovo })]
          return jsonResponse(201, lista[0])
        }
        return jsonResponse(200, lista)
      })
      const wrapper = await montar()

      await preencherEEnviar(wrapper)

      const post = calls().find((c) => c.method === 'POST')
      expect(post).toMatchObject({
        path: '/curriculos',
        body: { conteudo: textoNovo, ativo: true },
      })
      expect(wrapper.get('[data-test="ativo-texto"]').text()).toBe(textoNovo)
      expect((wrapper.get('[data-test="texto"]').element as HTMLTextAreaElement).value).toBe('')
    })

    it('por padrão o novo currículo vira o ativo, mas dá para desmarcar', async () => {
      const { calls } = stubApi(({ method }) =>
        method === 'POST' ? jsonResponse(201, antigo) : jsonResponse(200, [curriculoDe()]),
      )
      const wrapper = await montar()

      const marcado = wrapper.get('[data-test="tornar-ativo"]').element as HTMLInputElement
      expect(marcado.checked).toBe(true)

      await wrapper.get('[data-test="tornar-ativo"]').setValue(false)
      await preencherEEnviar(wrapper)

      expect(calls().find((c) => c.method === 'POST')?.body).toMatchObject({ ativo: false })
    })

    it('mostra o erro de validação da API embaixo do campo', async () => {
      stubApi(({ method }) =>
        method === 'POST'
          ? jsonResponse(400, {
              erro: 'Dados inválidos',
              detalhes: [
                { campo: 'conteudo', mensagem: 'O currículo deve ter pelo menos 30 caracteres' },
              ],
            })
          : jsonResponse(200, []),
      )
      const wrapper = await montar()

      await preencherEEnviar(wrapper, 'oi')

      expect(wrapper.get('[data-test="erro-texto"]').text()).toContain('pelo menos 30 caracteres')
      // O texto digitado não se perde
      expect((wrapper.get('[data-test="texto"]').element as HTMLTextAreaElement).value).toBe('oi')
    })

    it('mostra um erro geral quando a API cai ao salvar', async () => {
      stubApi(({ method }) =>
        method === 'POST' ? jsonResponse(500, { erro: 'Erro interno' }) : jsonResponse(200, []),
      )
      const wrapper = await montar()

      await preencherEEnviar(wrapper)

      expect(wrapper.get('[data-test="erro"]').text()).toBe('Erro interno')
    })
  })

  describe('editar', () => {
    it('leva o texto para o formulário e salva as alterações no mesmo currículo', async () => {
      const { calls } = stubApi(({ method }) =>
        method === 'PUT' ? jsonResponse(200, antigo) : jsonResponse(200, [curriculoDe(), antigo]),
      )
      const wrapper = await montar()

      await wrapper.get('[data-test="editar"]').trigger('click')
      const campo = wrapper.get('[data-test="texto"]').element as HTMLTextAreaElement
      expect(campo.value).toBe(antigo.conteudo)
      expect(wrapper.text()).toContain('Editar currículo')
      expect(wrapper.find('[data-test="tornar-ativo"]').exists()).toBe(false)

      await preencherEEnviar(wrapper, 'Versão antiga corrigida, agora com JavaScript e Vue.')

      expect(calls().find((c) => c.method === 'PUT')).toMatchObject({
        path: '/curriculos/k2',
        body: { conteudo: 'Versão antiga corrigida, agora com JavaScript e Vue.' },
      })
      expect(wrapper.text()).toContain('Novo currículo')
    })

    it('cancelar descarta a edição', async () => {
      const { calls } = stubApi(get([curriculoDe(), antigo]))
      const wrapper = await montar()

      await wrapper.get('[data-test="editar-ativo"]').trigger('click')
      await wrapper.get('[data-test="cancelar"]').trigger('click')

      expect((wrapper.get('[data-test="texto"]').element as HTMLTextAreaElement).value).toBe('')
      expect(calls().some((c) => c.method === 'PUT')).toBe(false)
    })
  })

  describe('ativar', () => {
    it('ativa o currículo escolhido e recarrega a lista', async () => {
      let lista = [curriculoDe(), antigo]
      const { calls } = stubApi(({ method, path }) => {
        if (method === 'POST' && path === '/curriculos/k2/ativar') {
          lista = [curriculoDe({ ativo: false }), { ...antigo, ativo: true }]
          return jsonResponse(200, lista[1])
        }
        return jsonResponse(200, lista)
      })
      const wrapper = await montar()

      await wrapper.get('[data-test="ativar"]').trigger('click')
      await flushPromises()

      expect(calls().find((c) => c.method === 'POST')).toMatchObject({
        path: '/curriculos/k2/ativar',
      })
      expect(wrapper.get('[data-test="ativo-texto"]').text()).toBe(antigo.conteudo)
    })
  })

  describe('remover', () => {
    it('remove um currículo inativo depois de confirmar', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { calls } = stubApi(({ method }) =>
        method === 'DELETE' ? jsonResponse(204) : jsonResponse(200, [curriculoDe(), antigo]),
      )
      const wrapper = await montar()

      await wrapper.get('[data-test="remover"]').trigger('click')
      await flushPromises()

      expect(calls().find((c) => c.method === 'DELETE')).toMatchObject({ path: '/curriculos/k2' })
    })

    it('avisa que as análises feitas com o currículo também serão removidas', async () => {
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false)
      stubApi(get([curriculoDe(), antigo]))
      const wrapper = await montar()

      await wrapper.get('[data-test="remover"]').trigger('click')

      expect(confirmar.mock.calls[0][0]).toContain('análises')
    })

    it('mantém o currículo quando a pessoa cancela', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const { calls } = stubApi(get([curriculoDe(), antigo]))
      const wrapper = await montar()

      await wrapper.get('[data-test="remover"]').trigger('click')
      await flushPromises()

      expect(calls().some((c) => c.method === 'DELETE')).toBe(false)
    })

    it('só oferece remover o ativo quando ele é o único currículo', async () => {
      stubApi(get([curriculoDe(), antigo]))
      const comOutros = await montar()
      expect(comOutros.find('[data-test="remover-ativo"]').exists()).toBe(false)

      stubApi(get([curriculoDe()]))
      const sozinho = await montar()
      expect(sozinho.find('[data-test="remover-ativo"]').exists()).toBe(true)
    })

    it('mostra o erro quando a API recusa a remoção', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      stubApi(({ method }) =>
        method === 'DELETE'
          ? jsonResponse(409, { erro: 'Ative outro currículo antes de remover o currículo ativo' })
          : jsonResponse(200, [curriculoDe(), antigo]),
      )
      const wrapper = await montar()

      await wrapper.get('[data-test="remover"]').trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-test="erro"]').text()).toContain('Ative outro currículo')
    })
  })
})
