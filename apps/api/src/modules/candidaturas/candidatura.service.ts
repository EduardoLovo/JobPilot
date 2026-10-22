import { AppError } from '../../errors/app-error.js'
import type { VagaRepository } from '../vagas/vaga.repository.js'
import type {
  CandidaturaRecord,
  CandidaturaRepository,
  CandidaturaUpdate,
} from './candidatura.repository.js'
import type {
  AtualizarCandidaturaInput,
  CandidaturaFiltros,
  CriarCandidaturaInput,
} from './candidatura.schemas.js'
import { podeMover, proximosStatus, ROTULOS, type StatusCandidatura } from './status.js'

const JA_CANDIDATADA = 'Você já tem uma candidatura para esta vaga'

// "AAAA-MM-DD" vira meia-noite UTC, que é como o Postgres guarda colunas do tipo date
const paraData = (dia: string | null | undefined) => (dia ? new Date(dia) : null)
const paraDia = (data: Date | null) => (data ? data.toISOString().slice(0, 10) : null)

// Datas voltam como "AAAA-MM-DD" e cada candidatura informa para onde pode ser movida (o kanban
// usa isso para saber onde o card pode ser solto)
function paraApi({ usuarioId: _usuarioId, ...candidatura }: CandidaturaRecord) {
  return {
    ...candidatura,
    dataAplicacao: paraDia(candidatura.dataAplicacao),
    proximoFollowup: paraDia(candidatura.proximoFollowup),
    proximosStatus: proximosStatus(candidatura.status),
  }
}

// Duas requisições simultâneas (clique duplo) passam juntas pela checagem e uma cai no índice único
const violouUnicidade = (erro: unknown) =>
  typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 'P2002'

export function createCandidaturaService(
  candidaturas: CandidaturaRepository,
  vagas: VagaRepository,
) {
  // Candidatura de outra pessoa responde 404, igual a uma que não existe, para não revelar o id
  async function getOrFail(id: string, usuarioId: string) {
    const candidatura = await candidaturas.findById(id, usuarioId)
    if (!candidatura) throw new AppError(404, 'Candidatura não encontrada')
    return candidatura
  }

  return {
    async list(usuarioId: string, filtros: CandidaturaFiltros) {
      return (await candidaturas.list(usuarioId, filtros)).map(paraApi)
    },

    async get(id: string, usuarioId: string) {
      return paraApi(await getOrFail(id, usuarioId))
    },

    async create(usuarioId: string, input: CriarCandidaturaInput) {
      if (!(await vagas.findById(input.vagaId))) {
        throw new AppError(400, 'Vaga informada não existe')
      }
      if (await candidaturas.findByUsuarioVaga(usuarioId, input.vagaId)) {
        throw new AppError(409, JA_CANDIDATADA)
      }

      try {
        return paraApi(
          await candidaturas.create({
            usuarioId,
            vagaId: input.vagaId,
            proximoFollowup: paraData(input.proximoFollowup),
          }),
        )
      } catch (erro) {
        if (violouUnicidade(erro)) throw new AppError(409, JA_CANDIDATADA)
        throw erro
      }
    },

    async update(id: string, usuarioId: string, input: AtualizarCandidaturaInput) {
      await getOrFail(id, usuarioId)

      const dados: CandidaturaUpdate = {}
      if (input.dataAplicacao !== undefined) dados.dataAplicacao = paraData(input.dataAplicacao)
      if (input.proximoFollowup !== undefined)
        dados.proximoFollowup = paraData(input.proximoFollowup)

      return paraApi(await candidaturas.update(id, dados))
    },

    async changeStatus(id: string, usuarioId: string, novo: StatusCandidatura) {
      const atual = await getOrFail(id, usuarioId)

      // Soltar o card na mesma coluna não muda nada
      if (atual.status === novo) return paraApi(atual)

      if (!podeMover(atual.status, novo)) {
        throw new AppError(
          409,
          `Não é possível mover a candidatura de ${ROTULOS[atual.status]} para ${ROTULOS[novo]}`,
        )
      }

      return paraApi(await candidaturas.update(id, { status: novo }))
    },

    async delete(id: string, usuarioId: string) {
      await getOrFail(id, usuarioId)
      await candidaturas.delete(id)
    },
  }
}

export type CandidaturaService = ReturnType<typeof createCandidaturaService>
