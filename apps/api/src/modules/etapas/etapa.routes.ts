import { Router } from 'express'
import { requireAuth } from '../../middlewares/require-auth.js'
import { etapaIdParamsSchema, etapaParamsSchema, etapaSchema } from './etapa.schemas.js'
import type { EtapaService } from './etapa.service.js'

// Montado em /candidaturas/:candidaturaId/etapas; mergeParams deixa ler o candidaturaId da URL
export function createEtapaRouter(etapas: EtapaService) {
  const router = Router({ mergeParams: true })

  router.use(requireAuth)

  router.get('/', async (req, res) => {
    const { candidaturaId } = etapaParamsSchema.parse(req.params)
    res.json(await etapas.list(candidaturaId, res.locals.usuarioId))
  })

  router.post('/', async (req, res) => {
    const { candidaturaId } = etapaParamsSchema.parse(req.params)
    res
      .status(201)
      .json(await etapas.create(candidaturaId, res.locals.usuarioId, etapaSchema.parse(req.body)))
  })

  router.put('/:etapaId', async (req, res) => {
    const { candidaturaId, etapaId } = etapaIdParamsSchema.parse(req.params)
    res.json(
      await etapas.update(
        candidaturaId,
        etapaId,
        res.locals.usuarioId,
        etapaSchema.parse(req.body),
      ),
    )
  })

  router.delete('/:etapaId', async (req, res) => {
    const { candidaturaId, etapaId } = etapaIdParamsSchema.parse(req.params)
    await etapas.delete(candidaturaId, etapaId, res.locals.usuarioId)
    res.status(204).end()
  })

  return router
}
