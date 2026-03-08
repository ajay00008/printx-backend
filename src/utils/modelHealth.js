import { config } from '../config/env.js'

/** Convert ws(s):// URL → http(s):// and append /ready */
function modelHealthUrl() {
  return config.modelServerUrl
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://')
    .split('/infer')[0] + '/ready'
}

export async function checkModel() {
  try {
    const res = await fetch(modelHealthUrl(), { signal: AbortSignal.timeout(3000) })
    return { reachable: res.ok, status_code: res.status }
  } catch (err) {
    return { reachable: false, error: err.message }
  }
}

export function getGpuStatusDict(model) {
  if (model.reachable) {
    return {
      available: true,
      status: 'ready',
      instances: 1,
      desired: 1,
      tasks_running: 1,
      estimated_ready_seconds: 0,
      message: 'Printx.ai — GPU STT ready',
    }
  }
  return {
    available: false,
    status: 'unavailable',
    instances: 0,
    desired: 0,
    tasks_running: 0,
    estimated_ready_seconds: 0,
    message: `Model server not reachable: ${model.error}`,
  }
}
