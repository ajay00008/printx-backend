import nodemailer from 'nodemailer'
import { config } from '../config/env.js'
import { logger } from './logger.js'

function getTransporter() {
  if (!config.smtpHost || !config.smtpUser) {
    return null
  }
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    // secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  })
}

/**
 * Send an email. If SMTP is not configured, logs the content and resolves (no error).
 */
export async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter()
  const from = config.mailFrom
  const payload = { from, to, subject, text: text || undefined, html: html || undefined }

  if (!transporter) {
    logger.info('[Email] SMTP not configured; would send', { to, subject })
    return
  }

  try {
    await transporter.sendMail(payload)
    logger.info('[Email] sent', { to, subject })
  } catch (err) {
    logger.error('[Email] send failed', { to, subject, message: err.message })
    throw err
  }
}

export async function sendPasswordResetEmail(to, resetUrl) {
  const subject = 'Reset your password'
  const text = `You requested a password reset. Open this link to set a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`
  const html = `
    <p>You requested a password reset.</p>
    <p><a href="${resetUrl}">Reset your password</a> (valid for 1 hour).</p>
    <p>If you didn't request this, ignore this email.</p>
  `
  await sendMail({ to, subject, text, html })
}

export async function sendVerificationOtpEmail(to, otp) {
  const subject = 'Your verification code'
  const text = `Your verification code is: ${otp}\n\nIt expires in 10 minutes.`
  const html = `
    <p>Your verification code is: <strong>${otp}</strong></p>
    <p>It expires in 10 minutes.</p>
  `
  await sendMail({ to, subject, text, html })
}
