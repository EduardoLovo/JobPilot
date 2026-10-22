import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HomeView from '@/views/HomeView.vue'

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra a API como online quando /health responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.get('[data-test="api-status"]').text()).toContain('online')
  })

  it('mostra a API como offline quando a requisição falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem conexão')))

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.get('[data-test="api-status"]').text()).toContain('offline')
  })
})
