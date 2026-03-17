import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import swaggerUi from 'swagger-ui-express'

import { config } from './config/env.js'
import { connectDB } from './config/db.js'
import { seedAdmin } from './utils/seedAdmin.js'
import { swaggerSpec } from './config/swagger.js'
import { logger } from './utils/logger.js'

// ── Middleware ────────────────────────────────────────────────────────────
import { requestLogger } from './middleware/requestLogger.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

// ── Routes ────────────────────────────────────────────────────────────────
import healthRoutes      from './routes/health.routes.js'
import sessionRoutes     from './routes/session.routes.js'
import gpuRoutes         from './routes/gpu.routes.js'
import shareRoutes       from './routes/share.routes.js'
import aiRoutes          from './routes/ai.routes.js'
import transcribeRoutes  from './routes/transcribe.routes.js'
import meetingRoutes     from './routes/meeting.routes.js'
import customNameRoutes  from './routes/customName.routes.js'
import integrationRoutes from './routes/integration.routes.js'
import authRoutes        from './routes/auth.routes.js'
import recordingSessionRoutes from './routes/recordingSession.routes.js'
import usageRoutes       from './routes/usage.routes.js'

// ── WebSocket handlers ────────────────────────────────────────────────────
import { handleStreamWs }    from './websocket/streamBridge.js'
import { handleShareRoomWs } from './websocket/shareRoom.js'

// ── App setup ─────────────────────────────────────────────────────────────
const app = express()

app.use(cors({
  origin: config.corsOrigins === '*' ? '*' : config.corsOrigins.split(',').map((o) => o.trim()),
  credentials: false,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(requestLogger)

// ── Swagger docs at /api/docs ─────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Printx.ai API Docs',
}))
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec))

// ── REST routes ───────────────────────────────────────────────────────────
app.use(healthRoutes)
app.use(sessionRoutes)
app.use(gpuRoutes)
app.use(shareRoutes)
app.use(aiRoutes)
app.use(transcribeRoutes)
app.use(meetingRoutes)
app.use(customNameRoutes)
app.use(integrationRoutes)
app.use(authRoutes)
app.use(recordingSessionRoutes)
app.use(usageRoutes)

// 404 + error handlers (must be last)
app.use(notFound)
app.use(errorHandler)

// ── HTTP server (shared by Express + WebSocket) ──────────────────────────
const server = http.createServer(app)

// ── WebSocket server ──────────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://localhost`)

  // /api/stream — STT bridge (browser → model)
  if (pathname === '/api/stream') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleStreamWs(ws, req)
    })
    return
  }

  // /api/share/:id/ws — share room live updates
  const shareMatch = pathname.match(/^\/api\/share\/([^/]+)\/ws$/)
  if (shareMatch) {
    const shareId = shareMatch[1]
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleShareRoomWs(ws, shareId)
    })
    return
  }

  socket.destroy()
})

// ── Start ─────────────────────────────────────────────────────────────────
async function start() {
  await connectDB()
  await seedAdmin()
  server.listen(config.port, '0.0.0.0', () => {
    logger.info(`Printx.ai backend listening on http://0.0.0.0:${config.port}`)
    logger.info(`Swagger docs: http://localhost:${config.port}/api/docs`)
    logger.info(`Model server: ${config.modelServerUrl}`)
  })
}

start().catch((err) => {
  logger.error(`Startup failed: ${err.message}`)
  process.exit(1)
})
