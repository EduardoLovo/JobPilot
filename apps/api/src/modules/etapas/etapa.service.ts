import { AppError } from '../../errors/app-error.js'
import type { CandidaturaRepository } from '../candidaturas/candidatura.repository.js'
import type { EtapaData, EtapaRepository } from './etapa.repository.js'
import type { EtapaInput } from './etapa.schemas.js'

function paraDados(input: EtapaInput): EtapaData {
  return {
    tipo: input.tipo,
    // Qualquer fuso de entrada vira o mesmo instante; a API sempre devolve em UTC
    data: new Date(input.data),
    // Anotações em branco viram "sem anotações"
    anotacoes: input.anotacoes || null,
  }
}

export function createEtapaService(etapas: EtapaRepository, candidaturas: CandidaturaRepository) {
  // Candidatura de outra pessoa responde 404, igual a uma que não existe, para não revelar o id
  async function garantirCandidatura(candidaturaId: string, usuarioId: string) {
    if (!(await candidaturas.findById(candidaturaId, usuarioId))) {
      throw new AppError(404, 'Candidatura não encontrada')
    }
  }

  // A etapa precisa ser da candidatura da URL; uma etapa de outra candidatura também é 404
  async function etapaOuFalha(etapaId: string, candidaturaId: string) {
    const etapa = await etapas.findById(etapaId, candidaturaId)
    if (!etapa) throw new AppError(404, 'Etapa não encontrada')
    return etapa
  }

  return {
    async list(candidaturaId: string, usuarioId: string) {
      await garantirCandidatura(candidaturaId, usuarioId)
      return etapas.list(candidaturaId)
    },

    async create(candidaturaId: string, usuarioId: string, input: EtapaInput) {
      await garantirCandidatura(candidaturaId, usuarioId)
      return etapas.create(candidaturaId, paraDados(input))
    },

    async update(candidaturaId: string, etapaId: string, usuarioId: string, input: EtapaInput) {
      await garantirCandidatura(candidaturaId, usuarioId)
      await etapaOuFalha(etapaId, candidaturaId)
      return etapas.update(etapaId, paraDados(input))
    },

    async delete(candidaturaId: string, etapaId: string, usuarioId: string) {
      await garantirCandidatura(candidaturaId, usuarioId)
      await etapaOuFalha(etapaId, candidaturaId)
      await etapas.delete(etapaId)
    },
  }
}

export type EtapaService = ReturnType<typeof createEtapaService>
