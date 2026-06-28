import { buildApp } from './app.js'

// Loopback-only: nginx terminiert TLS und proxyt /api/field-vigor + /api/rs/* hierher.
const PORT = Number(process.env.PORT) || 8788
const HOST = process.env.HOST || '127.0.0.1'

const app = buildApp({ logger: true })
app
  .listen({ port: PORT, host: HOST })
  .then((addr) => app.log.info(`DoldenBlick RS hört auf ${addr}`))
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
