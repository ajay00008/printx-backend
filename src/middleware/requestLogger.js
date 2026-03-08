import { logger } from '../utils/logger.js'

export function requestLogger(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`)
  })
  next()
}
