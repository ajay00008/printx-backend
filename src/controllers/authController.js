import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { config } from '../config/env.js'
import { User } from '../models/User.js'
import { getUsageForUserId } from './usageController.js'
import { sendPasswordResetEmail, sendVerificationOtpEmail } from '../utils/email.js'

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

  // Require email verification before issuing token
  if (!user.emailVerified) {
    const otp = String(crypto.randomInt(100_000, 999_999))
    const otpHash = await bcrypt.hash(otp, 10)
    const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 min
    await User.updateOne(
      { _id: user._id },
      { $set: { emailVerificationOtpHash: otpHash, emailVerificationOtpExpires: expires } }
    )
    await sendVerificationOtpEmail(user.email, otp)
    return res.json({
      requiresEmailVerification: true,
      email: user.email,
    })
  }

  const token = signToken(user._id)
  const payload = { token, user: user.toSafeObject() }
  const safeRedirect = sanitizeRedirectUri(redirect_uri)
  if (safeRedirect) payload.redirect_uri = safeRedirect

  res.json(payload)
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup  (public — anyone can register with role 'user')
// Body: { name, email, password, country?, state?, city? } — location for compliance
// ---------------------------------------------------------------------------
export async function signup(req, res) {
  const { name, email, password, country, state: stateVal, city } = req.body || {}

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

  const countryCode =
    typeof country === 'string' && country.trim().length === 2
      ? country.trim().toUpperCase()
      : undefined
  const stateStr = typeof stateVal === 'string' ? stateVal.trim() || undefined : undefined
  const cityStr = typeof city === 'string' ? city.trim() || undefined : undefined

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role: 'user',
    ...(countryCode && { country: countryCode }),
    ...(stateStr && { state: stateStr }),
    ...(cityStr && { city: cityStr }),
  })

  // Require email verification before issuing token (same as login)
  if (!user.emailVerified) {
    const otp = String(crypto.randomInt(100_000, 999_999))
    const otpHash = await bcrypt.hash(otp, 10)
    const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 min
    await User.updateOne(
      { _id: user._id },
      { $set: { emailVerificationOtpHash: otpHash, emailVerificationOtpExpires: expires } }
    )
    await sendVerificationOtpEmail(user.email, otp)
    return res.status(201).json({
      requiresEmailVerification: true,
      email: user.email,
    })
  }

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
// GET /api/auth/users  (admin-only — list users, paginated + searchable)
// ---------------------------------------------------------------------------
export async function listUsers(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
  const q = (req.query.q || '').toString().trim()

  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      }
    : {}

  const [userDocs, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    User.countDocuments(filter),
  ])

  const items = await Promise.all(
    userDocs.map(async (u) => {
      const usage = await getUsageForUserId(u._id, u.timezone || 'UTC')
      return { ...u, usage }
    })
  )

  res.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
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

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password  (public)
// Body: { email, resetBaseUrl } — resetBaseUrl from frontend (e.g. window.location.origin)
// ---------------------------------------------------------------------------
export async function forgotPassword(req, res) {
  const { email, resetBaseUrl } = req.body || {}
  const rawEmail = (email || '').toString().trim().toLowerCase()
  if (!rawEmail) {
    return res.status(400).json({ error: 'Email is required' })
  }

  const user = await User.findOne({ email: rawEmail })
  if (!user) {
    return res.json({ message: 'If an account exists with this email, you will receive a reset link.' })
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(rawToken, 10)
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordResetToken: tokenHash, passwordResetExpires: expires } }
  )

  const base = (resetBaseUrl || '').toString().trim().replace(/\/$/, '')
  const resetUrl = base ? `${base}/reset-password?token=${rawToken}` : null
  if (resetUrl) {
    await sendPasswordResetEmail(user.email, resetUrl)
  }

  res.json({ message: 'If an account exists with this email, you will receive a reset link.' })
}

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password  (public)
// Body: { token, newPassword } — token can also be sent as query param
// ---------------------------------------------------------------------------
export async function resetPassword(req, res) {
  const token = (req.body?.token || req.query?.token || '').toString().trim()
  const newPassword = (req.body?.newPassword || req.body?.new_password || '').toString()
  if (!token) {
    return res.status(400).json({ error: 'Reset token is required' })
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const now = new Date()
  const candidates = await User.find({
    passwordResetToken: { $exists: true, $ne: null },
    passwordResetExpires: { $gt: now },
  })
  let user = null
  for (const u of candidates) {
    const match = await bcrypt.compare(token, u.passwordResetToken)
    if (match) {
      user = u
      break
    }
  }
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired reset link. Request a new one.' })
  }

  user.password = newPassword
  user.passwordResetToken = undefined
  user.passwordResetExpires = undefined
  await user.save()

  res.json({ message: 'Password updated. You can sign in with your new password.' })
}

// ---------------------------------------------------------------------------
// POST /api/auth/verify-email  (public)
// Body: { email, otp } — after login returned requiresEmailVerification
// ---------------------------------------------------------------------------
export async function verifyEmail(req, res) {
  const { email, otp } = req.body || {}
  const rawEmail = (email || '').toString().trim().toLowerCase()
  const rawOtp = (otp || '').toString().trim()
  if (!rawEmail || !rawOtp) {
    return res.status(400).json({ error: 'Email and OTP are required' })
  }

  const user = await User.findOne({ email: rawEmail })
  if (!user || !user.emailVerificationOtpHash || !user.emailVerificationOtpExpires) {
    return res.status(400).json({ error: 'Invalid or expired code. Try signing in again to get a new code.' })
  }
  if (new Date() > user.emailVerificationOtpExpires) {
    await User.updateOne(
      { _id: user._id },
      { $unset: { emailVerificationOtpHash: 1, emailVerificationOtpExpires: 1 } }
    )
    return res.status(400).json({ error: 'Code expired. Try signing in again to get a new code.' })
  }

  const valid = await bcrypt.compare(rawOtp, user.emailVerificationOtpHash)
  if (!valid) {
    return res.status(400).json({ error: 'Invalid code.' })
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: { emailVerified: true, emailVerifiedAt: new Date() },
      $unset: { emailVerificationOtpHash: 1, emailVerificationOtpExpires: 1 },
    }
  )
  const updated = await User.findById(user._id)
  const jwtToken = signToken(updated._id)
  res.json({ token: jwtToken, user: updated.toSafeObject() })
}

// ---------------------------------------------------------------------------
// POST /api/auth/resend-verification-email  (public)
// Body: { email } — sends a new OTP for email verification
// ---------------------------------------------------------------------------
export async function resendVerificationEmail(req, res) {
  const { email } = req.body || {}
  const rawEmail = (email || '').toString().trim().toLowerCase()
  if (!rawEmail) {
    return res.status(400).json({ error: 'Email is required' })
  }

  const user = await User.findOne({ email: rawEmail })
  if (!user) {
    return res.json({ message: 'If an account exists with this email, you will receive a new code.' })
  }
  if (user.emailVerified) {
    return res.status(400).json({ error: 'Email is already verified. You can sign in.' })
  }

  const otp = String(crypto.randomInt(100_000, 999_999))
  const otpHash = await bcrypt.hash(otp, 10)
  const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 min
  await User.updateOne(
    { _id: user._id },
    { $set: { emailVerificationOtpHash: otpHash, emailVerificationOtpExpires: expires } }
  )
  await sendVerificationOtpEmail(user.email, otp)

  res.json({ message: 'Verification email sent.' })
}
