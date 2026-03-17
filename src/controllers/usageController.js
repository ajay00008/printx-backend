import { RecordingSession } from '../models/RecordingSession.js'
import { getLocalPeriodKeys, DAILY_LIMIT_SECONDS, MONTHLY_LIMIT_SECONDS } from '../utils/usageLimits.js'

function getClientTimezone(req, explicitTz) {
  if (explicitTz && typeof explicitTz === 'string' && explicitTz.trim()) return explicitTz.trim()
  const headerTz = req.headers['x-timezone']
  if (typeof headerTz === 'string' && headerTz.trim()) return headerTz.trim()
  return 'UTC'
}

function buildUsagePayload(dailyUsedSeconds, monthlyUsedSeconds) {
  return {
    daily: {
      usedSeconds: dailyUsedSeconds,
      remainingSeconds: Math.max(0, DAILY_LIMIT_SECONDS - dailyUsedSeconds),
      limitSeconds: DAILY_LIMIT_SECONDS,
    },
    monthly: {
      usedSeconds: monthlyUsedSeconds,
      remainingSeconds: Math.max(0, MONTHLY_LIMIT_SECONDS - monthlyUsedSeconds),
      limitSeconds: MONTHLY_LIMIT_SECONDS,
    },
  }
}

/**
 * Compute daily and monthly used seconds from RecordingSessions.
 * If recordingSessionId + currentDurationSeconds are provided, use that duration for the active session (real-time).
 */
async function getUsedSeconds(userId, timezone, recordingSessionId = null, currentDurationSeconds = 0) {
  const now = new Date()
  const { dayKey, monthKey } = getLocalPeriodKeys(now, timezone)

  const [daySessions, monthSessions] = await Promise.all([
    RecordingSession.find({ userId, sessionDayKey: dayKey }).select('sessionId duration').lean(),
    RecordingSession.find({ userId, sessionMonthKey: monthKey }).select('sessionId duration').lean(),
  ])

  const sumWithActive = (sessions, activeId, activeDuration) => {
    let total = 0
    let substituted = false
    for (const s of sessions) {
      if (activeId && s.sessionId === activeId) {
        total += activeDuration
        substituted = true
      } else {
        total += s.duration || 0
      }
    }
    if (activeId && !substituted && activeDuration > 0) total += activeDuration
    return total
  }

  const dailyUsed = sumWithActive(daySessions, recordingSessionId, currentDurationSeconds)
  const monthlyUsed = sumWithActive(monthSessions, recordingSessionId, currentDurationSeconds)
  return { dailyUsed, monthlyUsed }
}

export async function getUsageSummary(req, res) {
  const userId = req.user._id
  const timezone = getClientTimezone(req, req.user.timezone)
  const recordingSessionId = req.query.recordingSessionId || null
  const currentDurationSeconds = Math.max(0, Number(req.query.currentDurationSeconds) || 0)

  const { dailyUsed, monthlyUsed } = await getUsedSeconds(userId, timezone, recordingSessionId, currentDurationSeconds)

  res.json({
    timezone,
    ...buildUsagePayload(dailyUsed, monthlyUsed),
  })
}

export async function startUsageSession(req, res) {
  const user = req.user
  const { feature, recordingSessionId, timezone: bodyTz } = req.body || {}
  if (!feature || typeof feature !== 'string') {
    return res.status(400).json({ error: 'feature is required' })
  }
  if (!recordingSessionId || typeof recordingSessionId !== 'string') {
    return res.status(400).json({ error: 'recordingSessionId is required' })
  }

  const timezone = getClientTimezone(req, bodyTz || user.timezone)

  const session = await RecordingSession.findOne({ sessionId: recordingSessionId.trim(), userId: user._id })
  if (!session) {
    return res.status(404).json({ error: 'Recording session not found' })
  }

  if (!session.sessionDayKey || !session.sessionMonthKey) {
    const now = new Date()
    const { dayKey, monthKey } = getLocalPeriodKeys(now, timezone)
    await RecordingSession.updateOne(
      { _id: session._id },
      { $set: { sessionDayKey: dayKey, sessionMonthKey: monthKey, timezone } }
    )
  }

  const { dailyUsed, monthlyUsed } = await getUsedSeconds(user._id, timezone, recordingSessionId, 0)
  const usage = buildUsagePayload(dailyUsed, monthlyUsed)

  if (usage.daily.remainingSeconds <= 0) {
    return res.status(200).json({ canContinue: false, reason: 'daily_limit', usage })
  }
  if (usage.monthly.remainingSeconds <= 0) {
    return res.status(200).json({ canContinue: false, reason: 'monthly_limit', usage })
  }

  res.status(201).json({
    sessionId: recordingSessionId,
    canContinue: true,
    reason: null,
    usage,
  })
}

export async function heartbeatUsageSession(req, res) {
  const userId = req.user._id
  const recordingSessionId = req.params.id
  const currentDurationSeconds = Math.max(0, Number(req.body?.currentDurationSeconds ?? req.query?.currentDurationSeconds) ?? 0)

  const session = await RecordingSession.findOne({ sessionId: recordingSessionId, userId }).lean()
  if (!session) {
    return res.status(404).json({ error: 'Recording session not found' })
  }

  const timezone = session.timezone || getClientTimezone(req, req.user?.timezone)
  const { dailyUsed, monthlyUsed } = await getUsedSeconds(userId, timezone, recordingSessionId, currentDurationSeconds)
  const usage = buildUsagePayload(dailyUsed, monthlyUsed)

  const canContinue = usage.daily.remainingSeconds > 0 && usage.monthly.remainingSeconds > 0
  const reason = !canContinue
    ? (usage.daily.remainingSeconds <= 0 ? 'daily_limit' : 'monthly_limit')
    : null

  res.json({
    canContinue,
    reason,
    usage,
  })
}

export async function stopUsageSession(req, res) {
  res.json({ ok: true })
}

export async function listUsageSessions(req, res) {
  const userId = req.user._id
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const sessions = await RecordingSession.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('sessionId title duration sessionDayKey sessionMonthKey createdAt updatedAt')
    .lean()

  res.json(
    sessions.map((s) => ({
      id: s.sessionId,
      title: s.title,
      durationSeconds: s.duration || 0,
      sessionDayKey: s.sessionDayKey,
      sessionMonthKey: s.sessionMonthKey,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
  )
}
