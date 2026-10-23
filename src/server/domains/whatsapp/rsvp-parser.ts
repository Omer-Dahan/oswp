/**
 * WhatsApp Domain - RSVP Intent Parser
 *
 * Pure, deterministic, Hebrew-first parsing of a free-text WhatsApp reply
 * into an RSVP intent. No DB access here - the webhook service decides what
 * to do with the result.
 */

export type RsvpIntent = 'attending' | 'declined' | 'unknown'
export type RsvpConfidence = 'high' | 'low'

export type ParsedRsvpReply = {
  intent: RsvpIntent
  headcount: number | null
  confidence: RsvpConfidence
}

const ATTENDING_WORDS = ['כן', 'מגיע', 'מגיעים', 'נגיע', 'מאשר', 'yes', 'confirm']
const ATTENDING_PHRASES = ['אני בא', 'אנחנו באים']

const DECLINED_WORDS = ['לא', 'no', 'decline']
const DECLINED_PHRASES = ['לא מגיע', 'לא נוכל', 'לא באים', 'לצערי לא', 'לא נגיע']

const HEBREW_NUMBER_WORDS: Record<string, number> = {
  אחד: 1,
  אחת: 1,
  שניים: 2,
  שתיים: 2,
  שלושה: 3,
  ארבעה: 4,
  חמישה: 5,
}

// Hebrew letters and Latin letters/digits as separate word tokens, so
// "לא" never matches as a substring inside a longer word like "שלא".
const WORD_RE = /[א-ת]+|[a-zA-Z]+|\d+/g

const extractTokens = (text: string): string[] => (text.match(WORD_RE) ?? []).map((w) => w.toLowerCase())

const hasPhrase = (tokens: string[], phrase: string): boolean => {
  const words = phrase.toLowerCase().split(' ')
  if (words.length === 1) return tokens.includes(words[0] ?? '')
  for (let i = 0; i + words.length <= tokens.length; i++) {
    if (words.every((word, offset) => tokens[i + offset] === word)) return true
  }
  return false
}

const matchesAny = (tokens: string[], phrases: string[]): boolean =>
  phrases.some((phrase) => hasPhrase(tokens, phrase))

export function parseRsvpReply(text: string | null): ParsedRsvpReply {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return { intent: 'unknown', headcount: null, confidence: 'low' }

  const tokens = extractTokens(trimmed)
  const attending = matchesAny(tokens, ATTENDING_WORDS) || matchesAny(tokens, ATTENDING_PHRASES)
  const declined = matchesAny(tokens, DECLINED_WORDS) || matchesAny(tokens, DECLINED_PHRASES)

  let intent: RsvpIntent = 'unknown'
  let confidence: RsvpConfidence = 'low'

  if (attending && declined) {
    // Negation wins: an explicit declined phrase (e.g. "לא מגיע") always
    // contains the bare attending word ("מגיע"), so the two sides collide
    // by construction. Trust the phrase, but flag low confidence so the
    // review screen can double-check it.
    if (matchesAny(tokens, DECLINED_PHRASES)) {
      intent = 'declined'
      confidence = 'low'
    }
  } else if (declined) {
    intent = 'declined'
    confidence = 'high'
  } else if (attending) {
    intent = 'attending'
    confidence = 'high'
  }

  let headcount: number | null = null
  if (intent === 'attending') {
    const numericToken = tokens.find((token) => /^\d+$/.test(token))
    if (numericToken) {
      const value = Number(numericToken)
      if (value >= 1 && value <= 20) headcount = value
    } else {
      const wordMatch = tokens.find((token) => token in HEBREW_NUMBER_WORDS)
      if (wordMatch) headcount = HEBREW_NUMBER_WORDS[wordMatch] ?? null
    }
  }

  return { intent, headcount, confidence }
}
