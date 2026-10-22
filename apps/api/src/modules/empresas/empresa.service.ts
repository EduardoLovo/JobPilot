import { AppError } from '../../errors/app-error.js'
import type { EmpresaInput } from './empresa.schemas.js'
import type { EmpresaRepository } from './empresa.repository.js'

export function createEmpresaService(empresas: EmpresaRepository) {
  async function getOrFail(id: string) {
    const empresa = await empresas.findById(id)
    if (!empresa) throw new AppError(404, 'Empresa não encontrada')
    return empresa
  }

  return {
    list: (busca?: string) => empresas.list(busca),

    get: getOrFail,

    create: (data: EmpresaInput) => empresas.create({ nome: data.nome, site: data.site ?? null }),

    async update(id: string, data: EmpresaInput) {
      await getOrFail(id)
      return empresas.update(id, { nome: data.nome, site: data.site ?? null })
    },

    async delete(id: string) {
      await getOrFail(id)

      // Apagar a empresa apagaria em cascata vagas que podem ter candidaturas
      if ((await empresas.countVagas(id)) > 0) {
        throw new AppError(409, 'Empresa possui vagas cadastradas; remova as vagas primeiro')
      }

      await empresas.delete(id)
    },
  }
}

export type EmpresaService = ReturnType<typeof createEmpresaService>
