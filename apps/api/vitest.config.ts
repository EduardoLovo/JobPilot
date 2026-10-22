import { configDefaults, defineConfig } from 'vitest/config'

// Testes unitários e de rota com repositórios em memória: rápidos e sem banco.
// Os testes de integração têm config própria (vitest.integration.config.ts).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'tests/integration/**'],
  },
})
