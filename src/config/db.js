import mongoose from 'mongoose'
import { config } from './env.js'
import { logger } from '../utils/logger.js'

export async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri)
    logger.info(`MongoDB connected: ${config.mongoUri}`)
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`)
    process.exit(1)
  }
}
