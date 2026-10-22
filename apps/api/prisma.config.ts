import { existsSync } from 'node:fs'
import { defineConfig, env } from 'prisma/config'

// O Prisma 7 não lê o .env sozinho; o .env fica na raiz do monorepo
if (existsSync('../../.env')) process.loadEnvFile('../../.env')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
