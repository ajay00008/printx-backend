import { Router } from 'express'
import { createShare, getShare, appendShare } from '../controllers/shareController.js'

const router = Router()

/**
 * @swagger
 * /api/share:
 *   post:
 *     summary: Create a shareable transcript link
 *     tags: [Share]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: My Meeting }
 *               full_text: { type: string }
 *               segments: { type: array, items: { $ref: '#/components/schemas/Segment' } }
 *               visibility: { type: string, enum: [public, restricted], default: restricted }
 *               session_id: { type: string, description: Used as share_id when valid }
 *     responses:
 *       200:
 *         description: Share created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 share_id: { type: string }
 *                 share_url: { type: string }
 */
router.post('/api/share', createShare)

/**
 * @swagger
 * /api/share/{share_id}:
 *   get:
 *     summary: Get a shared transcript by ID
 *     tags: [Share]
 *     parameters:
 *       - in: path
 *         name: share_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Share data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Share'
 *       404:
 *         description: Share not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/api/share/:share_id', getShare)

/**
 * @swagger
 * /api/share/{share_id}/append:
 *   post:
 *     summary: Append segments to a public share (join-share voice addition)
 *     tags: [Share]
 *     parameters:
 *       - in: path
 *         name: share_id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               segments: { type: array, items: { $ref: '#/components/schemas/Segment' } }
 *               speaker_name: { type: string, default: Guest }
 *     responses:
 *       200:
 *         description: Segments appended
 *       403:
 *         description: Share is not public
 *       404:
 *         description: Share not found
 */
router.post('/api/share/:share_id/append', appendShare)

/**
 * @swagger
 * /api/share/{share_id}/ws:
 *   get:
 *     summary: "[WebSocket] Join share room — receive live share_update events"
 *     tags: [Share]
 *     parameters:
 *       - in: path
 *         name: share_id
 *         required: true
 *         schema: { type: string }
 *     description: |
 *       Connect via WebSocket. On connect you receive the current share state.
 *       Whenever anyone appends, all room members receive:
 *       `{ type: "share_update", data: Share }`
 */

export default router
