import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tokenStorage } from '@/services/token-storage'
import { useAuthStore } from '@/stores/auth'
import { jsonResponse, logarComTokens, usuarioAna } from './helpers'

describe('store de auth', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('faz login, guarda os tokens e o usuário', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { usuario: usuarioAna, accessToken: 'a', refreshToken: 'r' }),
        ),
    )
    const auth = useAuthStore()

    await auth.login('ana@exemplo.com', 'senha-forte-123')

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.usuario).toEqual(usuarioAna)
    expect(tokenStorage.get()).toEqual({ accessToken: 'a', refreshToken: 'r' })
  })

  it('continua logado depois de recarregar a página e busca o usuário na API', async () => {
    logarComTokens()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, usuarioAna))
    vi.stubGlobal('fetch', fetchMock)
    const auth = useAuthStore()

    expect(auth.isAuthenticated).toBe(true)
    await auth.loadUsuario()

    expect(fetchMock.mock.calls[0][0]).toContain('/auth/me')
    expect(auth.usuario).toEqual(usuarioAna)
  })

  it('sai e limpa os tokens', () => {
    logarComTokens()
    const auth = useAuthStore()

    auth.logout()

    expect(auth.isAuthenticated).toBe(false)
    expect(tokenStorage.get()).toBeNull()
  })
})
