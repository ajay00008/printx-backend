import { Router } from 'express'
import multer from 'multer'
import { transcribeAudio, diarizeAudio, diarizeRealtime } from '../controllers/transcribeController.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

/**
 * @swagger
 * /api/transcribe:
 *   post:
 *     summary: Upload an audio file and transcribe it (OpenAI Whisper)
 *     tags: [Transcribe]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [audio]
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *               language:
 *                 type: string
 *                 default: en
 *     responses:
 *       200:
 *         description: Transcription result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 full_text: { type: string }
 *                 segments: { type: array, items: { $ref: '#/components/schemas/Segment' } }
 */
router.post('/api/transcribe', upload.single('audio'), transcribeAudio)

/**
 * @swagger
 * /api/diarize:
 *   post:
 *     summary: Speaker diarization (stub)
 *     tags: [Transcribe]
 *     responses:
 *       200:
 *         description: Diarization result
 */
router.post('/api/diarize', upload.single('audio'), diarizeAudio)

/**
 * @swagger
 * /api/diarize/realtime:
 *   post:
 *     summary: Real-time diarization (stub)
 *     tags: [Transcribe]
 *     responses:
 *       200:
 *         description: Speaker identification result
 */
router.post('/api/diarize/realtime', upload.single('audio'), diarizeRealtime)

export default router
