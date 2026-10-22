import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { JobPilotApiError, type ApiClient } from './api-client.js'

const STATUS = ['INTERESSE', 'APLICADO', 'ENTREVISTA', 'OFERTA', 'ENCERRADO'] as const

// Formas que a API do JobPilot devolve (só os campos que as ferramentas usam)
interface Candidatura {
  id: string
  vagaId: string
  status: string
  dataAplicacao: string | null
  proximoFollowup: string | null
  atualizadoEm: string
  vaga: { id: string; titulo: string; empresa: { id: string; nome: string } }
  proximosStatus: string[]
}

interface Vaga {
  titulo: string
  descricao: string
  url: string | null
  modalidade: string | null
  senioridade: string | null
  empresa: { nome: string }
}

interface Etapa {
  tipo: string
  data: string
  anotacoes: string | null
}

interface Curriculo {
  id: string
  conteudo: string
  criadoEm: string
}

const DIA_EM_MS = 86_400_000

// O resultado de uma ferramenta é texto. Erros viram resultado com isError (e não exceção), para o
// Claude ler o motivo e explicar à pessoa em vez de a conversa quebrar.
async function comoResultado(executar: () => Promise<unknown>) {
  try {
    const dados = await executar()
    return { content: [{ type: 'text' as const, text: JSON.stringify(dados, null, 2) }] }
  } catch (erro) {
    const texto =
      erro instanceof JobPilotApiError ? erro.message : 'Erro inesperado ao consultar o JobPilot.'
    return { isError: true, content: [{ type: 'text' as const, text: texto }] }
  }
}

export function registrarFerramentas(
  server: McpServer,
  api: ApiClient,
  agora: () => Date = () => new Date(),
) {
  server.registerTool(
    'status_api',
    {
      title: 'Status da API',
      description: 'Verifica se a API do JobPilot está no ar. Não precisa de login.',
      annotations: { readOnlyHint: true },
    },
    () => comoResultado(() => api.get('/health', { auth: false })),
  )

  server.registerTool(
    'listar_candidaturas',
    {
      title: 'Listar candidaturas',
      description:
        'Lista as candidaturas a vagas da pessoa, da alterada mais recentemente para a mais antiga. ' +
        'Cada item traz a vaga, a empresa, o status, as datas, há quantos dias está parada ' +
        '(sem mudar de status nem de datas) e para quais status pode ser movida. ' +
        'Use os filtros para achar candidaturas em um status ou paradas há muito tempo.',
      inputSchema: {
        status: z.enum(STATUS).optional().describe('Só as candidaturas neste status'),
        parada_ha_dias: z
          .number()
          .int()
          .min(1)
          .max(365)
          .optional()
          .describe('Só as candidaturas paradas há pelo menos este número de dias'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ status, parada_ha_dias }) =>
      comoResultado(async () => {
        const consulta = status ? `?status=${status}` : ''
        const candidaturas = await api.get<Candidatura[]>(`/candidaturas${consulta}`)

        const resumo = candidaturas
          .map((c) => ({
            id: c.id,
            vaga: c.vaga.titulo,
            empresa: c.vaga.empresa.nome,
            status: c.status,
            aplicada_em: c.dataAplicacao,
            proximo_followup: c.proximoFollowup,
            dias_parada: Math.floor(
              (agora().getTime() - new Date(c.atualizadoEm).getTime()) / DIA_EM_MS,
            ),
            pode_mover_para: c.proximosStatus,
          }))
          .filter((c) => parada_ha_dias === undefined || c.dias_parada >= parada_ha_dias)

        return { total: resumo.length, candidaturas: resumo }
      }),
  )

  server.registerTool(
    'detalhar_candidatura',
    {
      title: 'Detalhar candidatura',
      description:
        'Mostra tudo de uma candidatura: a vaga completa (com a descrição), as datas, o status e a ' +
        'linha do tempo de etapas (triagem, entrevistas, testes) com as anotações. ' +
        'Peça o id com listar_candidaturas.',
      inputSchema: {
        id: z.uuid().describe('Id da candidatura, como vem em listar_candidaturas'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ id }) =>
      comoResultado(async () => {
        const [candidatura, etapas] = await Promise.all([
          api.get<Candidatura>(`/candidaturas/${id}`),
          api.get<Etapa[]>(`/candidaturas/${id}/etapas`),
        ])
        const vaga = await api.get<Vaga>(`/vagas/${candidatura.vagaId}`)

        return {
          id: candidatura.id,
          status: candidatura.status,
          pode_mover_para: candidatura.proximosStatus,
          aplicada_em: candidatura.dataAplicacao,
          proximo_followup: candidatura.proximoFollowup,
          vaga: {
            titulo: vaga.titulo,
            empresa: vaga.empresa.nome,
            modalidade: vaga.modalidade,
            senioridade: vaga.senioridade,
            link: vaga.url,
            descricao: vaga.descricao,
          },
          etapas: etapas.map((e) => ({ tipo: e.tipo, data: e.data, anotacoes: e.anotacoes })),
        }
      }),
  )

  server.registerTool(
    'obter_curriculo_ativo',
    {
      title: 'Obter currículo ativo',
      description:
        'Devolve o texto do currículo ativo da pessoa (só um fica ativo por vez) e a data em que ' +
        'foi salvo. Use para comparar o currículo com uma vaga, preparar uma entrevista ou ' +
        'sugerir ajustes. Se a pessoa ainda não salvou um currículo, avisa para cadastrá-lo na ' +
        'tela Currículo do JobPilot.',
      annotations: { readOnlyHint: true },
    },
    () =>
      comoResultado(async () => {
        const curriculo = await api.get<Curriculo>('/curriculos/ativo')
        return { id: curriculo.id, salvo_em: curriculo.criadoEm, conteudo: curriculo.conteudo }
      }),
  )

  server.registerTool(
    'mover_candidatura',
    {
      title: 'Mover candidatura',
      description:
        'Muda o status de uma candidatura (por exemplo, de APLICADO para ENTREVISTA). ' +
        'ESTA FERRAMENTA ALTERA DADOS: confirme com a pessoa qual candidatura vai mover, e para ' +
        'qual status, antes de usá-la. ' +
        'Respeita as regras do kanban: avança uma etapa por vez, pode voltar uma etapa e reabrir ' +
        'uma candidatura encerrada; não dá para pular etapas. ' +
        'Pegue o id e os destinos permitidos (pode_mover_para) em listar_candidaturas.',
      inputSchema: {
        id: z.uuid().describe('Id da candidatura, como vem em listar_candidaturas'),
        status: z.enum(STATUS).describe('Novo status da candidatura'),
      },
      annotations: {
        readOnlyHint: false,
        // Muda o status, mas dá para desfazer movendo de volta; nada é apagado
        destructiveHint: false,
        // Pedir o mesmo status duas vezes não muda nada além da primeira
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ id, status }) =>
      comoResultado(async () => {
        const atual = await api.get<Candidatura>(`/candidaturas/${id}`)
        const alvo = `${atual.vaga.titulo} (${atual.vaga.empresa.nome})`
        const identificacao = { id, vaga: atual.vaga.titulo, empresa: atual.vaga.empresa.nome }

        if (atual.status === status) {
          return {
            mudou: false,
            mensagem: `A candidatura a ${alvo} já está em ${status}. Nada foi alterado.`,
            ...identificacao,
            status_anterior: atual.status,
            status_atual: atual.status,
            pode_mover_para: atual.proximosStatus,
          }
        }

        // A lista de destinos vem da própria API, então as regras continuam num lugar só
        if (!atual.proximosStatus.includes(status)) {
          throw new JobPilotApiError(
            409,
            `Não é possível mover a candidatura a ${alvo} de ${atual.status} para ${status}. ` +
              `Destinos permitidos a partir de ${atual.status}: ${atual.proximosStatus.join(', ')}.`,
          )
        }

        const movida = await api.patch<Candidatura>(`/candidaturas/${id}/status`, { status })
        return {
          mudou: true,
          mensagem: `Candidatura a ${alvo} movida de ${atual.status} para ${movida.status}.`,
          ...identificacao,
          status_anterior: atual.status,
          status_atual: movida.status,
          pode_mover_para: movida.proximosStatus,
        }
      }),
  )
}
