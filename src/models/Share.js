import mongoose from 'mongoose'

const segmentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    time: { type: String, default: '0:00' },
    timestamp: { type: Number, default: 0 },
    speakerId: { type: String, default: null },
    speakerName: { type: String, default: 'Speaker 1' },
  },
  { _id: false }
)

const shareSchema = new mongoose.Schema(
  {
    shareId: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: 'Shared transcript' },
    fullText: { type: String, default: ' ' },
    segments: { type: [segmentSchema], default: [] },
    visibility: { type: String, enum: ['public', 'restricted'], default: 'restricted' },
    recordingUrl: { type: String, default: null },
  },
  { timestamps: true }
)

/** Build the public-facing payload shape (same as Python _share_build_out) */
shareSchema.methods.toPublic = function () {
  return {
    share_id: this.shareId,
    title: this.title,
    full_text: this.fullText,
    segments: this.segments.map((s) => ({
      text: s.text,
      time: s.time,
      timestamp: s.timestamp,
      speakerId: s.speakerId,
      speakerName: s.speakerName,
    })),
    created_at: this.createdAt?.getTime() / 1000,
    visibility: this.visibility,
    recording_url: this.recordingUrl || undefined,
  }
}

export const Share = mongoose.model('Share', shareSchema)
