import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KanbanView from '@/views/KanbanView.vue'
import { stubApi } from './api-mock'
import { candidaturaDe, PROXIMOS } from './candidatura-mock'
import { createTestRouter, jsonResponse, logarComTokens } from './helpers'

async function montar() {
  const router = createTestRouter()
  await router.push('/')
  const wrapper = mount(KanbanView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof montar>>

const coluna = (wrapper: Wrapper, status: string) => wrapper.get(`[data-test="coluna-${status}"]`)
const titulosDa = (wrapper: Wrapper, status: string) =>
  coluna(wrapper, status)
    .findAll('[data-test="card"] h3')
    .map((h) => h.text())

const seletor = (wrapper: Wrapper, titulo = 'Desenvolvedora Vue') =>
  wrapper.get(`select[aria-label="Mover ${titulo}"]`)

// O jsdom não implementa DataTransfer, então os eventos de arraste levam um de mentira
const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' })

describe('KanbanView', () => {
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
    it('mostra uma coluna por status, com a contagem e os cards na coluna certa', async () => {
      stubApi(() =>
        jsonResponse(200, [
          candidaturaDe({ id: 'c1' }),
          candidaturaDe({
            id: 'c2',
            status: 'APLICADO',
            vaga: { id: 'v2', titulo: 'Dev Node', empresa: { id: 'e2', nome: 'Stone' } },
          }),
        ]),
      )

      const wrapper = await montar()

      expect(wrapper.findAll('[data-test^="coluna-"]')).toHaveLength(5)
      expect(titulosDa(wrapper, 'INTERESSE')).toEqual(['Desenvolvedora Vue'])
      expect(titulosDa(wrapper, 'APLICADO')).toEqual(['Dev Node'])
      expect(coluna(wrapper, 'APLICADO').text()).toContain('Stone')
      expect(coluna(wrapper, 'INTERESSE').get('.contagem').text()).toBe('1')
      expect(coluna(wrapper, 'OFERTA').get('.contagem').text()).toBe('0')
      expect(coluna(wrapper, 'OFERTA').text()).toContain('Nenhuma candidatura')
    })

    it('mostra as datas no formato brasileiro', async () => {
      stubApi(() =>
        jsonResponse(200, [
          candidaturaDe({ dataAplicacao: '2026-10-20', proximoFollowup: '2026-11-05' }),
        ]),
      )

      const wrapper = await montar()

      const card = wrapper.get('[data-test="card"]')
      expect(card.text()).toContain('Aplicada em 20/10/2026')
      expect(card.text()).toContain('Follow-up em 05/11/2026')
    })

    it('orienta a pessoa quando ainda não há candidaturas', async () => {
      stubApi(() => jsonResponse(200, []))

      const wrapper = await montar()

      expect(wrapper.get('[data-test="vazio"]').text()).toContain('Candidatar-se')
      expect(wrapper.findAll('[data-test^="coluna-"]')).toHaveLength(5)
    })

    it('mostra o erro quando a API falha', async () => {
      stubApi(() => jsonResponse(500, { erro: 'Erro interno do servidor' }))

      const wrapper = await montar()

      expect(wrapper.get('[data-test="erro"]').text()).toBe('Erro interno do servidor')
    })
  })

  describe('mover pelo seletor', () => {
    it('só oferece os destinos permitidos pelas regras', async () => {
      stubApi(() => jsonResponse(200, [candidaturaDe()]))

      const wrapper = await montar()

      const opcoes = seletor(wrapper)
        .findAll('option')
        .map((o) => o.text())
      expect(opcoes).toEqual(['Mover…', 'Aplicado', 'Encerrado'])
    })

    it('muda o status pela API e passa a oferecer os novos destinos', async () => {
      const { calls } = stubApi(({ method }) =>
        method === 'PATCH'
          ? jsonResponse(200, candidaturaDe({ status: 'APLICADO' }))
          : jsonResponse(200, [candidaturaDe()]),
      )
      const wrapper = await montar()

      await seletor(wrapper).setValue('APLICADO')
      await flushPromises()

      expect(calls().at(-1)).toMatchObject({
        method: 'PATCH',
        path: '/candidaturas/c1/status',
        body: { status: 'APLICADO' },
      })
      expect(titulosDa(wrapper, 'INTERESSE')).toEqual([])
      expect(titulosDa(wrapper, 'APLICADO')).toEqual(['Desenvolvedora Vue'])
      const opcoes = seletor(wrapper)
        .findAll('option')
        .map((o) => o.text())
      expect(opcoes).toContain('Entrevista')
    })

    it('move o card na hora, sem esperar a resposta da API', async () => {
      let responder: (resposta: Response) => void = () => {}
      stubApi(({ method }) =>
        method === 'PATCH'
          ? new Promise<Response>((resolve) => (responder = resolve))
          : jsonResponse(200, [candidaturaDe()]),
      )
      const wrapper = await montar()

      await seletor(wrapper).setValue('APLICADO')
      await flushPromises()

      expect(titulosDa(wrapper, 'APLICADO')).toEqual(['Desenvolvedora Vue'])
      // Enquanto espera, o card não aceita outro movimento
      expect(seletor(wrapper).attributes('disabled')).toBeDefined()

      responder(jsonResponse(200, candidaturaDe({ status: 'APLICADO' })))
      await flushPromises()
      expect(seletor(wrapper).attributes('disabled')).toBeUndefined()
    })

    it('devolve o card à coluna de origem e mostra o erro quando a API recusa', async () => {
      stubApi(({ method }) =>
        method === 'PATCH'
          ? jsonResponse(409, {
              erro: 'Não é possível mover a candidatura de Interesse para Aplicado',
            })
          : jsonResponse(200, [candidaturaDe()]),
      )
      const wrapper = await montar()

      await seletor(wrapper).setValue('APLICADO')
      await flushPromises()

      expect(titulosDa(wrapper, 'INTERESSE')).toEqual(['Desenvolvedora Vue'])
      expect(titulosDa(wrapper, 'APLICADO')).toEqual([])
      expect(wrapper.get('[data-test="erro"]').text()).toContain('Não é possível mover')
    })
  })

  describe('arrastar e soltar', () => {
    const cenario = () =>
      stubApi(({ method }) =>
        method === 'PATCH'
          ? jsonResponse(200, candidaturaDe({ status: 'APLICADO' }))
          : jsonResponse(200, [candidaturaDe()]),
      )

    it('destaca só as colunas onde o card pode ser solto', async () => {
      cenario()
      const wrapper = await montar()

      await wrapper.get('[data-test="card"]').trigger('dragstart', { dataTransfer: dataTransfer() })

      for (const permitido of PROXIMOS.INTERESSE) {
        expect(coluna(wrapper, permitido).classes()).toContain('permitida')
      }
      expect(coluna(wrapper, 'ENTREVISTA').classes()).not.toContain('permitida')
      expect(coluna(wrapper, 'OFERTA').classes()).not.toContain('permitida')

      await wrapper.get('[data-test="card"]').trigger('dragend')
      expect(coluna(wrapper, 'APLICADO').classes()).not.toContain('permitida')
    })

    it('aceita soltar numa coluna permitida e muda o status', async () => {
      const { calls } = cenario()
      const wrapper = await montar()
      await wrapper.get('[data-test="card"]').trigger('dragstart', { dataTransfer: dataTransfer() })

      const sobre = new Event('dragover', { bubbles: true, cancelable: true })
      Object.assign(sobre, { dataTransfer: dataTransfer() })
      coluna(wrapper, 'APLICADO').element.dispatchEvent(sobre)
      expect(sobre.defaultPrevented).toBe(true)

      await coluna(wrapper, 'APLICADO').trigger('drop', { dataTransfer: dataTransfer() })
      await flushPromises()

      expect(calls().at(-1)).toMatchObject({
        method: 'PATCH',
        path: '/candidaturas/c1/status',
        body: { status: 'APLICADO' },
      })
      expect(titulosDa(wrapper, 'APLICADO')).toEqual(['Desenvolvedora Vue'])
    })

    it('recusa soltar numa coluna que as regras não permitem', async () => {
      const { calls } = cenario()
      const wrapper = await montar()
      await wrapper.get('[data-test="card"]').trigger('dragstart', { dataTransfer: dataTransfer() })

      const sobre = new Event('dragover', { bubbles: true, cancelable: true })
      Object.assign(sobre, { dataTransfer: dataTransfer() })
      coluna(wrapper, 'ENTREVISTA').element.dispatchEvent(sobre)
      // Sem preventDefault o navegador mostra o cursor de "proibido" e não deixa soltar
      expect(sobre.defaultPrevented).toBe(false)

      await coluna(wrapper, 'ENTREVISTA').trigger('drop', { dataTransfer: dataTransfer() })
      await flushPromises()

      expect(calls().some((c) => c.method === 'PATCH')).toBe(false)
      expect(titulosDa(wrapper, 'INTERESSE')).toEqual(['Desenvolvedora Vue'])
    })

    it('não faz nada ao soltar o card na própria coluna', async () => {
      const { calls } = cenario()
      const wrapper = await montar()
      await wrapper.get('[data-test="card"]').trigger('dragstart', { dataTransfer: dataTransfer() })

      await coluna(wrapper, 'INTERESSE').trigger('drop', { dataTransfer: dataTransfer() })
      await flushPromises()

      expect(calls().some((c) => c.method === 'PATCH')).toBe(false)
    })
  })

  describe('remover', () => {
    it('remove o card depois de confirmar', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { calls } = stubApi(({ method }) =>
        method === 'DELETE' ? jsonResponse(204) : jsonResponse(200, [candidaturaDe()]),
      )
      const wrapper = await montar()

      await wrapper.get('.btn-perigo').trigger('click')
      await flushPromises()

      expect(calls().at(-1)).toMatchObject({ method: 'DELETE', path: '/candidaturas/c1' })
      expect(wrapper.find('[data-test="card"]').exists()).toBe(false)
    })

    it('mantém o card quando a pessoa cancela', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const { calls } = stubApi(() => jsonResponse(200, [candidaturaDe()]))
      const wrapper = await montar()

      await wrapper.get('.btn-perigo').trigger('click')
      await flushPromises()

      expect(calls().some((c) => c.method === 'DELETE')).toBe(false)
      expect(wrapper.find('[data-test="card"]').exists()).toBe(true)
    })
  })
})
