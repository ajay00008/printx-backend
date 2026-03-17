import mongoose from 'mongoose'

const segmentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    time: { type: String, default: '0:00' },
    timestamp: { type: Number, default: 0 },
    speakerId: { type: String, default: null },
    speakerName: { type: String, default: null },
  },
  { _id: false }
)

const timestampedWordSchema = new mongoose.Schema(
  {
    word: { type: String, required: true },
    time: { type: String, default: '0:00' },
    timestamp: { type: Number, default: 0 },
    confidence: { type: Number, default: 1 },
    speakerId: { type: String, default: null },
  },
  { _id: false }
)

const speakerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, default: 'Speaker' },
    userId: { type: String, default: null },
    is_host: { type: Boolean, default: false },
    color_index: { type: Number, default: 0 },
    word_count: { type: Number, default: 0 },
    speaking_time: { type: Number, default: 0 },
    avatar: { type: String, default: null },
    email: { type: String, default: null },
  },
  { _id: false }
)

const recordingSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: '' },
    language: { type: String, default: 'en' },
    fullText: { type: String, default: '' },
    segments: { type: [segmentSchema], default: [] },
    timestampedWords: { type: [timestampedWordSchema], default: [] },
    speakers: { type: [speakerSchema], default: [] },
    duration: { type: Number, default: 0 },
    wordCount: { type: Number, default: 0 },
    hasAudio: { type: Boolean, default: false },
    /** For usage limits: YYYY-MM-DD and YYYY-MM in user's timezone when session was created */
    sessionDayKey: { type: String, default: null, index: true },
    sessionMonthKey: { type: String, default: null, index: true },
    timezone: { type: String, default: null },
  },
  { timestamps: true }
)

export const RecordingSession = mongoose.model('RecordingSession', recordingSessionSchema)
