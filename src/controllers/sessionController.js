import { v4 as uuidv4 } from 'uuid'
import { Session } from '../models/Session.js'
import { logger } from '../utils/logger.js'

export async function startSession(req, res) {
  const language = req.body?.language || 'en'
  const sessionId = uuidv4()
  const sessionToken = uuidv4()

  // req.user is set by requireAuth middleware (optional here — session is still
  // created even without auth, but userId is stored when present for backend saving)
  const userId = req.user?._id ?? null

  await Session.create({ sessionId, sessionToken, language, userId })
  logger.info(`session started id=${sessionId.slice(0, 8)} lang=${language} user=${userId ?? 'anon'}`)
  res.json({ session_id: sessionId, session_token: sessionToken })
}

export async function deleteSession(req, res) {
  const { session_id } = req.params
  const result = await Session.deleteMany({ sessionId: session_id })
  logger.info(`session deleted id=${session_id.slice(0, 8)} count=${result.deletedCount}`)
  res.json({ deleted: session_id })
}
