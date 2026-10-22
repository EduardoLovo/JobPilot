import { Router } from 'express'
import { requireAuth } from '../../middlewares/require-auth.js'
import { idParamSchema } from '../../shared/schemas.js'
import { empresaSchema, listEmpresasQuerySchema } from './empresa.schemas.js'
import type { EmpresaService } from './empresa.service.js'

export function createEmpresaRouter(empresas: EmpresaService) {
  const router = Router()

  router.use(requireAuth)

  router.get('/', async (req, res) => {
    const { busca } = listEmpresasQuerySchema.parse(req.query)
    res.json(await empresas.list(busca))
  })

  router.post('/', async (req, res) => {
    res.status(201).json(await empresas.create(empresaSchema.parse(req.body)))
  })

  router.get('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    res.json(await empresas.get(id))
  })

  router.put('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    res.json(await empresas.update(id, empresaSchema.parse(req.body)))
  })

  router.delete('/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    await empresas.delete(id)
    res.status(204).end()
  })

  return router
}
