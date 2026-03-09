/**
 * WebSocket bridge: Browser ↔ Node.js ↔ Parakeet STT model
 *
 * Protocol:
 *   Browser → backend: query param ?token=<session_token>
 *   Backend → model:   ws://MODEL_SERVER_URL with x-infer-token header
 *   Model → backend:   JSON or msgpack frames (Transcript / Marker)
 *   Backend → browser: normalized JSON events (interim, transcript, segment_complete, final, session_ended)
 *
 * Share room integration:
 *   Browser sends: { type: "start_stream", share_id: "<shareId>" }
 *   Backend stores shareId and emits live transcript to that share room on every interim/final
 */

import { WebSocket } from 'ws'
import { decode as msgpackDecode } from '@msgpack/msgpack'
import { Session } from '../models/Session.js'
import { RecordingSession } from '../models/RecordingSession.js'
import { Share, buildSharePayload } from '../models/Share.js'
import { User } from '../models/User.js'
import { broadcastToRoom } from './shareRoom.js'
import { formatTimeMs } from '../utils/formatTime.js'
import { config } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { correctNames, reloadCustomNames } from '../utils/correctNames.js'

/** Connect to the Parakeet model server and return the WebSocket */
async function connectModel() {
  const headers = {}
  if (config.modelServerToken) headers['x-infer-token'] = config.modelServerToken

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(config.modelServerUrl, { headers })
    ws.once('open', () => {
      // Wait for the model Ready signal before resolving
      ws.once('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          logger.info(`model Ready: ${JSON.stringify(msg)}`)
        } catch {
          // unexpected format — proceed anyway
        }
        resolve(ws)
      })
    })
    ws.once('error', reject)
    setTimeout(() => reject(new Error('Model connect timeout')), 15000)
  })
}

/** Normalize segment to share payload shape */
function toShareSegment(s) {
  const ts = s.timestamp ?? s.start_time_ms ?? 0
  return {
    text: s.text || '',
    time: s.time || formatTimeMs(ts),
    timestamp: ts,
    speakerId: s.speakerId ?? s.speaker ?? null,
    speakerName: s.speakerName || s.speaker || 'Host',
  }
}

/** Emit live transcript snapshot to the share room. Merges with persisted base so share page keeps old data. */
async function emitToShareRoom(shareId, accumulatedText, accumulatedSegments, interimText, baseFromDb, recSessionId) {
  if (!shareId) return

  let base = baseFromDb
  if (!base && recSessionId) {
    try {
      const doc = await RecordingSession.findOne({ sessionId: recSessionId }).lean()
      if (doc) base = { fullText: doc.fullText, segments: doc.segments || [], title: doc.title }
    } catch {}
  }

  const liveSegs = accumulatedSegments.map(toShareSegment)
  const baseSegs = ((base || baseFromDb)?.segments || []).map(toShareSegment)
  const allSegments = [...baseSegs, ...liveSegs]

  const liveFullText = accumulatedText.join(' ').trim()
  const baseFullText = ((base || baseFromDb)?.fullText || '').trim()
  let fullText = baseFullText ? `${baseFullText} ${liveFullText}`.trim() : liveFullText
  if (interimText?.trim()) fullText = `${fullText} ${interimText.trim()}`.trim()

  const payload = {
    share_id: shareId,
    title: (base || baseFromDb)?.title || 'Live Recording',
    full_text: fullText || ' ',
    segments: allSegments,
    partial_text: interimText?.trim() || '',
    created_at: Date.now() / 1000,
    visibility: 'public',
    is_live: true,
  }
  broadcastToRoom(shareId, payload)
}

/** Persist joiner segments to share's RecordingSession and broadcast. Single source of truth from model response. */
async function appendToShareSession(shareId, segments, speakerName) {
  if (!shareId || !segments?.length) return
  try {
    const share = await Share.findOne({ shareId })
    if (!share || share.visibility !== 'public') return
    const recSessionId = share.recordingSessionId || shareId
    const recordingSession = await RecordingSession.findOne({ sessionId: recSessionId })
    if (!recordingSession) return

    const toAdd = segments.map((s) => ({
      text: (s.text || '').trim(),
      time: s.time || formatTimeMs(s.timestamp || 0),
      timestamp: s.timestamp ?? 0,
      speakerId: null,
      speakerName: speakerName || 'Guest',
    })).filter((s) => s.text)

    if (!toAdd.length) return
    recordingSession.segments.push(...toAdd)
    recordingSession.fullText = recordingSession.segments.map((s) => s.text).join(' ').trim() || recordingSession.fullText
    await recordingSession.save()

    const payload = buildSharePayload(share, recordingSession)
    broadcastToRoom(shareId, payload)
    logger.info(`[stream] joiner appended to share id=${shareId} count=${toAdd.length} speaker=${speakerName}`)
  } catch (err) {
    logger.error(`[stream] appendToShareSession error: ${err.message}`)
  }
}

/** Main handler — called for each browser WebSocket connection on /api/stream */
export async function handleStreamWs(ws, req) {
  const url = new URL(req.url, `http://localhost`)
  const token = url.searchParams.get('token') || ''

  // ── Auth: look up session token in MongoDB ───────────────────────────────
  let session = token ? await Session.findOne({ sessionToken: token }) : null

  if (!session) {
    // Try receiving auth message (legacy)
    try {
      const raw = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('auth timeout')), 10000)
        ws.once('message', (msg) => { clearTimeout(timer); resolve(msg.toString()) })
      })
      const data = JSON.parse(raw)
      if (data.type === 'auth') {
        session = await Session.findOne({ sessionToken: data.session_token })
      }
    } catch { /* fall through to auth error */ }
  }

  if (!session) {
    ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid or missing session token' }))
    ws.close()
    return
  }

  logger.info(`ws stream auth ok sessionId=${session.sessionId.slice(0, 8)}`)

  // ── Connect to model ─────────────────────────────────────────────────────
  let modelWs
  try {
    modelWs = await connectModel()
  } catch (err) {
    logger.error(`model connect failed: ${err.message}`)
    ws.send(JSON.stringify({ type: 'error', message: `Cannot connect to model: ${err.message}` }))
    ws.close()
    return
  }

  // Tell model to accept mixed language (Hindi + English) — "auto" allows code-mixing
  // so "kya kr rhe ho" gets transcribed when speaking in English mode
  if (modelWs.readyState === WebSocket.OPEN) {
    try {
      modelWs.send(JSON.stringify({ type: 'config', language: 'auto' }))
      logger.info(`[stream] sent language config: auto (mixed Hindi+English)`)
    } catch (e) {
      logger.warn(`[stream] config send failed (model may ignore): ${e.message}`)
    }
  }

  // Signal browser: model is ready
  ws.send(JSON.stringify({ type: 'auth_success', model: 'Parakeet 600M (NeMo Streaming)', streaming: true, backend: 'gpu' }))
  ws.send(JSON.stringify({ type: 'ready', session_id: session.sessionId, idle_timeout_seconds: 0 }))

  // ── Per-stream state ─────────────────────────────────────────────────────
  const sessionStartMs = Date.now()
  const accumulatedText = []       // final transcript chunks
  const accumulatedSegments = []   // { text, start_time_ms, end_time_ms }
  let lastFinalMs = 0
  const PAUSE_MS = 1750
  let streamShareId = null          // set from start_stream message
  let recordingSessionId = null     // set from start_stream message; used to persist to RecordingSession
  let shareBaseFromDb = null        // cached RecordingSession for share merge (keeps old data on share page)
  let isJoinerStream = false        // true when joiner joins share (share_id only, no recordingSessionId from client)
  let joinerSpeakerName = 'Guest'   // speaker name for joiner segments (from User lookup)

  /** Persist current transcript state to MongoDB (merge with existing so we never lose old data) */
  async function persistToMongo(isFinal = false) {
    if (!recordingSessionId || !session.userId) return
    try {
      let base = shareBaseFromDb
      if (!base) {
        const doc = await RecordingSession.findOne({ sessionId: recordingSessionId }).lean()
        if (doc) {
          base = { fullText: doc.fullText, segments: doc.segments || [], title: doc.title }
          shareBaseFromDb = base
        }
      }
      const liveFullText = accumulatedText.join(' ').trim()
      const baseFullText = (base?.fullText || '').trim()
      const fullText = baseFullText ? `${baseFullText} ${liveFullText}`.trim() : liveFullText
      const baseSegs = base?.segments || []
      const mergedSegments = [...baseSegs, ...accumulatedSegments]
      const durationSeconds = Math.floor((Date.now() - sessionStartMs) / 1000)
      const update = {
        $set: {
          fullText,
          segments: mergedSegments,
          wordCount: fullText.split(/\s+/).filter(Boolean).length,
          duration: durationSeconds,
          updatedAt: new Date(),
        },
      }
      await RecordingSession.updateOne(
        { sessionId: recordingSessionId, userId: session.userId },
        update
      )
      if (isFinal) {
        logger.info(`[stream] persisted FINAL to MongoDB recSessId=${recordingSessionId} chars=${fullText.length} segs=${mergedSegments.length} duration=${durationSeconds}s`)
      }
    } catch (err) {
      logger.error(`[stream] persistToMongo error: ${err.message}`)
    }
  }

  // ── Model → Browser ──────────────────────────────────────────────────────
  modelWs.on('message', async (raw) => {
    if (ws.readyState !== WebSocket.OPEN) return

    // The model sends JSON as a binary Buffer (not msgpack).
    // Parse all frames as UTF-8 text first; fall back to msgpack for legacy frames.
    let data
    const str = raw.toString('utf8')

    if (str.trim() === 'END') {
      const fullText = accumulatedText.join(' ').trim()
      logger.info(`[stream] END received — emitting final+stopped fullText="${fullText.slice(0, 80)}..." segments=${accumulatedSegments.length}`)
      await persistToMongo(true)
      ws.send(JSON.stringify({ type: 'final', full_text: fullText, segments: accumulatedSegments }))
      ws.send(JSON.stringify({ type: 'stopped', full_text: fullText, segments: accumulatedSegments }))
      await emitToShareRoom(streamShareId, accumulatedText, accumulatedSegments, null, shareBaseFromDb, recordingSessionId)
      ws.send(JSON.stringify({ type: 'session_ended' }))
      return
    }

    try {
      data = JSON.parse(str)
    } catch {
      // Not valid JSON — try msgpack (legacy binary frames from some model versions)
      try { data = msgpackDecode(raw) } catch { return }
    }

    // Msgpack Marker frame signals end-of-stream
    if (data?.type === 'Marker') {
      const fullText = accumulatedText.join(' ').trim()
      logger.info(`[stream] Marker received — emitting final+stopped fullText="${fullText.slice(0, 80)}..." segments=${accumulatedSegments.length}`)
      await persistToMongo(true)
      ws.send(JSON.stringify({ type: 'final', full_text: fullText, segments: accumulatedSegments }))
      ws.send(JSON.stringify({ type: 'stopped', full_text: fullText, segments: accumulatedSegments }))
      await emitToShareRoom(streamShareId, accumulatedText, accumulatedSegments, null, shareBaseFromDb, recordingSessionId)
      ws.send(JSON.stringify({ type: 'session_ended' }))
      return
    }

    if (!data || !('text' in data)) return

    const rawText = (data.text || '').trim()
    if (!rawText) return

    // Apply custom-name correction (exact + fuzzy, filtered by stopwords)
    const text = await correctNames(rawText)

    const isFinal = !!data.is_final
    const audioTs = data.audio_timestamp
    const tsMs = audioTs ? Math.round(audioTs * 1000) : (Date.now() - sessionStartMs)
    const speaker = data.speaker || null

    if (!isFinal) {
      // Interim: forward to browser and share room
      logger.info(`[stream] interim → "${text.slice(0, 60)}"`)
      ws.send(JSON.stringify({ type: 'interim', text, timestamp_ms: tsMs ,streamShareId}))
      await emitToShareRoom(streamShareId, accumulatedText, accumulatedSegments, text, shareBaseFromDb, recordingSessionId)
    } else {
      // Final chunk from model — accumulate and emit to browser
      logger.info(`[stream] FINAL chunk → "${text}" speaker=${speaker} tsMs=${tsMs} (total chunks=${accumulatedText.length + 1})`)

      if (lastFinalMs && (tsMs - lastFinalMs) >= PAUSE_MS) {
        ws.send(JSON.stringify({ type: 'segment_complete', text: '', time: formatTimeMs(tsMs), start_time_ms: tsMs, end_time_ms: tsMs ,streamShareId}))
      }
      lastFinalMs = tsMs

      const words = text.split(/\s+/)
      const startMs = tsMs - Math.max(words.length * 300, 1000)
      accumulatedText.push(text)
      accumulatedSegments.push({
        text,
        time: formatTimeMs(startMs),
        start_time_ms: startMs,
        end_time_ms: tsMs,
        speaker,
      })

      const fullTextSoFar = accumulatedText.join(' ')
      logger.info(`[stream] → partial full_text="${fullTextSoFar.slice(0, 80)}..."`)
      ws.send(JSON.stringify({ type: 'partial', text: '', full_text: fullTextSoFar, timestamp_ms: tsMs ,streamShareId}))
      ws.send(JSON.stringify({ type: 'segment_complete', text, time: formatTimeMs(startMs), start_time_ms: startMs, end_time_ms: tsMs, speaker ,streamShareId}))

      if (isJoinerStream) {
        // Joiner: persist to share's RecordingSession and broadcast (single source of truth from model)
        const seg = { text, time: formatTimeMs(startMs), timestamp: startMs }
        await appendToShareSession(streamShareId, [seg], joinerSpeakerName)
      } else {
        persistToMongo(false)  // Host: non-blocking incremental save
        await emitToShareRoom(streamShareId, accumulatedText, accumulatedSegments, null, shareBaseFromDb, recordingSessionId)
      }
    }
  })

  // ── Browser → Model ──────────────────────────────────────────────────────
  ws.on('message', async (raw) => {
    if (raw instanceof Buffer && raw[0] !== 123 /* '{' */) {
      // Binary PCM audio bytes → forward directly to model
      if (modelWs.readyState === WebSocket.OPEN) modelWs.send(raw)
      return
    }

    // Text control message
    try {
      const msg = JSON.parse(raw.toString())
      const type = msg.type
      if (type === 'start_stream') {
        const sid = (msg.share_id || msg.join_share_id || '').trim()
        if (sid) streamShareId = sid
        const recId = (msg.recordingSessionId || msg.recording_session_id || '').trim()
        if (recId) {
          recordingSessionId = recId
          isJoinerStream = false
          logger.info(`[stream] start_stream: linked recordingSessionId=${recId} userId=${session.userId ?? 'none'}`)
          // Cache persisted base so share page keeps old data when we emit live segments
          RecordingSession.findOne({ sessionId: recId }).lean().then((doc) => {
            if (doc) shareBaseFromDb = { fullText: doc.fullText, segments: doc.segments || [], title: doc.title }
          }).catch(() => {})
        } else if (streamShareId) {
          // Joiner flow: share_id only, no recordingSessionId — look up Share and persist segments via append
          isJoinerStream = true
          try {
            const share = await Share.findOne({ shareId: streamShareId }).lean()
            if (share) recordingSessionId = share.recordingSessionId || streamShareId
            if (session.userId) {
              const user = await User.findById(session.userId).select('name').lean()
              if (user?.name) joinerSpeakerName = user.name
            }
            logger.info(`[stream] start_stream: joiner mode shareId=${streamShareId} speaker=${joinerSpeakerName}`)
          } catch (e) {
            logger.warn(`[stream] joiner Share lookup: ${e.message}`)
          }
        }
        ws.send(JSON.stringify({ type: 'session_started' }))
        return
      }

      if (type === 'end_stream') {
        logger.info(`[stream] browser sent end_stream — forwarding END to model`)
        if (modelWs.readyState === WebSocket.OPEN) modelWs.send('END')
        return
      }

      if (type === 'stop') {
        modelWs.close()
        return
      }
    } catch {
      // Not JSON → could be binary disguised as string; forward anyway
      if (modelWs.readyState === WebSocket.OPEN) modelWs.send(raw)
    }
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = () => {
    if (modelWs.readyState === WebSocket.OPEN) modelWs.close()
  }

  ws.on('close', cleanup)
  ws.on('error', (err) => { logger.error(`stream ws error: ${err.message}`); cleanup() })
  modelWs.on('close', () => { if (ws.readyState === WebSocket.OPEN) ws.close() })
  modelWs.on('error', (err) => { logger.error(`model ws error: ${err.message}`); ws.close() })
}
