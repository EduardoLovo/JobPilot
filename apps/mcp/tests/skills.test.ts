import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { apiFalsa, conectar } from './helpers.js'

// As skills do projeto ficam em .claude/skills/<nome>/SKILL.md, na raiz do repositório
const pastaDasSkills = new URL('../../../.claude/skills/', import.meta.url)

function lerSkills() {
  return readdirSync(pastaDasSkills, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => {
      const texto = readFileSync(new URL(`${entrada.name}/SKILL.md`, pastaDasSkills), 'utf8')
      const partes = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(texto)
      return {
        pasta: entrada.name,
        cabecalho: partes?.[1] ?? '',
        corpo: partes?.[2] ?? '',
        valido: partes !== null,
      }
    })
}

const campo = (cabecalho: string, nome: string) =>
  new RegExp(`^${nome}:\\s*(.+)$`, 'm').exec(cabecalho)?.[1].trim()

describe('skills do projeto', () => {
  const skills = lerSkills()

  it('existe ao menos uma skill (o teste não passa por não achar nada)', () => {
    expect(skills.length).toBeGreaterThan(0)
  })

  describe.each(skills)('$pasta', ({ pasta, cabecalho, corpo, valido }) => {
    it('tem um cabeçalho (entre ---) e um corpo com instruções', () => {
      expect(valido).toBe(true)
      expect(corpo.trim().length).toBeGreaterThan(200)
    })

    it('o nome do cabeçalho é o da pasta, só com letras minúsculas, números e hífen', () => {
      const nome = campo(cabecalho, 'name')

      expect(nome).toBe(pasta)
      expect(nome).toMatch(/^[a-z0-9-]{1,64}$/)
    })

    it('a descrição diz o que a skill faz e quando usá-la, sem passar do limite', () => {
      const descricao = campo(cabecalho, 'description')

      expect(descricao).toBeDefined()
      expect(descricao!.length).toBeGreaterThanOrEqual(80)
      expect(descricao!.length).toBeLessThanOrEqual(1024)
      expect(descricao).toMatch(/Use quando/)
    })

    // Convenção: ferramentas do MCP aparecem entre crases e em minúsculas com sublinhado
    // (`listar_candidaturas`). Se uma ferramenta for renomeada ou removida, a skill que a cita
    // precisa ser atualizada; este teste avisa antes de a skill mandar o Claude usar o que não existe.
    it('só cita ferramentas que o servidor MCP realmente oferece', async () => {
      const { fetchFalso } = apiFalsa(() => undefined)
      const client = await conectar(fetchFalso)
      const { tools } = await client.listTools()
      const existentes = new Set(tools.map((t) => t.name))

      const citadas = [...corpo.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1])

      expect(citadas.length).toBeGreaterThan(0)
      expect(citadas.filter((nome) => !existentes.has(nome))).toEqual([])
    })
  })
})
