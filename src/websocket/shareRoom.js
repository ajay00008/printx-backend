import { WebSocket } from 'ws'
import { Share, buildSharePayload } from '../models/Share.js'
import { RecordingSession } from '../models/RecordingSession.js'
import { logger } from '../utils/logger.js'

/** share_id → Set<WebSocket> */
const rooms = new Map()

export function broadcastToRoom(shareId, payload) {
  const room = rooms.get(shareId)
  const segmentCount = payload?.segments?.length ?? 0
  if (!room?.size) {
    logger.info(`[shareRoom] broadcast skip (no clients) shareId=${shareId} segments=${segmentCount}`)
    return
  }
  const msg = JSON.stringify({ type: 'share_update', data: payload })
  let sent = 0
  for (const ws of [...room]) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg)
      sent++
    } else {
      room.delete(ws)
    }
  }
  logger.info(`[shareRoom] broadcast shareId=${shareId} segments=${segmentCount} clients=${sent}`)
}

/** Notify room that a participant (joiner) joined — host can add/update speaker for display */
export function broadcastParticipantJoined(shareId, userId, name) {
  const room = rooms.get(shareId)
  if (!room?.size) {
    logger.info(`[shareRoom] participant_joined skip (no clients) shareId=${shareId}`)
    return
  }
  const msg = JSON.stringify({ type: 'participant_joined', data: { userId, name } })
  let sent = 0
  for (const ws of [...room]) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg)
      sent++
    } else {
      room.delete(ws)
    }
  }
  logger.info(`[shareRoom] participant_joined shareId=${shareId} userId=${userId} name=${name} clients=${sent}`)
}

/** Called from the HTTP server upgrade handler for /api/share/:id/ws */
export async function handleShareRoomWs(ws, shareId) {
  if (!rooms.has(shareId)) rooms.set(shareId, new Set())
  rooms.get(shareId).add(ws)
  logger.info(`share room join shareId=${shareId} room_size=${rooms.get(shareId).size}`)

  // Single source of truth: transcript comes from RecordingSession.
  // shareId = recordingSessionId when share is created from session.
  try {
    const share = await Share.findOne({ shareId })
    const recSessionId = share?.recordingSessionId || shareId
    const recordingSession = await RecordingSession.findOne({ sessionId: recSessionId }).lean()
    const payload = buildSharePayload(share, recordingSession, shareId)
    if (recordingSession) {
      ws.send(JSON.stringify({ type: 'share_update', data: payload }))
    } else {
      ws.send(JSON.stringify({
        type: 'share_update',
        data: {
          ...payload,
          full_text: '',
          segments: [],
          is_live: true,
        },
      }))
    }
  } catch (err) {
    logger.error(`share room init error: ${err.message}`)
  }

  // Keep-alive pings — client sends empty pings to detect dropped connections
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
    } catch {}
  })

  ws.on('close', () => {
    const room = rooms.get(shareId)
    if (room) {
      room.delete(ws)
      if (!room.size) rooms.delete(shareId)
    }
    logger.info(`share room leave shareId=${shareId}`)
  })

  ws.on('error', (err) => logger.error(`share room ws error: ${err.message}`))
}

export { rooms as shareRooms }
