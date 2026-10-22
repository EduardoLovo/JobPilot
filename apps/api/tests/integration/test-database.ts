export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://jobpilot:jobpilot@localhost:5432/jobpilot_test'

// Os testes apagam todas as tabelas; este guarda garante que só rodam num banco com sufixo _test
export function assertTestDatabase(url: string) {
  const name = new URL(url).pathname.slice(1)
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `Banco "${name}" recusado: os testes de integração só rodam em bancos cujo nome termina com _test`,
    )
  }
  return name
}
