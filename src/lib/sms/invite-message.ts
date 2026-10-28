const FILLER_SURNAMES = new Set(['ואשתו', 'ובעל', 'ובעלו', 'ומשפחת', 'המשפחה', 'ומשפחה'])

const TITLE_PREFIXES = [
  'בן דוד',
  'בת דוד',
  'דודה',
  'דוד',
  'סבא',
  'סבתא',
  'חמות',
  'חם',
  'אחות',
  'אח',
  'הגב',
  'גברת',
  'מר',
]

const INVITE_BASE_URL = 'https://david-and-morasha.duckdns.org/w/guests/save-the-date'

function stripNotes(value: string): string {
  return value
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTitle(value: string): string {
  let cleaned = stripNotes(value)
  for (const prefix of TITLE_PREFIXES) {
    if (cleaned === prefix) return ''
    if (cleaned.startsWith(`${prefix} `)) {
      cleaned = cleaned.slice(prefix.length).trim()
      break
    }
  }
  return cleaned
}

export function formatSmsRecipientName(firstName: string, lastName: string): string {
  const first = stripTitle(firstName)
  let last = stripTitle(lastName)

  if (last.startsWith('משפחת ')) last = last.slice('משפחת '.length).trim()
  if (FILLER_SURNAMES.has(last)) last = ''

  return [first, last].filter(Boolean).join(' ').trim() || stripNotes(firstName)
}

export function buildWeddingInviteSms({
  firstName,
  lastName,
  inviteCode,
}: {
  firstName: string
  lastName: string
  inviteCode: string | null
}): string | null {
  if (!inviteCode) return null
  const who = formatSmsRecipientName(firstName, lastName)

  return `${who}, שלום רב.
אנו שמחים להזמין אתכם לחתונה של דוד מנחם ומורשה בן הרוש, בתאריך י״ד כסלו (24.11.26) באולמי אגדתא. נשמח לאישור הגעה:
${INVITE_BASE_URL}/${inviteCode}

בברכה - יהודה ותמר מנחם`
}
