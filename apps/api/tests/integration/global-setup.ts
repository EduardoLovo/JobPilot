import { execSync } from 'node:child_process'
import pg from 'pg'
import { assertTestDatabase, TEST_DATABASE_URL } from './test-database.js'

// Roda uma vez antes de todos os testes de integração: cria o banco de teste e aplica as migrations
export default async function setup() {
  // O nome já foi validado (só letras minúsculas, números e _), então é seguro usar no CREATE DATABASE
  const dbName = assertTestDatabase(TEST_DATABASE_URL)

  const adminUrl = new URL(TEST_DATABASE_URL)
  adminUrl.pathname = '/postgres'
  const admin = new pg.Client({ connectionString: adminUrl.toString() })

  try {
    await admin.connect()
  } catch {
    throw new Error('Não foi possível conectar ao Postgres. Ele está rodando? Use: npm run db:up')
  }

  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
  if (!rowCount) await admin.query(`CREATE DATABASE "${dbName}"`)
  await admin.end()

  execSync('npx prisma migrate deploy', {
    cwd: new URL('../..', import.meta.url),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  })
}
