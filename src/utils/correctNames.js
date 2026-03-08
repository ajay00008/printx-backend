/**
 * correctNames — port of the Python correct_names() / _build_proper_names() logic.
 *
 * Uses:
 *  - src/data/common_english_words.json  →  stopword filter
 *  - CustomName documents from MongoDB   →  ASR key → display value map
 *
 * Applied to every transcript chunk (interim + final) in streamBridge
 * and to Whisper output in transcribeController.
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { CustomName } from '../models/CustomName.js'
import { logger } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Stopwords ─────────────────────────────────────────────────────────────────

const BASE_STOPWORDS = new Set([
  'a','an','the','this','that','these','those','and','or','but','nor',
  'so','yet','for','of','in','on','at','to','by','up','as','if','is',
  'it','be','do','from','with','into','about','after','before','while',
  'i','me','my','we','us','you','he','him','she','her','they','them',
  'am','are','was','were','been','being','have','has','had','will',
  'would','shall','should','may','might','must','can','could',
])

function loadStopwords() {
  try {
    const filePath = join(__dirname, '../data/common_english_words.json')
    const words = JSON.parse(readFileSync(filePath, 'utf-8'))
    const all = new Set(BASE_STOPWORDS)
    for (const w of words) all.add(w.toLowerCase())
    logger.info(`stopwords loaded: ${all.size} words`)
    return all
  } catch (err) {
    logger.warn(`common_english_words.json not found, using base stopwords: ${err.message}`)
    return new Set(BASE_STOPWORDS)
  }
}

const STOPWORDS = loadStopwords()

// ── Fuzzy helpers (Levenshtein ratio) ────────────────────────────────────────

const FUZZY_MIN_LEN = 4
const FUZZY_THRESHOLD = 82   // ~same as Python FUZZY_THRESHOLD=82

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/** Returns 0–100 similarity ratio, equivalent to rapidfuzz.fuzz.ratio */
function ratio(a, b) {
  if (!a.length && !b.length) return 100
  const dist = levenshtein(a, b)
  return Math.round((1 - dist / Math.max(a.length, b.length)) * 100)
}

// ── In-memory custom names cache ──────────────────────────────────────────────

let _properMap = {}   // { asr_key_lower → display }
let _keyList   = []   // asr keys (lowercase)
let _nameList  = []   // display values (lowercase)
let _loaded    = false

/**
 * Build the in-memory name maps from raw { asr → display } object.
 * Skips entries whose ASR key is a stopword or shorter than 3 chars
 * (mirrors Python _build_proper_names).
 */
function buildMaps(raw) {
  const properMap = {}
  const keyList   = []
  const nameList  = []
  const seenDisplay = new Set()

  for (const [asr, display] of Object.entries(raw)) {
    const key = asr.toLowerCase()
    if (STOPWORDS.has(key) || key.length < 3) continue
    properMap[key] = display
    keyList.push(key)
    if (!seenDisplay.has(display.toLowerCase())) {
      seenDisplay.add(display.toLowerCase())
      nameList.push(display.toLowerCase())
    }
  }

  return { properMap, keyList, nameList }
}

/** Load custom names from MongoDB and rebuild maps. Called lazily + on demand. */
export async function reloadCustomNames() {
  try {
    const docs = await CustomName.find({}).lean()
    const raw  = Object.fromEntries(docs.map((d) => [d.asr, d.display]))
    const { properMap, keyList, nameList } = buildMaps(raw)
    _properMap = properMap
    _keyList   = keyList
    _nameList  = nameList
    _loaded    = true
    logger.info(`custom-names reloaded: ${_keyList.length} entries`)
  } catch (err) {
    logger.error(`reloadCustomNames failed: ${err.message}`)
  }
}

async function ensureLoaded() {
  if (!_loaded) await reloadCustomNames()
}

// ── Core correction function ──────────────────────────────────────────────────

/**
 * Apply custom vocabulary correction to a transcript string.
 * Exact match first, then fuzzy (Levenshtein) for alphabetic tokens
 * that are not stopwords and are long enough.
 *
 * @param {string} text  Raw ASR transcript text
 * @returns {string}     Corrected text
 */
export async function correctNames(text) {
  if (!text) return text

  await ensureLoaded()

  if (Object.keys(_properMap).length === 0) return text

  // Tokenise: words (with optional apostrophe) or any non-space char
  const tokens = [...text.matchAll(/\w+(?:'\w+)*|\S/g)].map((m) => m[0])
  const corrected = []

  for (const token of tokens) {
    const lower = token.toLowerCase()

    // 1. Exact match
    if (_properMap[lower] !== undefined) {
      corrected.push(_properMap[lower])
      continue
    }

    // 2. Fuzzy match — skip stopwords, non-alpha, and short tokens
    if (
      !STOPWORDS.has(lower) &&
      /^[a-z]+$/.test(lower) &&
      lower.length >= FUZZY_MIN_LEN &&
      _keyList.length > 0
    ) {
      let bestScore = 0
      let bestDisplay = null

      // Against ASR keys
      for (let i = 0; i < _keyList.length; i++) {
        const s = ratio(lower, _keyList[i])
        if (s >= FUZZY_THRESHOLD && s > bestScore) {
          bestScore   = s
          bestDisplay = _properMap[_keyList[i]]
        }
      }

      // Against display names (lowercased)
      if (_nameList.length > 0) {
        for (let i = 0; i < _nameList.length; i++) {
          const s = ratio(lower, _nameList[i])
          if (s >= FUZZY_THRESHOLD && s > bestScore) {
            bestScore   = s
            bestDisplay = _nameList[i]   // already lowercase display
          }
        }
      }

      if (bestDisplay !== null) {
        corrected.push(bestDisplay)
        continue
      }
    }

    corrected.push(token)
  }

  // Rebuild string: insert space between adjacent alphanumeric tokens
  let result = ''
  for (let i = 0; i < corrected.length; i++) {
    if (
      i > 0 &&
      /\w/.test(corrected[i][0]) &&
      /\w/.test(corrected[i - 1][corrected[i - 1].length - 1])
    ) {
      result += ' '
    }
    result += corrected[i]
  }
  return result
}
