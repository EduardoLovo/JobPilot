import { Router } from 'express'
import { requireAuth } from '../../middlewares/require-auth.js'
import { idParamSchema } from '../../shared/schemas.js'
import {
  atualizarCandidaturaSchema,
  criarCandidaturaSchema,
  listCandidaturasQuerySchema,
  mudarStatusSchema,
} from './candidatura.schemas.js'
import type { CandidaturaService } from './candidatura.service.js'

export function createCandidaturaRouter(candidaturas: CandidaturaService) {
  const router = Router()

  router.use(requireAuth)

  router.get('/', async (req, res) => {
    res.json(
      await candidaturas.list(res.locals.usuarioId, listCandidaturasQuerySchema.parse(req.query)),
    )
  })

  router.post('/', async (req, res) => {
    res
      .status(201)
      .json(await candidaturas.create(res.locals.usuarioId, criarCandidaturaSchema.parse(req.body)))
  })

  router.get('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    res.json(await candidaturas.get(id, res.locals.usuarioId))
  })

  router.patch('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    res.json(
      await candidaturas.update(
        id,
        res.locals.usuarioId,
        atualizarCandidaturaSchema.parse(req.body),
      ),
    )
  })

  router.patch('/:id/status', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    const { status } = mudarStatusSchema.parse(req.body)
    res.json(await candidaturas.changeStatus(id, res.locals.usuarioId, status))
  })

  router.delete('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    await candidaturas.delete(id, res.locals.usuarioId)
    res.status(204).end()
  })

  return router
}
