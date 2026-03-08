import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    sessionToken: { type: String, required: true, unique: true, index: true },
    language: { type: String, default: 'en' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    recordingSessionId: { type: String, default: null },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }, // 24h TTL
  },
  { timestamps: true }
)

// Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const Session = mongoose.model('Session', sessionSchema)
