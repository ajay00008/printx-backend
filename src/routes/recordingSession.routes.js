import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  listSessions,
  createSession,
  updateSession,
  deleteSession,
} from '../controllers/recordingSessionController.js'

const router = Router()

/**
 * @swagger
 * /api/recording-sessions:
 *   get:
 *     summary: List all recording sessions for the authenticated user
 *     tags: [RecordingSessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sessions
 */
router.get('/api/recording-sessions', requireAuth, listSessions)

/**
 * @swagger
 * /api/recording-sessions:
 *   post:
 *     summary: Create a new recording session
 *     tags: [RecordingSessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId: { type: string }
 *               title: { type: string }
 *               language: { type: string }
 *     responses:
 *       201:
 *         description: Session created
 */
router.post('/api/recording-sessions', requireAuth, createSession)

/**
 * @swagger
 * /api/recording-sessions/{id}:
 *   put:
 *     summary: Update a recording session (transcription, segments, etc.)
 *     tags: [RecordingSessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Session updated
 *       404:
 *         description: Session not found
 */
router.put('/api/recording-sessions/:id', requireAuth, updateSession)

/**
 * @swagger
 * /api/recording-sessions/{id}:
 *   delete:
 *     summary: Delete a recording session
 *     tags: [RecordingSessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Session deleted
 */
router.delete('/api/recording-sessions/:id', requireAuth, deleteSession)

export default router
