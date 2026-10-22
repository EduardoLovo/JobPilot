import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VagasView from '@/views/VagasView.vue'
import { stubApi, vagaDe } from './api-mock'
import { createTestRouter, jsonResponse, logarComTokens } from './helpers'

async function montar() {
  const router = createTestRouter()
  await router.push('/vagas')
  const wrapper = mount(VagasView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('VagasView', () => {
  beforeEach(() => {
    localStorage.clear()
    logarComTokens()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lista as vagas com empresa, modalidade e senioridade', async () => {
    stubApi(() => jsonResponse(200, [vagaDe()]))

    const wrapper = await montar()

    const card = wrapper.get('[data-test="vaga"]')
    expect(card.text()).toContain('Desenvolvedora Vue')
    expect(card.text()).toContain('Nubank')
    expect(card.text()).toContain('Remoto')
    expect(card.text()).toContain('Júnior')
  })

  it('mostra o aviso quando não há vagas', async () => {
    stubApi(() => jsonResponse(200, []))

    const wrapper = await montar()

    expect(wrapper.get('[data-test="vazio"]').text()).toBe('Nenhuma vaga encontrada.')
  })

  it('mostra o erro quando a API falha', async () => {
    stubApi(() => jsonResponse(500, { erro: 'Erro interno do servidor' }))

    const wrapper = await montar()

    expect(wrapper.get('[data-test="erro"]').text()).toBe('Erro interno do servidor')
  })

  it('refaz a busca ao escolher um filtro, enviando só os filtros preenchidos', async () => {
    const { calls } = stubApi(() => jsonResponse(200, []))
    const wrapper = await montar()

    await wrapper.get('select[aria-label="Modalidade"]').setValue('HIBRIDO')
    await flushPromises()

    expect(calls().map((c) => c.path)).toEqual(['/vagas', '/vagas?modalidade=HIBRIDO'])
  })

  it('remove a vaga depois de confirmar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = stubApi(({ method }) =>
      method === 'DELETE' ? jsonResponse(204) : jsonResponse(200, [vagaDe()]),
    )
    const wrapper = await montar()

    await wrapper.get('.btn-perigo').trigger('click')
    await flushPromises()

    expect(calls().at(-1)).toMatchObject({ method: 'DELETE', path: '/vagas/v1' })
    expect(wrapper.find('[data-test="vaga"]').exists()).toBe(false)
  })

  it('não remove quando a pessoa cancela a confirmação', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { calls } = stubApi(() => jsonResponse(200, [vagaDe()]))
    const wrapper = await montar()

    await wrapper.get('.btn-perigo').trigger('click')
    await flushPromises()

    expect(calls().some((c) => c.method === 'DELETE')).toBe(false)
    expect(wrapper.find('[data-test="vaga"]').exists()).toBe(true)
  })
})
