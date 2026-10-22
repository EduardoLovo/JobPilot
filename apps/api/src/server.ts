import { createApp } from './app.js'
import { prisma } from './lib/prisma.js'
import { createPrismaUsuarioRepository } from './modules/auth/usuario.repository.js'

const port = Number(process.env.API_PORT ?? 3333)

const app = createApp({
  usuarios: createPrismaUsuarioRepository(prisma),
})

app.listen(port, () => {
  console.log(`JobPilot API rodando em http://localhost:${port}`)
})
