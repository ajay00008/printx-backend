import { config } from '../config/env.js'

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info

function log(level, msg) {
  if ((LEVELS[level] ?? 99) > currentLevel) return
  const ts = new Date().toISOString()
  const prefix = `[printx] [${level.toUpperCase()}]`
  if (level === 'error') console.error(`${ts} ${prefix} ${msg}`)
  else if (level === 'warn') console.warn(`${ts} ${prefix} ${msg}`)
  else console.log(`${ts} ${prefix} ${msg}`)
}

export const logger = {
  info:  (msg) => log('info', msg),
  warn:  (msg) => log('warn', msg),
  error: (msg) => log('error', msg),
  debug: (msg) => log('debug', msg),
}
