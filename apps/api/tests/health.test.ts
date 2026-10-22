import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { createInMemoryUsuarioRepository } from './helpers/in-memory-usuario-repository.js'

describe('GET /health', () => {
  it('responde que a API está no ar', async () => {
    const app = createApp({ usuarios: createInMemoryUsuarioRepository().repo })
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', service: 'jobpilot-api' })
  })
})
