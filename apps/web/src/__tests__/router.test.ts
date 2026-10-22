import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestRouter, jsonResponse, logarComTokens, usuarioAna } from './helpers'

describe('guardas de rota', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('manda para o login quem não está logado, guardando o destino', async () => {
    const router = createTestRouter()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/')
  })

  it('deixa entrar quem está logado', async () => {
    logarComTokens()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, usuarioAna)))
    const router = createTestRouter()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('tira quem está logado das telas de login e cadastro', async () => {
    logarComTokens()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, usuarioAna)))
    const router = createTestRouter()

    await router.push('/cadastro')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('volta para o login quando o token salvo não vale mais', async () => {
    logarComTokens()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401)))
    const router = createTestRouter()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
    expect(localStorage.length).toBe(0)
  })
})
