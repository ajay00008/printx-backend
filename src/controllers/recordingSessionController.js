import { RecordingSession } from '../models/RecordingSession.js'
import { logger } from '../utils/logger.js'

function toPublic(s) {
  return {
    id: s.sessionId,
    title: s.title || '',
    language: s.language || 'en',
    transcription: s.fullText || '',
    segments: s.segments || [],
    timestampedWords: s.timestampedWords || [],
    duration: s.duration || 0,
    wordCount: s.wordCount || 0,
    hasAudio: s.hasAudio || false,
    createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
    updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
  }
}

export async function listSessions(req, res) {
  const sessions = await RecordingSession.find({ userId: req.user._id })
    .sort({ updatedAt: -1 })
    .select('-__v')
    .lean()
  res.json(sessions.map(toPublic))
}

export async function createSession(req, res) {
  const { sessionId, title, language } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' })

  const session = await RecordingSession.create({
    sessionId,
    userId: req.user._id,
    title: title || '',
    language: language || 'en',
  })
  logger.info(`recording session created id=${sessionId} user=${req.user.email}`)
  res.status(201).json(toPublic(session.toObject()))
}

export async function updateSession(req, res) {
  const { id } = req.params
  const { title, fullText, segments, timestampedWords, duration, wordCount, hasAudio } = req.body

  const update = {}
  if (title !== undefined) update.title = title
  if (fullText !== undefined) update.fullText = fullText
  if (segments !== undefined) update.segments = segments
  if (timestampedWords !== undefined) update.timestampedWords = timestampedWords
  if (duration !== undefined) update.duration = duration
  if (wordCount !== undefined) update.wordCount = wordCount
  if (hasAudio !== undefined) update.hasAudio = hasAudio

  const session = await RecordingSession.findOneAndUpdate(
    { sessionId: id, userId: req.user._id },
    { $set: update },
    { new: true, upsert: false }
  ).lean()

  if (!session) return res.status(404).json({ error: 'Session not found' })
  res.json(toPublic(session))
}

export async function deleteSession(req, res) {
  const { id } = req.params
  const result = await RecordingSession.deleteOne({ sessionId: id, userId: req.user._id })
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Session not found' })
  logger.info(`recording session deleted id=${id}`)
  res.json({ deleted: id })
}
