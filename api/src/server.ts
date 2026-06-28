import { buildApp } from './app.js'

// Bind nur an Loopback: nginx (same-origin) terminiert TLS und proxyt /api/* hierher.
const PORT = Number(process.env.PORT) || 8787
const HOST = process.env.HOST || '127.0.0.1'

const app = buildApp({ logger: true })

app
  .listen({ port: PORT, host: HOST })
  .then((addr) => app.log.info(`DoldenBlick API hört auf ${addr}`))
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
