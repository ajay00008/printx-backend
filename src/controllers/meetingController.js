import { v4 as uuidv4 } from 'uuid'
import { RecordingSession } from '../models/RecordingSession.js'

function toApiSpeaker(s) {
  return {
    id: s.id,
    name: s.name,
    color_index: s.color_index ?? 0,
    avatar: s.avatar,
    email: s.email,
    is_host: !!s.is_host,
    word_count: s.word_count ?? 0,
    speaking_time: s.speaking_time ?? 0,
    joined_at: s.joined_at,
    left_at: s.left_at,
  }
}

// Stub controllers — extend with a Meeting model when needed
export const listMeetings         = (req, res) => res.json([])
export const createMeeting        = (req, res) => res.json({ id: uuidv4(), status: 'scheduled', session_id: null, type: 'instant', platform: 'printx', participants: [] })
export const joinMeeting          = (req, res) => res.json({ id: req.params.meeting_id, status: 'live', session_id: null, platform: 'printx', participants: [] })
export const endMeeting           = (req, res) => res.json({ id: req.params.meeting_id, status: 'ended' })
export const deleteMeeting        = (req, res) => res.json({ deleted: true })
export const listParticipants     = (req, res) => res.json([])

export async function listSpeakers(req, res) {
  const sessionId = (req.params.session_id || '').trim()
  if (!sessionId) return res.status(400).json({ error: 'session_id required' })
  try {
    const doc = await RecordingSession.findOne({ sessionId, userId: req.user._id }).lean()
    const list = (doc?.speakers || []).map(toApiSpeaker)
    return res.json(list)
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to list speakers' })
  }
}

export async function addSpeaker(req, res) {
  const sessionId = (req.params.session_id || '').trim()
  if (!sessionId) return res.status(400).json({ error: 'session_id required' })
  const body = req.body || {}
  const name = (body.name || 'Speaker').trim() || 'Speaker'
  const isHost = !!body.is_host
  const userId = (body.user_id || body.userId || '').trim() || null
  try {
    const doc = await RecordingSession.findOne({ sessionId, userId: req.user._id })
    if (!doc) return res.status(404).json({ error: 'Session not found' })
    const speakers = doc.speakers || []
    let speaker
    if (userId && speakers.some(s => String(s.id) === String(userId))) {
      const idx = speakers.findIndex(s => String(s.id) === String(userId))
      doc.speakers[idx].name = name
      doc.speakers[idx].is_host = isHost
      await doc.save()
      speaker = toApiSpeaker(doc.speakers[idx])
    } else {
      const id = userId || uuidv4()
      const colorIndex = speakers.length % 8
      speaker = {
        id,
        name,
        userId: userId || null,
        is_host: isHost,
        color_index: colorIndex,
        word_count: 0,
        speaking_time: 0,
        avatar: null,
        email: null,
      }
      doc.speakers = doc.speakers || []
      doc.speakers.push(speaker)
      await doc.save()
      speaker = toApiSpeaker(speaker)
    }
    return res.json(speaker)
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to add speaker' })
  }
}

export async function updateSpeaker(req, res) {
  const sessionId = (req.params.session_id || '').trim()
  const speakerId = (req.params.speaker_id || '').trim()
  if (!sessionId || !speakerId) return res.status(400).json({ error: 'session_id and speaker_id required' })
  const body = req.body || {}
  try {
    const doc = await RecordingSession.findOne({ sessionId, userId: req.user._id })
    if (!doc) return res.status(404).json({ error: 'Session not found' })
    const speakers = doc.speakers || []
    const idx = speakers.findIndex(s => String(s.id) === String(speakerId))
    if (idx < 0) return res.status(404).json({ error: 'Speaker not found' })
    const s = speakers[idx]
    if (body.name != null) s.name = String(body.name).trim() || s.name
    if (body.avatar != null) s.avatar = body.avatar
    if (body.email != null) s.email = body.email
    if (body.is_host != null) s.is_host = !!body.is_host
    await doc.save()
    return res.json(toApiSpeaker(s))
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to update speaker' })
  }
}

export async function removeSpeaker(req, res) {
  const sessionId = (req.params.session_id || '').trim()
  const speakerId = (req.params.speaker_id || '').trim()
  if (!sessionId || !speakerId) return res.status(400).json({ error: 'session_id and speaker_id required' })
  try {
    const doc = await RecordingSession.findOne({ sessionId, userId: req.user._id })
    if (!doc) return res.status(404).json({ error: 'Session not found' })
    doc.speakers = (doc.speakers || []).filter(s => String(s.id) !== String(speakerId))
    await doc.save()
    return res.json({ deleted: true })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to remove speaker' })
  }
}

export async function assignSpeaker(req, res) {
  const sessionId = (req.params.session_id || '').trim()
  const speakerId = (req.params.speaker_id || '').trim()
  const segmentIndex = parseInt(req.params.segment_index, 10)
  if (!sessionId || !speakerId || Number.isNaN(segmentIndex)) return res.status(400).json({ error: 'Invalid params' })
  try {
    const doc = await RecordingSession.findOne({ sessionId, userId: req.user._id })
    if (!doc) return res.status(404).json({ error: 'Session not found' })
    const segments = doc.segments || []
    const seg = segments[segmentIndex]
    if (!seg) return res.status(404).json({ error: 'Segment not found' })
    const speaker = (doc.speakers || []).find(s => String(s.id) === String(speakerId))
    seg.speakerId = speakerId
    seg.speakerName = speaker ? speaker.name : null
    await doc.save()
    return res.json({ assigned: true })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to assign speaker' })
  }
}
