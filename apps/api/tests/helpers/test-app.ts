import request from 'supertest'
import { createApp } from '../../src/app.js'
import { createInMemoryCatalogo } from './in-memory-catalogo.js'
import { createInMemoryCurriculos } from './in-memory-curriculos.js'
import { createInMemoryEtapas } from './in-memory-etapas.js'
import { createInMemoryUsuarioRepository } from './in-memory-usuario-repository.js'

export function createTestApp() {
  const usuarios = createInMemoryUsuarioRepository()
  const curriculos = createInMemoryCurriculos()
  const etapas = createInMemoryEtapas()
  const app = createApp({
    usuarios: usuarios.repo,
    ...createInMemoryCatalogo(),
    curriculos: curriculos.repo,
    etapas: etapas.repo,
  })
  return { app, usuarios, curriculos, etapas }
}

const ana = { nome: 'Ana Souza', email: 'ana@exemplo.com', senha: 'senha-forte-123' }

// Cadastra uma usuária e devolve o header de autorização pronto para usar
export async function authHeader(app: ReturnType<typeof createApp>, dados = ana) {
  const res = await request(app).post('/auth/register').send(dados)
  return { Authorization: `Bearer ${res.body.accessToken}` }
}
