import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers/test-app.js'

// Erros de quem chama a API (JSON quebrado, corpo enorme) são 4xx, nunca 500
describe('corpo da requisição inválido', () => {
  it('responde 400 para JSON malformado', async () => {
    const { app } = createTestApp()

    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "ana@exemplo.com", ')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ erro: 'JSON inválido' })
  })

  it('responde 413 para corpo grande demais', async () => {
    const { app } = createTestApp()

    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a'.repeat(200_000), senha: 'x' }))

    expect(res.status).toBe(413)
    expect(res.body).toEqual({ erro: 'Corpo da requisição grande demais' })
  })
})
