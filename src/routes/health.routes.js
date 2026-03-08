import { Router } from 'express'
import { getHealth, getDebug } from '../controllers/healthController.js'

const router = Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Server health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: healthy }
 *                 uptime: { type: number, example: 120 }
 *                 model_server: { type: object }
 */
router.get('/health', getHealth)
router.get('/api/health', getHealth)

/**
 * @swagger
 * /api/debug:
 *   get:
 *     summary: Debug info — config and connectivity checks
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Debug information
 */
router.get('/api/debug', getDebug)

export default router
