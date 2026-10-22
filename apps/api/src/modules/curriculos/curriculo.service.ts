import { AppError } from '../../errors/app-error.js'
import { violouUnicidade } from '../../shared/prisma-errors.js'
import type { CurriculoRecord, CurriculoRepository } from './curriculo.repository.js'
import type { CriarCurriculoInput, EditarCurriculoInput } from './curriculo.schemas.js'

const CONFLITO = 'Outra alteração nos seus currículos aconteceu ao mesmo tempo. Tente de novo'

function paraApi({ usuarioId: _usuarioId, ...curriculo }: CurriculoRecord) {
  return curriculo
}

export function createCurriculoService(curriculos: CurriculoRepository) {
  // Currículo de outra pessoa responde 404, igual a um que não existe, para não revelar o id
  async function getOrFail(id: string, usuarioId: string) {
    const curriculo = await curriculos.findById(id, usuarioId)
    if (!curriculo) throw new AppError(404, 'Currículo não encontrado')
    return curriculo
  }

  return {
    async list(usuarioId: string) {
      return (await curriculos.list(usuarioId)).map(paraApi)
    },

    async getAtivo(usuarioId: string) {
      const ativo = await curriculos.findAtivo(usuarioId)
      if (!ativo) throw new AppError(404, 'Você ainda não tem um currículo ativo')
      return paraApi(ativo)
    },

    async get(id: string, usuarioId: string) {
      return paraApi(await getOrFail(id, usuarioId))
    },

    async create(usuarioId: string, input: CriarCurriculoInput) {
      // O primeiro currículo já nasce ativo, para a análise de vagas ter o que usar
      const primeiro = (await curriculos.count(usuarioId)) === 0

      try {
        return paraApi(
          await curriculos.create({
            usuarioId,
            conteudo: input.conteudo,
            ativo: primeiro || input.ativo === true,
          }),
        )
      } catch (erro) {
        if (violouUnicidade(erro)) throw new AppError(409, CONFLITO)
        throw erro
      }
    },

    async update(id: string, usuarioId: string, input: EditarCurriculoInput) {
      await getOrFail(id, usuarioId)
      return paraApi(await curriculos.update(id, { conteudo: input.conteudo }))
    },

    async activate(id: string, usuarioId: string) {
      const atual = await getOrFail(id, usuarioId)
      if (atual.ativo) return paraApi(atual)

      try {
        return paraApi(await curriculos.activate(id, usuarioId))
      } catch (erro) {
        if (violouUnicidade(erro)) throw new AppError(409, CONFLITO)
        throw erro
      }
    },

    async delete(id: string, usuarioId: string) {
      const atual = await getOrFail(id, usuarioId)

      // Sem currículo ativo a análise de vagas fica sem base. Quem tem só um pode remover.
      if (atual.ativo && (await curriculos.count(usuarioId)) > 1) {
        throw new AppError(409, 'Ative outro currículo antes de remover o currículo ativo')
      }

      await curriculos.delete(id)
    },
  }
}

export type CurriculoService = ReturnType<typeof createCurriculoService>
