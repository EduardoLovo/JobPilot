import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VagasView from '@/views/VagasView.vue'
import { stubApi, vagaDe } from './api-mock'
import { candidaturaDe } from './candidatura-mock'
import { createTestRouter, jsonResponse, logarComTokens } from './helpers'

async function montar() {
  const router = createTestRouter()
  await router.push('/vagas')
  const wrapper = mount(VagasView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

// Responde a lista de vagas e a de candidaturas (que a tela busca junto)
const respostas =
  (candidaturas: object[] = []) =>
  (req: { method: string; path: string }) => {
    if (req.path.startsWith('/candidaturas')) return jsonResponse(200, candidaturas)
    if (req.path.startsWith('/vagas')) return jsonResponse(200, [vagaDe()])
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
    stubApi(respostas())

    const wrapper = await montar()

    const card = wrapper.get('[data-test="vaga"]')
    expect(card.text()).toContain('Desenvolvedora Vue')
    expect(card.text()).toContain('Nubank')
    expect(card.text()).toContain('Remoto')
    expect(card.text()).toContain('Júnior')
  })

  it('mostra o aviso quando não há vagas', async () => {
    stubApi(({ path }) => jsonResponse(200, path.startsWith('/vagas') ? [] : []))

    const wrapper = await montar()

    expect(wrapper.get('[data-test="vazio"]').text()).toBe('Nenhuma vaga encontrada.')
  })

  it('mostra o erro quando a API falha', async () => {
    stubApi(() => jsonResponse(500, { erro: 'Erro interno do servidor' }))

    const wrapper = await montar()

    expect(wrapper.get('[data-test="erro"]').text()).toBe('Erro interno do servidor')
  })

  it('refaz a busca ao escolher um filtro, enviando só os filtros preenchidos', async () => {
    const { calls } = stubApi(({ path }) => jsonResponse(200, path.startsWith('/vagas') ? [] : []))
    const wrapper = await montar()

    await wrapper.get('select[aria-label="Modalidade"]').setValue('HIBRIDO')
    await flushPromises()

    const buscasDeVagas = calls()
      .map((c) => c.path)
      .filter((path) => path.startsWith('/vagas'))
    expect(buscasDeVagas).toEqual(['/vagas', '/vagas?modalidade=HIBRIDO'])
  })

  it('remove a vaga depois de confirmar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = stubApi((req) =>
      req.method === 'DELETE' ? jsonResponse(204) : respostas()(req),
    )
    const wrapper = await montar()

    await wrapper.get('.btn-perigo').trigger('click')
    await flushPromises()

    expect(calls().at(-1)).toMatchObject({ method: 'DELETE', path: '/vagas/v1' })
    expect(wrapper.find('[data-test="vaga"]').exists()).toBe(false)
  })

  it('não remove quando a pessoa cancela a confirmação', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { calls } = stubApi(respostas())
    const wrapper = await montar()

    await wrapper.get('.btn-perigo').trigger('click')
    await flushPromises()

    expect(calls().some((c) => c.method === 'DELETE')).toBe(false)
    expect(wrapper.find('[data-test="vaga"]').exists()).toBe(true)
  })

  describe('candidatar-se', () => {
    it('cria a candidatura e troca o botão pelo status', async () => {
      const { calls } = stubApi((req) =>
        req.method === 'POST' ? jsonResponse(201, candidaturaDe()) : respostas()(req),
      )
      const wrapper = await montar()

      await wrapper.get('[data-test="candidatar"]').trigger('click')
      await flushPromises()

      expect(calls().at(-1)).toMatchObject({
        method: 'POST',
        path: '/candidaturas',
        body: { vagaId: 'v1' },
      })
      expect(wrapper.find('[data-test="candidatar"]').exists()).toBe(false)
      expect(wrapper.get('[data-test="candidatura"]').text()).toBe('Candidatura: Interesse')
    })

    it('mostra o status em vez do botão para quem já se candidatou', async () => {
      stubApi(respostas([candidaturaDe({ status: 'APLICADO' })]))

      const wrapper = await montar()

      expect(wrapper.find('[data-test="candidatar"]').exists()).toBe(false)
      expect(wrapper.get('[data-test="candidatura"]').text()).toBe('Candidatura: Aplicado')
    })

    it('se a candidatura já existia (409), atualiza a tela sem mostrar erro', async () => {
      let existe = false
      stubApi((req) => {
        if (req.method === 'POST') {
          existe = true
          return jsonResponse(409, { erro: 'Você já tem uma candidatura para esta vaga' })
        }
        return respostas(existe ? [candidaturaDe({ status: 'ENTREVISTA' })] : [])(req)
      })
      const wrapper = await montar()

      await wrapper.get('[data-test="candidatar"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-test="erro"]').exists()).toBe(false)
      expect(wrapper.get('[data-test="candidatura"]').text()).toBe('Candidatura: Entrevista')
    })

    it('mostra o erro quando a candidatura falha por outro motivo', async () => {
      stubApi((req) =>
        req.method === 'POST'
          ? jsonResponse(400, { erro: 'Vaga informada não existe' })
          : respostas()(req),
      )
      const wrapper = await montar()

      await wrapper.get('[data-test="candidatar"]').trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-test="erro"]').text()).toBe('Vaga informada não existe')
      expect(wrapper.find('[data-test="candidatar"]').exists()).toBe(true)
    })
  })
})
