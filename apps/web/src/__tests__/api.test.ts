import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, setOnSessionExpired } from '@/services/api'
import { tokenStorage } from '@/services/token-storage'
import { jsonResponse, logarComTokens } from './helpers'

describe('cliente da API', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envia o access token no header Authorization', async () => {
    logarComTokens('meu-token')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await api('/auth/me')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer meu-token')
  })

  it('renova o token quando recebe 401 e repete a requisição', async () => {
    logarComTokens('vencido', 'refresh-1')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { erro: 'Token inválido ou expirado' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'novo', refreshToken: 'refresh-2' }))
      .mockResolvedValueOnce(jsonResponse(200, { nome: 'Ana' }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await api<{ nome: string }>('/auth/me')

    expect(res.nome).toBe('Ana')
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh')
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer novo')
    expect(tokenStorage.get()).toEqual({ accessToken: 'novo', refreshToken: 'refresh-2' })
  })

  it('encerra a sessão quando o refresh também falha', async () => {
    logarComTokens()
    const expirou = vi.fn()
    setOnSessionExpired(expirou)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse(401)).mockResolvedValueOnce(jsonResponse(401)),
    )

    await expect(api('/auth/me')).rejects.toMatchObject({ status: 401 })
    expect(expirou).toHaveBeenCalled()
    expect(tokenStorage.get()).toBeNull()
  })

  it('não tenta refresh em rotas públicas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { erro: 'E-mail ou senha inválidos' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api('/auth/login', { method: 'POST', body: {}, auth: false })).rejects.toThrow(
      'E-mail ou senha inválidos',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('converte o erro da API em ApiError com os detalhes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          erro: 'Dados inválidos',
          detalhes: [{ campo: 'email', mensagem: 'E-mail inválido' }],
        }),
      ),
    )

    const erro = await api('/auth/register', { method: 'POST', auth: false }).catch((e) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).detalhes).toEqual([{ campo: 'email', mensagem: 'E-mail inválido' }])
  })
})
