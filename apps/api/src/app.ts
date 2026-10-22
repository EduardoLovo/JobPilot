import cors from 'cors'
import express from 'express'

// O app é separado do server.ts para que os testes usem o Express sem abrir porta
export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'jobpilot-api' })
  })

  return app
}
