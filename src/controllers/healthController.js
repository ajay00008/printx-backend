import { checkModel } from '../utils/modelHealth.js'
import { config } from '../config/env.js'

const startTime = Date.now()

export async function getHealth(req, res) {
  const model = await checkModel()
  res.json({
    status: 'healthy',
    app: 'printx',
    uptime: Math.round((Date.now() - startTime) / 1000),
    model_server: model,
  })
}

export async function getDebug(req, res) {
  const model = await checkModel()
  res.json({
    ok: true,
    checks: {
      model_reachable: model.reachable,
      model_error: model.reachable ? null : model.error,
      model_server_url: config.modelServerUrl,
      port: config.port,
    },
    uptime_seconds: Math.round((Date.now() - startTime) / 1000),
  })
}
