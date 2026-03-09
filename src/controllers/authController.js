import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { User } from '../models/User.js'

function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Body: { email, password, redirect_uri? } — redirect_uri echoed back so client can redirect to same page as host
// ---------------------------------------------------------------------------
function sanitizeRedirectUri(uri) {
  if (uri == null || typeof uri !== 'string') return null
  const s = uri.trim()
  // Must be a relative path (start with /), no protocol, no // (except leading)
  if (s === '' || !s.startsWith('/') || s.includes('//')) return null
  return s
}

export async function login(req, res) {
  const { email, password, redirect_uri } = req.body || {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() })

  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await user.comparePassword(password)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = signToken(user._id)
  const payload = { token, user: user.toSafeObject() }
  const safeRedirect = sanitizeRedirectUri(redirect_uri)
  if (safeRedirect) payload.redirect_uri = safeRedirect

  res.json(payload)
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup  (public — anyone can register with role 'user')
// Body: { name, email, password }
// ---------------------------------------------------------------------------
export async function signup(req, res) {
  const { name, email, password } = req.body || {}

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() })
  if (existing) {
    return res.status(409).json({ error: 'A user with this email already exists' })
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role: 'user',
  })

  const token = signToken(user._id)

  res.status(201).json({ token, user: user.toSafeObject() })
}

// ---------------------------------------------------------------------------
// GET /api/auth/me  (any authenticated user)
// ---------------------------------------------------------------------------
export async function me(req, res) {
  res.json({ user: req.user.toSafeObject() })
}

// ---------------------------------------------------------------------------
// GET /api/auth/users  (admin-only — list all users)
// ---------------------------------------------------------------------------
export async function listUsers(req, res) {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 })
  res.json(users)
}

// ---------------------------------------------------------------------------
// PATCH /api/auth/users/:id/deactivate  (admin-only)
// ---------------------------------------------------------------------------
export async function deactivateUser(req, res) {
  const { id } = req.params

  if (id === req.user._id.toString()) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' })
  }

  const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true }).select('-password')
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  res.json({ user })
}
