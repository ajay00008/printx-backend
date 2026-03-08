import { User } from '../models/User.js'
import { logger } from './logger.js'

const ADMIN_EMAIL = 'admin@printx-ai.in'
const ADMIN_PASSWORD = 'Admin123'
const ADMIN_NAME = 'Admin'

/**
 * Ensures the default admin account exists in the DB.
 * Called once after MongoDB connects. Safe to run on every restart —
 * it skips creation if the admin already exists.
 */
export async function seedAdmin() {
  try {
    const existing = await User.findOne({ email: ADMIN_EMAIL })
    if (existing) {
      logger.info(`Admin user already exists: ${ADMIN_EMAIL}`)
      return
    }

    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
    })

    logger.info(`Admin user seeded: ${ADMIN_EMAIL}`)
  } catch (err) {
    logger.error(`Failed to seed admin user: ${err.message}`)
  }
}
