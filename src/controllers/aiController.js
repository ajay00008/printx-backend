import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { config } from '../config/env.js'
import { logger } from '../utils/logger.js'

const GEMINI_PROMPTS = {
  summary: 'Summarize the following transcript concisely. Focus on main points, key decisions, and action items. Keep the summary clear and under 300 words.',
  keypoints: 'Extract the key points from this transcript as a bulleted list. Focus on important facts, decisions, and notable statements.',
  actionitems: 'Extract any action items, tasks, or follow-ups mentioned in this transcript. List them with who is responsible if mentioned.',
}

async function geminiGenerate(text, kind) {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured')
  const genAI = new GoogleGenerativeAI(config.geminiApiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  const prompt = `${GEMINI_PROMPTS[kind] || GEMINI_PROMPTS.summary}\n\nTranscript:\n${text.slice(0, 30000)}`
  const result = await model.generateContent(prompt)
  const responseText = result.response.text()
  if (!responseText) throw new Error('Empty response from Gemini')
  return responseText.trim()
}

function makeAiHandler(kind) {
  return async (req, res) => {
    const text = (req.body?.text || '').trim()
    if (!text) return res.status(400).json({ error: 'text is required' })
    try {
      const result = await geminiGenerate(text, kind)
      res.json({ [kind]: result })
    } catch (err) {
      logger.error(`AI ${kind} error: ${err.message}`)
      res.status(err.message.includes('not configured') ? 400 : 500).json({ error: err.message })
    }
  }
}

export const aiSummary     = makeAiHandler('summary')
export const aiKeypoints   = makeAiHandler('keypoints')
export const aiActionItems = makeAiHandler('actionitems')

export async function aiChat(req, res) {
  res.json({
    message: {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'AI chat is not enabled in this deployment.',
      timestamp: Date.now() / 1000,
    },
  })
}

export async function aiHistory(req, res) { res.json([]) }
export async function aiSuggestions(req, res) { res.json([]) }

export async function processTranscript(req, res) {
  const text = (req.body?.text || '').trim()
  if (!text) return res.json({ processed_text: '' })
  if (!config.openaiApiKey) {
    return res.status(500).json({ error: 'OpenAI not configured. Add OPENAI_API_KEY to use AI post-processing.' })
  }
  try {
    const client = new OpenAI({ apiKey: config.openaiApiKey })
    const prompt = `You are a world-class AI meeting assistant. Clean up this raw speech-to-text transcript:
1. Fix grammatical, spelling, or punctuation errors.
2. Remove filler words (um, uh, you know, like).
3. Structure output into: 'Cleaned Transcript' and 'Meeting Summary & Action Items'.

Raw transcript:
${text}`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    })
    res.json({ processed_text: response.choices[0].message.content })
  } catch (err) {
    logger.error(`processTranscript error: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
}
