import { describe, expect, it } from 'vitest'
import { lerConfig } from '../src/config.js'

describe('lerConfig', () => {
  const completo = { JOBPILOT_EMAIL: 'ana@exemplo.com', JOBPILOT_SENHA: 'senha-forte-123' }

  it('lê o e-mail e a senha, com a API local como padrão', () => {
    expect(lerConfig(completo)).toEqual({
      apiUrl: 'http://localhost:3333',
      email: 'ana@exemplo.com',
      senha: 'senha-forte-123',
    })
  })

  it('aceita outra URL e tira a barra do fim', () => {
    const config = lerConfig({ ...completo, JOBPILOT_API_URL: 'https://api.jobpilot.com.br///' })

    expect(config.apiUrl).toBe('https://api.jobpilot.com.br')
  })

  it('diz exatamente quais variáveis faltam', () => {
    expect(() => lerConfig({})).toThrow('JOBPILOT_EMAIL, JOBPILOT_SENHA')
    expect(() => lerConfig({ JOBPILOT_EMAIL: 'ana@exemplo.com' })).toThrow('JOBPILOT_SENHA')
    expect(() => lerConfig({ JOBPILOT_EMAIL: 'ana@exemplo.com' })).not.toThrow('JOBPILOT_EMAIL')
  })

  it('trata variável vazia como ausente', () => {
    expect(() => lerConfig({ JOBPILOT_EMAIL: '', JOBPILOT_SENHA: 'x' })).toThrow('JOBPILOT_EMAIL')
  })
})
