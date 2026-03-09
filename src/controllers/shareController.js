import { v4 as uuidv4 } from 'uuid'
import { Share, buildSharePayload } from '../models/Share.js'
import { RecordingSession } from '../models/RecordingSession.js'
import { broadcastToRoom } from '../websocket/shareRoom.js'
import { formatTimeMs } from '../utils/formatTime.js'
import { config } from '../config/env.js'
import { logger } from '../utils/logger.js'

/** Derive base URL from request headers (same logic as Python backend) */
function resolveBaseUrl(req) {
  if (config.printxBaseUrl?.startsWith?.('http')) return config.printxBaseUrl
  const proto = req.headers['x-forwarded-proto'] || 'http'
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  return host ? `${proto}://${host}` : `http://localhost:${config.port}`
}

export async function createShare(req, res) {
  try {
    const body = req.body || {}
    const title = (body.title || 'Shared transcript').trim()
    const visibility = ['public', 'restricted'].includes(body.visibility) ? body.visibility : 'restricted'

    // Use session_id as share_id when safe (same as Python backend)
    const rawSessionId = (body.session_id || '').trim()
    const shareId = /^[a-zA-Z0-9_-]{1,64}$/.test(rawSessionId)
      ? rawSessionId
      : uuidv4().replace(/-/g, '').slice(0, 16)
    const recordingSessionId = rawSessionId || shareId

    const share = await Share.findOneAndUpdate(
      { shareId },
      { shareId, recordingSessionId, title, visibility },
      { upsert: true, new: true }
    )

    const shareUrl = `${resolveBaseUrl(req)}/share/${shareId}`
    logger.info(`share created id=${shareId} recordingSessionId=${recordingSessionId}`)
    res.json({ share_id: shareId, share_url: shareUrl })
  } catch (err) {
    logger.error(`share create error: ${err.message}`)
    res.status(500).json({ error: 'Failed to create share link' })
  }
}

export async function getShare(req, res) {
  const { share_id } = req.params
  const share = await Share.findOne({ shareId: share_id })
  if (!share) {
    return res.status(404).json({
      error: 'Share not found or expired',
      hint: 'Create a new share from this app so it is stored in the database.',
    })
  }
  const recSessionId = share.recordingSessionId || share_id
  const recordingSession = await RecordingSession.findOne({ sessionId: recSessionId }).lean()
  const payload = buildSharePayload(share, recordingSession)
  res
    .set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' })
    .json(payload)
}

export async function appendShare(req, res) {
  const { share_id } = req.params
  const share = await Share.findOne({ shareId: share_id })
  if (!share) return res.status(404).json({ error: 'Share not found or expired' })
  if (share.visibility !== 'public') return res.status(403).json({ error: 'Only public shares can be appended to' })

  const body = req.body || {}
  const raw = Array.isArray(body.segments) ? body.segments : []
  const speakerName = (body.speaker_name || 'Guest').trim() || 'Guest'

  if (!raw.length) return res.json({ share_id, appended: 0 })

  const recSessionId = share.recordingSessionId || share_id
  const recordingSession = await RecordingSession.findOne({ sessionId: recSessionId })
  if (!recordingSession) return res.status(404).json({ error: 'Recording session not found' })

  const toAdd = raw
    .filter((s) => typeof s === 'object' && (s.text || '').trim())
    .map((s) => ({
      text: (s.text || '').trim(),
      time: s.time || formatTimeMs(s.timestamp || 0),
      timestamp: s.timestamp ?? 0,
      speakerId: null,
      speakerName,
    }))

  recordingSession.segments.push(...toAdd)
  recordingSession.fullText = recordingSession.segments.map((s) => s.text).join(' ').trim() || recordingSession.fullText
  await recordingSession.save()

  const payload = buildSharePayload(share, recordingSession)
  broadcastToRoom(share_id, payload)

  logger.info(`share appended id=${share_id} count=${toAdd.length}`)
  res.json({ share_id, appended: toAdd.length })
}
