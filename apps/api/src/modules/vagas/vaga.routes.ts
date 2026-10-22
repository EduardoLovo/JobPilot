import { Router } from 'express'
import { requireAuth } from '../../middlewares/require-auth.js'
import { idParamSchema } from '../../shared/schemas.js'
import { listVagasQuerySchema, vagaSchema } from './vaga.schemas.js'
import type { VagaService } from './vaga.service.js'

export function createVagaRouter(vagas: VagaService) {
  const router = Router()

  router.use(requireAuth)

  router.get('/', async (req, res) => {
    res.json(await vagas.list(listVagasQuerySchema.parse(req.query)))
  })

  router.post('/', async (req, res) => {
    res.status(201).json(await vagas.create(vagaSchema.parse(req.body)))
  })

  router.get('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    res.json(await vagas.get(id))
  })

  router.put('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    res.json(await vagas.update(id, vagaSchema.parse(req.body)))
  })

  router.delete('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    await vagas.delete(id)
    res.status(204).end()
  })

  return router
}
