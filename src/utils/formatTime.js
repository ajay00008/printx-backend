/** Convert milliseconds → "m:ss" display string e.g. 65000 → "1:05" */
export function formatTimeMs(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
