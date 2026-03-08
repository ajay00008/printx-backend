import { logger } from '../utils/logger.js'

/** Global Express error handler — always returns JSON */
export function errorHandler(err, req, res, next) {
  logger.error(`unhandled error: ${err.message}`)
  const status = err.status || err.statusCode || 500
  res.status(status).json({ error: err.message || 'Internal server error' })
}

/** 404 handler for unknown REST routes */
export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
}
