import OpenAI from 'openai'
import { config } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { correctNames } from '../utils/correctNames.js'

const ACCEPTED_EXTENSIONS = ['mp3', 'wav', 'm4a', 'mp4', 'webm', 'ogg', 'flac', 'aac', 'mpeg', 'mpga']

export async function transcribeAudio(req, res) {
  if (!config.openaiApiKey) {
    return res.status(503).json({
      error: 'Import Audio requires OPENAI_API_KEY in .env.',
    })
  }

  if (!req.file) return res.status(400).json({ error: 'audio file is required' })

  const ext = (req.file.originalname || '').split('.').pop().toLowerCase()
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({ error: `Unsupported format. Use: ${ACCEPTED_EXTENSIONS.join(', ')}` })
  }

  const language = req.body?.language || 'en'

  try {
    const client = new OpenAI({ apiKey: config.openaiApiKey })

    // OpenAI SDK accepts a File-like object; we wrap the buffer
    const file = new File([req.file.buffer], req.file.originalname, { type: req.file.mimetype })

    const result = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: language === 'auto' ? undefined : language,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    })

    const fullText = await correctNames(result.text || '')
    const segments = await Promise.all(
      (result.segments || []).map(async (s) => {
        const startSec = s.start || 0
        const m = Math.floor(startSec / 60)
        const sec = Math.floor(startSec % 60)
        return {
          text: await correctNames((s.text || '').trim()),
          time: `${m}:${String(sec).padStart(2, '0')}`,
          timestamp: Math.round(startSec * 1000),
          speakerName: 'Speaker 1',
        }
      })
    )

    if (!segments.length && fullText) {
      segments.push({ text: fullText, time: '0:00', timestamp: 0, speakerName: 'Speaker 1' })
    }

    res.json({ full_text: fullText, segments })
  } catch (err) {
    logger.error(`transcribe file error: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
}

export async function diarizeAudio(req, res) {
  res.json({
    segments: [],
    speakers: [{ id: 'spk_1', name: 'Speaker 1', is_host: true, word_count: 0, speaking_time: 0, color_index: 0 }],
    num_speakers: 1,
  })
}

export async function diarizeRealtime(req, res) {
  res.json({
    speaker_id: 'spk_1',
    speaker_name: 'Speaker 1',
    confidence: 0.0,
    is_new_speaker: false,
    speaker: { id: 'spk_1', name: 'Speaker 1', is_host: true, word_count: 0, speaking_time: 0, color_index: 0 },
  })
}
