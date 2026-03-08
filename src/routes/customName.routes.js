import { Router } from 'express'
import { listCustomNames, addCustomNames } from '../controllers/customNameController.js'

const router = Router()

/**
 * @swagger
 * /api/custom-names:
 *   get:
 *     summary: Get all custom name corrections (ASR → display)
 *     tags: [CustomNames]
 *     responses:
 *       200:
 *         description: Custom names map
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 names: { type: object, additionalProperties: { type: string } }
 *                 count: { type: number }
 *   post:
 *     summary: Add custom name corrections
 *     tags: [CustomNames]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               asr: { type: string, example: ajay }
 *               display: { type: string, example: Ajay Kumar }
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     asr: { type: string }
 *                     display: { type: string }
 *     responses:
 *       200:
 *         description: Names updated
 */
router.get('/api/custom-names', listCustomNames)
router.post('/api/custom-names', addCustomNames)

export default router
