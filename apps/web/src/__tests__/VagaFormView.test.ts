import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RouteLocationRaw } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VagaFormView from '@/views/VagaFormView.vue'
import { nubank, stubApi, vagaDe } from './api-mock'
import { createTestRouter, jsonResponse, logarComTokens } from './helpers'

async function montar(rota: RouteLocationRaw = { name: 'vaga-nova' }) {
  const router = createTestRouter()
  await router.push(rota)
  const wrapper = mount(VagaFormView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof montar>>['wrapper']

async function preencher(wrapper: Wrapper, titulo = 'Dev Node', descricao = 'Back-end com Node') {
  await wrapper.get('[data-test="titulo"]').setValue(titulo)
  await wrapper.get('[data-test="descricao"]').setValue(descricao)
}

async function enviar(wrapper: Wrapper) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('VagaFormView', () => {
  beforeEach(() => {
    localStorage.clear()
    logarComTokens()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('cria a vaga numa empresa existente e volta para a lista', async () => {
    const { calls } = stubApi(({ method, path }) => {
      if (path === '/empresas') return jsonResponse(200, [nubank])
      if (method === 'POST' && path === '/vagas') return jsonResponse(201, vagaDe())
    })
    const { wrapper, router } = await montar()

    await wrapper.get('[data-test="empresa"]').setValue(nubank.id)
    await preencher(wrapper)
    await enviar(wrapper)

    expect(calls().at(-1)).toMatchObject({
      method: 'POST',
      path: '/vagas',
      body: {
        empresaId: nubank.id,
        titulo: 'Dev Node',
        descricao: 'Back-end com Node',
        url: null,
        modalidade: null,
        senioridade: null,
      },
    })
    // A tela da lista é carregada sob demanda, então a navegação pode levar mais que um tick
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('vagas'))
  })

  it('cadastra a empresa nova antes de criar a vaga', async () => {
    const { calls } = stubApi(({ method, path }) => {
      if (path === '/empresas' && method === 'GET') return jsonResponse(200, [nubank])
      if (path === '/empresas' && method === 'POST')
        return jsonResponse(201, { id: 'e2', nome: 'Stone', site: null })
      if (path === '/vagas') return jsonResponse(201, vagaDe({ empresaId: 'e2' }))
    })
    const { wrapper } = await montar()

    await wrapper.get('[data-test="empresa"]').setValue('__nova__')
    await wrapper.get('[data-test="nova-empresa"]').setValue('Stone')
    await preencher(wrapper)
    await enviar(wrapper)

    const [, criarEmpresa, criarVaga] = calls()
    expect(criarEmpresa).toMatchObject({
      method: 'POST',
      path: '/empresas',
      body: { nome: 'Stone' },
    })
    expect(criarVaga).toMatchObject({ method: 'POST', path: '/vagas', body: { empresaId: 'e2' } })
  })

  it('já abre o campo de nova empresa quando ainda não existe nenhuma', async () => {
    stubApi(({ path }) => (path === '/empresas' ? jsonResponse(200, []) : undefined))

    const { wrapper } = await montar()

    expect(wrapper.find('[data-test="nova-empresa"]').exists()).toBe(true)
  })

  it('pede a empresa antes de chamar a API', async () => {
    const { calls } = stubApi(({ path }) =>
      path === '/empresas' ? jsonResponse(200, [nubank]) : undefined,
    )
    const { wrapper } = await montar()

    await preencher(wrapper)
    await enviar(wrapper)

    expect(wrapper.text()).toContain('Escolha uma empresa')
    expect(calls().some((c) => c.method === 'POST')).toBe(false)
  })

  it('mostra os erros de validação da API embaixo de cada campo', async () => {
    stubApi(({ method, path }) => {
      if (path === '/empresas') return jsonResponse(200, [nubank])
      if (method === 'POST') {
        return jsonResponse(400, {
          erro: 'Dados inválidos',
          detalhes: [{ campo: 'titulo', mensagem: 'Título deve ter pelo menos 2 caracteres' }],
        })
      }
    })
    const { wrapper } = await montar()

    await wrapper.get('[data-test="empresa"]').setValue(nubank.id)
    await preencher(wrapper, 'D', 'x')
    await enviar(wrapper)

    expect(wrapper.text()).toContain('Título deve ter pelo menos 2 caracteres')
  })

  it('carrega a vaga no formulário e salva as alterações ao editar', async () => {
    const { calls } = stubApi(({ method, path }) => {
      if (path === '/empresas') return jsonResponse(200, [nubank])
      if (path === '/vagas/v1' && method === 'GET') return jsonResponse(200, vagaDe())
      if (path === '/vagas/v1' && method === 'PUT') return jsonResponse(200, vagaDe())
    })
    const { wrapper, router } = await montar({ name: 'vaga-editar', params: { id: 'v1' } })

    expect((wrapper.get('[data-test="titulo"]').element as HTMLInputElement).value).toBe(
      'Desenvolvedora Vue',
    )
    expect((wrapper.get('[data-test="empresa"]').element as HTMLSelectElement).value).toBe(
      nubank.id,
    )

    await wrapper.get('[data-test="titulo"]').setValue('Desenvolvedora Vue Pleno')
    await enviar(wrapper)

    expect(calls().at(-1)).toMatchObject({
      method: 'PUT',
      path: '/vagas/v1',
      body: { titulo: 'Desenvolvedora Vue Pleno', modalidade: 'REMOTO', senioridade: 'JUNIOR' },
    })
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('vagas'))
  })
})
