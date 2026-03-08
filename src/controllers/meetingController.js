import { v4 as uuidv4 } from 'uuid'

// Stub controllers — extend with a Meeting model when needed
export const listMeetings         = (req, res) => res.json([])
export const createMeeting        = (req, res) => res.json({ id: uuidv4(), status: 'scheduled', session_id: null, type: 'instant', platform: 'printx', participants: [] })
export const joinMeeting          = (req, res) => res.json({ id: req.params.meeting_id, status: 'live', session_id: null, platform: 'printx', participants: [] })
export const endMeeting           = (req, res) => res.json({ id: req.params.meeting_id, status: 'ended' })
export const deleteMeeting        = (req, res) => res.json({ deleted: true })
export const listParticipants     = (req, res) => res.json([])
export const listSpeakers         = (req, res) => res.json([])
export const addSpeaker           = (req, res) => res.json({ id: uuidv4(), name: 'Speaker', is_host: false, word_count: 0, speaking_time: 0, color_index: 0 })
export const updateSpeaker        = (req, res) => res.json({ id: req.params.speaker_id })
export const removeSpeaker        = (req, res) => res.json({ deleted: true })
export const assignSpeaker        = (req, res) => res.json({ assigned: true })
