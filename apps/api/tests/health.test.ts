import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers/test-app.js'

describe('GET /health', () => {
  it('responde que a API está no ar', async () => {
    const res = await request(createTestApp().app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', service: 'jobpilot-api' })
  })
})
