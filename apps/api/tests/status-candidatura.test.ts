import { describe, expect, it } from 'vitest'
import {
  podeMover,
  proximosStatus,
  STATUS,
  type StatusCandidatura,
} from '../src/modules/candidaturas/status.js'

// A tabela completa, escrita à mão e independente da implementação: se alguém mudar uma regra
// sem querer, o teste acusa
const PERMITIDAS: Record<StatusCandidatura, StatusCandidatura[]> = {
  INTERESSE: ['APLICADO', 'ENCERRADO'],
  APLICADO: ['INTERESSE', 'ENTREVISTA', 'OFERTA', 'ENCERRADO'],
  ENTREVISTA: ['APLICADO', 'OFERTA', 'ENCERRADO'],
  OFERTA: ['ENTREVISTA', 'ENCERRADO'],
  ENCERRADO: ['INTERESSE', 'APLICADO', 'ENTREVISTA'],
}

describe('regras de status da candidatura', () => {
  const pares = STATUS.flatMap((de) => STATUS.map((para) => [de, para] as const))

  it.each(pares)('%s → %s', (de, para) => {
    expect(podeMover(de, para)).toBe(PERMITIDAS[de].includes(para))
  })

  it('nunca permite "mover" para o mesmo status', () => {
    for (const status of STATUS) expect(podeMover(status, status)).toBe(false)
  })

  it('todo status tem pelo menos uma saída', () => {
    for (const status of STATUS) expect(proximosStatus(status).length).toBeGreaterThan(0)
  })

  it('não deixa pular direto para entrevista ou oferta sem ter se candidatado', () => {
    expect(podeMover('INTERESSE', 'ENTREVISTA')).toBe(false)
    expect(podeMover('INTERESSE', 'OFERTA')).toBe(false)
  })

  it('não reabre direto como oferta', () => {
    expect(podeMover('ENCERRADO', 'OFERTA')).toBe(false)
  })
})
