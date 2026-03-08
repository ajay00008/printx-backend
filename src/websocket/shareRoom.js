import { WebSocket } from 'ws'
import { Share } from '../models/Share.js'
import { logger } from '../utils/logger.js'

/** share_id → Set<WebSocket> */
const rooms = new Map()

export function broadcastToRoom(shareId, payload) {
  const room = rooms.get(shareId)
  if (!room?.size) return
  const msg = JSON.stringify({ type: 'share_update', data: payload })
  for (const ws of [...room]) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg)
    } else {
      room.delete(ws)
    }
  }
}

/** Called from the HTTP server upgrade handler for /api/share/:id/ws */
export async function handleShareRoomWs(ws, shareId) {
  if (!rooms.has(shareId)) rooms.set(shareId, new Set())
  rooms.get(shareId).add(ws)
  logger.info(`share room join shareId=${shareId} room_size=${rooms.get(shareId).size}`)

  // Send current share state immediately on connect
  try {
    const share = await Share.findOne({ shareId })
    if (share) {
      ws.send(JSON.stringify({ type: 'share_update', data: share.toPublic() }))
    }
  } catch (err) {
    logger.error(`share room init error: ${err.message}`)
  }

  // Keep-alive: respond to any message (client may send pings)
  ws.on('message', () => { /* no-op — room is receive-only */ })

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
