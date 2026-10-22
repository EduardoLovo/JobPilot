import { AppError } from '../../errors/app-error.js'
import type { EmpresaRepository } from '../empresas/empresa.repository.js'
import type { VagaData, VagaRepository } from './vaga.repository.js'
import type { VagaFiltros, VagaInput } from './vaga.schemas.js'

export function createVagaService(vagas: VagaRepository, empresas: EmpresaRepository) {
  async function getOrFail(id: string) {
    const vaga = await vagas.findById(id)
    if (!vaga) throw new AppError(404, 'Vaga não encontrada')
    return vaga
  }

  // A empresa vem no corpo da requisição, então empresa inexistente é erro do cliente (400)
  async function toData(input: VagaInput): Promise<VagaData> {
    if (!(await empresas.findById(input.empresaId))) {
      throw new AppError(400, 'Empresa informada não existe')
    }

    return {
      empresaId: input.empresaId,
      titulo: input.titulo,
      descricao: input.descricao,
      url: input.url ?? null,
      modalidade: input.modalidade ?? null,
      senioridade: input.senioridade ?? null,
    }
  }

  return {
    list: (filtros: VagaFiltros) => vagas.list(filtros),

    get: getOrFail,

    async create(input: VagaInput) {
      return vagas.create(await toData(input))
    },

    async update(id: string, input: VagaInput) {
      await getOrFail(id)
      return vagas.update(id, await toData(input))
    },

    async delete(id: string) {
      await getOrFail(id)
      await vagas.delete(id)
    },
  }
}

export type VagaService = ReturnType<typeof createVagaService>
