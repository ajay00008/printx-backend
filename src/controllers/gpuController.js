import { checkModel, getGpuStatusDict } from '../utils/modelHealth.js'

export async function gpuStatus(req, res) {
  const model = await checkModel()
  res.json(getGpuStatusDict(model))
}

export async function gpuWarmup(req, res) {
  const model = await checkModel()
  const status = getGpuStatusDict(model)
  res.json({
    message: status.status === 'ready' ? 'STT engine ready' : status.message,
    status,
  })
}

export async function gpuRelease(req, res) {
  res.json({ message: 'STT engine always-on — no release needed' })
}
