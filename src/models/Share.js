import mongoose from 'mongoose'

const shareSchema = new mongoose.Schema(
  {
    shareId: { type: String, required: true, unique: true, index: true },
    recordingSessionId: { type: String, index: true },
    title: { type: String, default: 'Shared transcript' },
    visibility: { type: String, enum: ['public', 'restricted'], default: 'restricted' },
    recordingUrl: { type: String, default: null },
  },
  { timestamps: true }
)

/** Normalize RecordingSession segment to share payload shape */
function segmentToPublic(s) {
  const ts = s.timestamp ?? s.start_time_ms ?? 0
  return {
    text: s.text || '',
    time: s.time || '0:00',
    timestamp: ts,
    speakerId: s.speakerId ?? s.speaker ?? null,
    speakerName: s.speakerName || s.speaker || 'Speaker 1',
  }
}

/** Build public payload from Share metadata + RecordingSession transcript (single source of truth) */
export function buildSharePayload(share, recordingSession, fallbackShareId) {
  const fullText = recordingSession?.fullText ?? ''
  const segments = (recordingSession?.segments ?? []).map(segmentToPublic)
  return {
    share_id: share?.shareId ?? recordingSession?.sessionId ?? fallbackShareId,
    title: share?.title ?? recordingSession?.title ?? 'Shared transcript',
    full_text: fullText || ' ',
    segments,
    partial_text: '',
    created_at: (share?.createdAt ?? recordingSession?.createdAt)?.getTime?.() / 1000 ?? Date.now() / 1000,
    visibility: share?.visibility ?? 'public',
    recording_url: share?.recordingUrl || undefined,
  }
}

export const Share = mongoose.model('Share', shareSchema)
