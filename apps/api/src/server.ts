import { createApp } from './app.js'

const port = Number(process.env.API_PORT ?? 3333)

createApp().listen(port, () => {
  console.log(`JobPilot API rodando em http://localhost:${port}`)
})
