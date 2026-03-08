import { v4 as uuidv4 } from 'uuid'
import { Share } from '../models/Share.js'
import { shareRooms, broadcastToRoom } from '../websocket/shareRoom.js'
import { formatTimeMs } from '../utils/formatTime.js'
import { config } from '../config/env.js'
import { logger } from '../utils/logger.js'

/** Normalize raw segment array into DB-safe shape */
function normalizeSegments(raw = []) {
  return raw
    .filter((s) => typeof s === 'object' && (s.text || '').trim())
    .map((s) => ({
      text: (s.text || '').trim(),
      time: s.time || '0:00',
      timestamp: s.timestamp ?? 0,
      speakerId: s.speakerId || null,
      speakerName: s.speakerName || 'Speaker 1',
    }))
}

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
    const fullText = (typeof body.full_text === 'string' ? body.full_text : '').trim()
    const segments = normalizeSegments(body.segments)
    const title = (body.title || 'Shared transcript').trim()
    const visibility = ['public', 'restricted'].includes(body.visibility) ? body.visibility : 'restricted'

    // Use session_id as share_id when safe (same as Python backend)
    const rawSessionId = (body.session_id || '').trim()
    const shareId = /^[a-zA-Z0-9_-]{1,64}$/.test(rawSessionId)
      ? rawSessionId
      : uuidv4().replace(/-/g, '').slice(0, 16)

    const share = await Share.findOneAndUpdate(
      { shareId },
      { shareId, title, fullText: fullText || ' ', segments, visibility },
      { upsert: true, new: true }
    )

    const shareUrl = `${resolveBaseUrl(req)}/share/${shareId}`
    logger.info(`share created id=${shareId}`)
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
  res
    .set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' })
    .json(share.toPublic())
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

  const toAdd = raw
    .filter((s) => typeof s === 'object' && (s.text || '').trim())
    .map((s) => ({
      text: (s.text || '').trim(),
      time: s.time || formatTimeMs(s.timestamp || 0),
      timestamp: s.timestamp ?? 0,
      speakerId: null,
      speakerName,
    }))

  share.segments.push(...toAdd)
  share.fullText = share.segments.map((s) => s.text).join(' ').trim() || share.fullText
  await share.save()

  // Broadcast to share room
  broadcastToRoom(share_id, share.toPublic())

  logger.info(`share appended id=${share_id} count=${toAdd.length}`)
  res.json({ share_id, appended: toAdd.length })
}
