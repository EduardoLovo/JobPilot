import { Router } from 'express'
import { requireAuth } from '../../middlewares/require-auth.js'
import { idParamSchema } from '../../shared/schemas.js'
import { criarCurriculoSchema, editarCurriculoSchema } from './curriculo.schemas.js'
import type { CurriculoService } from './curriculo.service.js'

export function createCurriculoRouter(curriculos: CurriculoService) {
  const router = Router()

  router.use(requireAuth)

  router.get('/', async (_req, res) => {
    res.json(await curriculos.list(res.locals.usuarioId))
  })

  // Antes de /:id, senão "ativo" seria lido como um id
  router.get('/ativo', async (_req, res) => {
    res.json(await curriculos.getAtivo(res.locals.usuarioId))
  })

  router.post('/', async (req, res) => {
    res
      .status(201)
      .json(await curriculos.create(res.locals.usuarioId, criarCurriculoSchema.parse(req.body)))
  })

  router.get('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    res.json(await curriculos.get(id, res.locals.usuarioId))
  })

  router.put('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    res.json(
      await curriculos.update(id, res.locals.usuarioId, editarCurriculoSchema.parse(req.body)),
    )
  })

  router.post('/:id/ativar', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    res.json(await curriculos.activate(id, res.locals.usuarioId))
  })

  router.delete('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    await curriculos.delete(id, res.locals.usuarioId)
    res.status(204).end()
  })

  return router
}
