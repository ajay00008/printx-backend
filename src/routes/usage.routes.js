import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  getUsageSummary,
  startUsageSession,
  heartbeatUsageSession,
  stopUsageSession,
  listUsageSessions,
} from '../controllers/usageController.js'

const router = express.Router()

router.use(requireAuth)

router.get('/api/usage/summary', getUsageSummary)
router.get('/api/usage/sessions', listUsageSessions)
router.post('/api/usage/sessions', startUsageSession)
router.patch('/api/usage/sessions/:id/heartbeat', heartbeatUsageSession)
router.patch('/api/usage/sessions/:id/stop', stopUsageSession)

export default router

