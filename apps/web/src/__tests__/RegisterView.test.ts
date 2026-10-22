import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterView from '@/views/RegisterView.vue'
import { createTestRouter, jsonResponse, usuarioAna } from './helpers'

async function montar() {
  const router = createTestRouter()
  await router.push('/cadastro')
  const wrapper = mount(RegisterView, { global: { plugins: [router] } })
  return { wrapper, router }
}

async function preencher(
  wrapper: Awaited<ReturnType<typeof montar>>['wrapper'],
  { senha = 'senha-forte-123', confirmacao = 'senha-forte-123' } = {},
) {
  const inputs = wrapper.findAll('input')
  await inputs[0].setValue('Ana Souza')
  await inputs[1].setValue('ana@exemplo.com')
  await inputs[2].setValue(senha)
  await inputs[3].setValue(confirmacao)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('RegisterView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('confere a confirmação de senha antes de chamar a API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await montar()

    await preencher(wrapper, { confirmacao: 'outra-senha' })

    expect(wrapper.get('[data-test="erro-confirmacao"]').text()).toBe('As senhas não conferem')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mostra os erros de validação da API embaixo de cada campo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          erro: 'Dados inválidos',
          detalhes: [{ campo: 'senha', mensagem: 'Senha deve ter pelo menos 8 caracteres' }],
        }),
      ),
    )
    const { wrapper } = await montar()

    await preencher(wrapper, { senha: '123', confirmacao: '123' })

    expect(wrapper.text()).toContain('Senha deve ter pelo menos 8 caracteres')
  })

  it('mostra e-mail já cadastrado como erro geral', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(409, { erro: 'E-mail já cadastrado' })),
    )
    const { wrapper } = await montar()

    await preencher(wrapper)

    expect(wrapper.get('[data-test="erro"]').text()).toBe('E-mail já cadastrado')
  })

  it('cria a conta e entra direto na página inicial', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(201, { usuario: usuarioAna, accessToken: 'a', refreshToken: 'r' }),
        ),
    )
    const { wrapper, router } = await montar()

    await preencher(wrapper)

    // A página inicial é carregada sob demanda, então a navegação pode levar mais que um tick
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'))
  })
})
