import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma, resetDatabase } from './helpers.js'

// Regras que vivem no banco (únicos, chaves estrangeiras e cascatas). Os testes em memória
// não enxergam nada disso, então só um Postgres de verdade garante que o schema se comporta.
async function cenario() {
  const usuario = await prisma.usuario.create({
    data: { nome: 'Ana', email: 'ana@exemplo.com', senhaHash: 'hash' },
  })
  const empresa = await prisma.empresa.create({ data: { nome: 'Nubank' } })
  const vaga = await prisma.vaga.create({
    data: { empresaId: empresa.id, titulo: 'Dev Vue', descricao: 'Front-end' },
  })
  const curriculo = await prisma.curriculo.create({
    data: { usuarioId: usuario.id, conteudo: 'Meu currículo', ativo: true },
  })
  const candidatura = await prisma.candidatura.create({
    data: { usuarioId: usuario.id, vagaId: vaga.id },
  })
  return { usuario, empresa, vaga, curriculo, candidatura }
}

describe('Schema do banco', () => {
  beforeEach(resetDatabase)
  afterAll(() => prisma.$disconnect())

  it('começa a candidatura no status INTERESSE', async () => {
    const { candidatura } = await cenario()

    expect(candidatura.status).toBe('INTERESSE')
  })

  it('não aceita duas candidaturas da mesma pessoa para a mesma vaga', async () => {
    const { usuario, vaga } = await cenario()

    await expect(
      prisma.candidatura.create({ data: { usuarioId: usuario.id, vagaId: vaga.id } }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('aceita a mesma vaga para pessoas diferentes', async () => {
    const { vaga } = await cenario()
    const outra = await prisma.usuario.create({
      data: { nome: 'Bia', email: 'bia@exemplo.com', senhaHash: 'hash' },
    })

    await expect(
      prisma.candidatura.create({ data: { usuarioId: outra.id, vagaId: vaga.id } }),
    ).resolves.toBeDefined()
  })

  it('permite só uma análise de IA por candidatura', async () => {
    const { candidatura, curriculo } = await cenario()
    const analise = {
      candidaturaId: candidatura.id,
      curriculoId: curriculo.id,
      score: 80,
      palavrasFaltando: ['Docker'],
      recomendacoes: 'Citar Docker',
    }
    await prisma.analiseIa.create({ data: analise })

    await expect(prisma.analiseIa.create({ data: analise })).rejects.toMatchObject({
      code: 'P2002',
    })
  })

  it('guarda a lista de palavras faltando como JSON', async () => {
    const { candidatura, curriculo } = await cenario()

    const analise = await prisma.analiseIa.create({
      data: {
        candidaturaId: candidatura.id,
        curriculoId: curriculo.id,
        score: 72,
        palavrasFaltando: ['Docker', 'CI/CD'],
        recomendacoes: 'Destacar projetos com Docker',
      },
    })

    expect(analise.palavrasFaltando).toEqual(['Docker', 'CI/CD'])
  })

  it('apagar o usuário apaga currículos, candidaturas, etapas e análises dele', async () => {
    const { usuario, candidatura, curriculo } = await cenario()
    await prisma.etapa.create({
      data: { candidaturaId: candidatura.id, tipo: 'ENTREVISTA_RH', data: new Date() },
    })
    await prisma.analiseIa.create({
      data: {
        candidaturaId: candidatura.id,
        curriculoId: curriculo.id,
        score: 50,
        palavrasFaltando: [],
        recomendacoes: 'Ok',
      },
    })

    await prisma.usuario.delete({ where: { id: usuario.id } })

    expect(await prisma.curriculo.count()).toBe(0)
    expect(await prisma.candidatura.count()).toBe(0)
    expect(await prisma.etapa.count()).toBe(0)
    expect(await prisma.analiseIa.count()).toBe(0)
    // A vaga e a empresa não pertencem à pessoa, então continuam
    expect(await prisma.vaga.count()).toBe(1)
    expect(await prisma.empresa.count()).toBe(1)
  })

  it('apagar a vaga apaga as candidaturas dela, mas preserva o usuário', async () => {
    const { vaga } = await cenario()

    await prisma.vaga.delete({ where: { id: vaga.id } })

    expect(await prisma.candidatura.count()).toBe(0)
    expect(await prisma.usuario.count()).toBe(1)
  })

  it('o banco recusa apagar empresa que ainda tem vagas', async () => {
    const { empresa } = await cenario()

    await expect(prisma.empresa.delete({ where: { id: empresa.id } })).rejects.toMatchObject({
      code: 'P2003',
    })
  })

  it('apagar o currículo apaga as análises feitas com ele, mas preserva a candidatura', async () => {
    const { candidatura, curriculo } = await cenario()
    await prisma.analiseIa.create({
      data: {
        candidaturaId: candidatura.id,
        curriculoId: curriculo.id,
        score: 60,
        palavrasFaltando: [],
        recomendacoes: 'Ok',
      },
    })

    await prisma.curriculo.delete({ where: { id: curriculo.id } })

    expect(await prisma.analiseIa.count()).toBe(0)
    expect(await prisma.candidatura.count()).toBe(1)
  })
})
