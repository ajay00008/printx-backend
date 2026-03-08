import { CustomName } from '../models/CustomName.js'
import { logger } from '../utils/logger.js'
import { reloadCustomNames } from '../utils/correctNames.js'

export async function listCustomNames(req, res) {
  const names = await CustomName.find({}).lean()
  const map = Object.fromEntries(names.map((n) => [n.asr, n.display]))
  res.json({ names: map, count: names.length })
}

export async function addCustomNames(req, res) {
  const body = req.body || {}
  const toAdd = []

  if (body.asr && body.display) toAdd.push({ asr: body.asr.trim().toLowerCase(), display: body.display.trim() })
  if (Array.isArray(body.entries)) {
    body.entries.forEach((e) => {
      if (e.asr && e.display) toAdd.push({ asr: e.asr.trim().toLowerCase(), display: e.display.trim() })
    })
  }

  if (!toAdd.length) return res.status(400).json({ error: "Provide 'asr' and 'display' or 'entries' list" })

  await Promise.all(
    toAdd.map((e) => CustomName.findOneAndUpdate({ asr: e.asr }, e, { upsert: true, new: true }))
  )

  const all = await CustomName.find({}).lean()
  const map = Object.fromEntries(all.map((n) => [n.asr, n.display]))
  logger.info(`custom-names updated count=${all.length}`)

  // Rebuild in-memory correction maps so the next transcript uses fresh data
  await reloadCustomNames()

  res.json({ ok: true, names: map, count: all.length })
}
