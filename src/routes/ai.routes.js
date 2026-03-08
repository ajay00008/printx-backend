import { Router } from 'express'
import { aiSummary, aiKeypoints, aiActionItems, aiChat, aiHistory, aiSuggestions, processTranscript } from '../controllers/aiController.js'

const router = Router()

/**
 * @swagger
 * /api/ai/summary:
 *   post:
 *     summary: Generate AI summary from transcript text (Gemini)
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *     responses:
 *       200:
 *         description: Summary generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary: { type: string }
 */
router.post('/api/ai/summary', aiSummary)

/**
 * @swagger
 * /api/ai/keypoints:
 *   post:
 *     summary: Extract key points from transcript (Gemini)
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *     responses:
 *       200:
 *         description: Key points extracted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keypoints: { type: string }
 */
router.post('/api/ai/keypoints', aiKeypoints)

/**
 * @swagger
 * /api/ai/actionitems:
 *   post:
 *     summary: Extract action items from transcript (Gemini)
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *     responses:
 *       200:
 *         description: Action items extracted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 actionitems: { type: string }
 */
router.post('/api/ai/actionitems', aiActionItems)

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: AI chat (stub)
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: Chat response
 */
router.post('/api/ai/chat', aiChat)
router.get('/api/ai/history', aiHistory)
router.get('/api/ai/suggestions', aiSuggestions)

/**
 * @swagger
 * /api/process-transcript:
 *   post:
 *     summary: Clean and structure a transcript using GPT-4o-mini (OpenAI)
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *     responses:
 *       200:
 *         description: Cleaned transcript
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 processed_text: { type: string }
 */
router.post('/api/process-transcript', processTranscript)

export default router
