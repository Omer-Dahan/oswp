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

const ATTENDING_WORDS = ['כן', 'מגיע', 'מגיעים', 'מגיעה', 'נגיע', 'נבוא', 'באים', 'אגיע', 'מאשר', 'yes', 'confirm']
const ATTENDING_PHRASES = ['אני בא', 'אנחנו באים']

// "לא" alone (or with minimal filler) is a clear decline, but trusting the
// bare word anywhere in a longer message misreads hedging replies like "עוד
// לא יודעים" as a firm no. It's only treated as a decline by itself; inside a
// longer message, only an explicit decline phrase counts.
const DECLINED_WORD = 'לא'
const OTHER_DECLINED_WORDS = ['no', 'decline']
const DECLINED_PHRASES = [
  'לא מגיע',
  'לא מגיעים',
  'לא נוכל',
  'לא באים',
  'לא נבוא',
  'לצערי לא',
  'לא נגיע',
]

// Hedging replies that must never be auto-applied even though they contain
// "לא" — the guest hasn't actually decided yet.
const UNDECIDED_PHRASES = ['עוד לא', 'לא יודע', 'לא בטוח', 'לא החלטנו']

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

  if (matchesAny(tokens, UNDECIDED_PHRASES)) {
    return { intent: 'unknown', headcount: null, confidence: 'low' }
  }

  const attending = matchesAny(tokens, ATTENDING_WORDS) || matchesAny(tokens, ATTENDING_PHRASES)
  const declinedPhrase = matchesAny(tokens, DECLINED_PHRASES)
  const declinedOtherWord = matchesAny(tokens, OTHER_DECLINED_WORDS)
  const bareDeclinedWord = tokens.length <= 2 && tokens.includes(DECLINED_WORD)
  const declined = declinedPhrase || declinedOtherWord || bareDeclinedWord

  let intent: RsvpIntent = 'unknown'
  let confidence: RsvpConfidence = 'low'

  if (attending && declined) {
    // Negation wins: an explicit declined phrase (e.g. "לא מגיע") always
    // contains the bare attending word ("מגיע"), so the two sides collide
    // by construction. Trust the phrase, but flag low confidence so the
    // review screen can double-check it.
    if (declinedPhrase) {
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
