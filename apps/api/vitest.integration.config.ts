import { defineConfig } from 'vitest/config'
import { TEST_DATABASE_URL } from './tests/integration/test-database.ts'

// Testes de integração: API + Prisma + Postgres de verdade (banco jobpilot_test)
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.int.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    // O src/lib/prisma.ts lê DATABASE_URL: aqui ela aponta para o banco de teste
    env: { DATABASE_URL: TEST_DATABASE_URL },
    // Todos os arquivos usam o mesmo banco, então rodam um de cada vez
    fileParallelism: false,
    testTimeout: 15_000,
  },
})
