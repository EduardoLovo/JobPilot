import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '@/views/LoginView.vue'
import { createTestRouter, jsonResponse, usuarioAna } from './helpers'

async function montar(rota = '/login') {
  const router = createTestRouter()
  await router.push(rota)
  const wrapper = mount(LoginView, { global: { plugins: [router] } })
  return { wrapper, router }
}

async function preencherEEnviar(wrapper: Awaited<ReturnType<typeof montar>>['wrapper']) {
  await wrapper.get('input[type="email"]').setValue('ana@exemplo.com')
  await wrapper.get('input[type="password"]').setValue('senha-forte-123')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('LoginView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra a mensagem da API quando o login falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { erro: 'E-mail ou senha inválidos' })),
    )
    const { wrapper } = await montar()

    await preencherEEnviar(wrapper)

    expect(wrapper.get('[data-test="erro"]').text()).toBe('E-mail ou senha inválidos')
  })

  it('avisa quando a API está fora do ar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { wrapper } = await montar()

    await preencherEEnviar(wrapper)

    expect(wrapper.get('[data-test="erro"]').text()).toBe('Não foi possível conectar à API.')
  })

  it('entra e volta para a página que a pessoa tentou abrir', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { usuario: usuarioAna, accessToken: 'a', refreshToken: 'r' }),
        ),
    )
    const { wrapper, router } = await montar('/login?redirect=/')

    await preencherEEnviar(wrapper)

    expect(router.currentRoute.value.name).toBe('home')
  })
})
