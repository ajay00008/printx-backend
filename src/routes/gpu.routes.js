import { Router } from 'express'
import { gpuStatus, gpuWarmup, gpuRelease } from '../controllers/gpuController.js'

const router = Router()

/**
 * @swagger
 * /api/gpu/status:
 *   get:
 *     summary: Get GPU/model server status
 *     tags: [GPU]
 *     responses:
 *       200:
 *         description: GPU status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available: { type: boolean }
 *                 status: { type: string, example: ready }
 *                 message: { type: string }
 */
router.get('/api/gpu/status', gpuStatus)

/**
 * @swagger
 * /api/gpu/warmup:
 *   post:
 *     summary: Warmup / ping the GPU model server
 *     tags: [GPU]
 *     responses:
 *       200:
 *         description: Warmup result
 */
router.post('/api/gpu/warmup', gpuWarmup)

/**
 * @swagger
 * /api/gpu/release:
 *   post:
 *     summary: Release GPU (no-op — always-on)
 *     tags: [GPU]
 *     responses:
 *       200:
 *         description: Release acknowledged
 */
router.post('/api/gpu/release', gpuRelease)

export default router
