import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { User } from '../models/User.js'

/**
 * requireAuth — verifies the JWT from the Authorization header.
 * Attaches the full user document to req.user on success.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret)
    const user = await User.findById(payload.sub).select('-password')

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' })
    }

    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * optionalAuth — attaches req.user when a valid JWT is present, but never
 * rejects the request.  Use this for endpoints that work for both
 * authenticated and anonymous users (e.g. POST /api/session/start).
 */
export async function optionalAuth(req, res, next) {
  const header = req.headers['authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return next()

  try {
    const payload = jwt.verify(token, config.jwtSecret)
    const user = await User.findById(payload.sub).select('-password')
    if (user && user.isActive) req.user = user
  } catch {
    // invalid token — proceed without user
  }
  next()
}

/**
 * requireRole(...roles) — role guard, must come after requireAuth.
 * Usage: router.post('/signup', requireAuth, requireRole('admin'), handler)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}
