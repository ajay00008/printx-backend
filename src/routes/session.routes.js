import { Router } from 'express'
import { startSession, deleteSession } from '../controllers/sessionController.js'
import { optionalAuth } from '../middleware/auth.js'

const router = Router()

/**
 * @swagger
 * /api/session/start:
 *   post:
 *     summary: Start a new STT session
 *     tags: [Session]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               language: { type: string, example: en }
 *     responses:
 *       200:
 *         description: Session created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 */
router.post('/api/session/start', optionalAuth, startSession)

/**
 * @swagger
 * /api/session/{session_id}:
 *   delete:
 *     summary: Delete a session
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Session deleted
 */
router.delete('/api/session/:session_id', deleteSession)

export default router
