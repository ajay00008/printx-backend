/**
 * Shared helpers for usage limits (day/month keys in user timezone).
 * Used by RecordingSession (set sessionDayKey/sessionMonthKey) and usage controller (aggregate by day/month).
 */
export function getLocalPeriodKeys(date, timezone) {
  const tz = timezone && typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'UTC'
  try {
    const fmtDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const fmtMonth = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
    })
    const dayParts = fmtDay.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc }, {})
    const monthParts = fmtMonth.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc }, {})
    return {
      dayKey: `${dayParts.year}-${dayParts.month}-${dayParts.day}`,
      monthKey: `${monthParts.year}-${monthParts.month}`,
    }
  } catch {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return { dayKey: `${y}-${m}-${d}`, monthKey: `${y}-${m}` }
  }
}

export const DAILY_LIMIT_SECONDS = 25 * 60
export const MONTHLY_LIMIT_SECONDS = 300 * 60
