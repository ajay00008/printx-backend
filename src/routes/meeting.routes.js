import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  listMeetings, createMeeting, joinMeeting, endMeeting, deleteMeeting,
  listParticipants, listSpeakers, addSpeaker, updateSpeaker, removeSpeaker, assignSpeaker,
} from '../controllers/meetingController.js'

const router = Router()

/**
 * @swagger
 * /api/meetings:
 *   get:
 *     summary: List meetings
 *     tags: [Meetings]
 *     responses:
 *       200:
 *         description: List of meetings
 *   post:
 *     summary: Create a meeting
 *     tags: [Meetings]
 *     responses:
 *       200:
 *         description: Meeting created
 */
router.get('/api/meetings', listMeetings)
router.post('/api/meetings', createMeeting)

/**
 * @swagger
 * /api/meetings/{meeting_id}/join:
 *   post:
 *     summary: Join a meeting
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: meeting_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Joined meeting
 */
router.post('/api/meetings/:meeting_id/join', joinMeeting)
router.post('/api/meetings/:meeting_id/end', endMeeting)
router.delete('/api/meetings/:meeting_id', deleteMeeting)
router.get('/api/meetings/:meeting_id/participants', listParticipants)
router.get('/api/sessions/:session_id/speakers', requireAuth, listSpeakers)
router.post('/api/sessions/:session_id/speakers', requireAuth, addSpeaker)
router.put('/api/sessions/:session_id/speakers/:speaker_id', requireAuth, updateSpeaker)
router.delete('/api/sessions/:session_id/speakers/:speaker_id', requireAuth, removeSpeaker)
router.post('/api/sessions/:session_id/speakers/:speaker_id/assign/:segment_index', requireAuth, assignSpeaker)

export default router
