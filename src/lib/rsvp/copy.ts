import heMessages from '~/i18n/messages/he.json'

export const RSVP_COPY_GROUPS = [
  {
    id: 'who-is-coming',
    label: 'מי מגיע',
    fields: [
      ['weddingTitle', 'כותרת החתונה'],
      ['groupNote', 'הנחיית חיפוש הזמנה'],
      ['fullNamePlaceholder', 'מציין מקום לשם מלא'],
      ['findInvitation', 'כפתור מציאת הזמנה'],
      ['foundInGuestList', 'אישור זיהוי ברשימה'],
      ['foundInGuestListDecline', 'אישור זיהוי לפני סירוב'],
      ['groupNoteDecline', 'הנחיית חיפוש לפני סירוב'],
      ['recognizedInvitation', 'הזמנה שזוהתה'],
      ['searchAgain', 'חיפוש מחדש'],
      ['notYou', 'זה לא אני'],
      ['accept', 'אישור הגעה'],
      ['accepted', 'הגעה אושרה'],
      ['whoIsComingTitle', 'כותרת מי מגיע'],
      ['totalAttendingLabel', 'סך הכול מגיעים'],
      ['extraGuestsLabel', 'אורחים נוספים'],
      ['maxGuestsHint', 'מגבלת מספר אורחים'],
      ['addExtraGuestButton', 'הוספת אורח'],
      ['extraGuestNameLabel', 'תווית שם אורח נוסף'],
      ['extraGuestNamePlaceholder', 'מציין מקום לשם אורח נוסף'],
    ],
  },
  {
    id: 'children-count',
    label: 'מספר ילדים',
    fields: [
      ['childrenCountTitle', 'כותרת'],
      ['childrenCountHelper', 'טקסט עזר'],
    ],
  },
  {
    id: 'dietary-notes',
    label: 'הערות תזונתיות',
    fields: [
      ['dietaryNotesTitle', 'כותרת'],
      ['dietaryNotesHelper', 'טקסט עזר'],
    ],
  },
  {
    id: 'wishes-message',
    label: 'ברכה לזוג',
    fields: [
      ['wishesMessageTitle', 'כותרת'],
      ['wishesMessageHelper', 'טקסט עזר'],
      ['wishesMessagePlaceholder', 'מציין מקום'],
    ],
  },
  {
    id: 'send-summary',
    label: 'שליחה וסיכום',
    fields: [
      ['summaryTitle', 'כותרת הסיכום'],
      ['summaryEdit', 'פעולת עריכה'],
      ['summaryAttending', 'סיכום מספר אורחים'],
      ['summaryAttendingOne', 'סיכום אורח יחיד'],
      ['summaryChildren', 'סיכום מספר ילדים'],
      ['summaryDietary', 'סיכום הערות תזונה'],
      ['summaryChuppahOnly', 'סיכום חופה בלבד'],
      ['sendRsvp', 'כפתור שליחה'],
      ['sendingRsvp', 'מצב שליחה'],
    ],
  },
  {
    id: 'confirmation',
    label: 'אישור וסיום',
    fields: [
      ['confirmationThanksFamily', 'תודה למשפחה'],
      ['confirmationThanksName', 'תודה לאורח'],
      ['confirmationThanksFallback', 'תודה כללית'],
      ['confirmationDeclinedThanks', 'תודה לאחר סירוב'],
      ['confirmationCount', 'סיכום אישור הגעה'],
      ['confirmationCountWithChildren', 'סיכום הגעה עם ילדים'],
      ['confirmationReception', 'תווית קבלת פנים'],
      ['confirmationChuppah', 'תווית חופה'],
      ['backToHomepage', 'חזרה לעמוד הבית'],
      ['addToAppleCalendar', 'הוספה ליומן אפל'],
      ['addGoogleCalendar', 'הוספה ליומן גוגל'],
      ['navigateToVenue', 'ניווט לאולם'],
    ],
  },
  {
    id: 'decline',
    label: 'סירוב הגעה',
    fields: [
      ['decline', 'כפתור סירוב'],
      ['declined', 'מצב סירוב'],
      ['declineConfirmTitle', 'כותרת אישור סירוב'],
      ['declineConfirmBody', 'הסבר אישור סירוב'],
      ['declineConfirmButton', 'כפתור אישור סירוב'],
    ],
  },
  {
    id: 'errors',
    label: 'שגיאות',
    fields: [['notFound', 'הזמנה לא נמצאה']],
  },
] as const

export type RsvpCopyKey = (typeof RSVP_COPY_GROUPS)[number]['fields'][number][0]
export type RsvpCopyOverrides = Partial<Record<RsvpCopyKey, string>>

export const RSVP_COPY_KEYS = RSVP_COPY_GROUPS.flatMap((group) =>
  group.fields.map(([key]) => key)
) as RsvpCopyKey[]

const RSVP_COPY_KEY_SET = new Set<string>(RSVP_COPY_KEYS)

export function isRsvpCopyKey(key: string): key is RsvpCopyKey {
  return RSVP_COPY_KEY_SET.has(key)
}

export function getDefaultRsvpCopy(key: RsvpCopyKey): string {
  return heMessages.rsvp[key]
}

export function normalizeRsvpCopy(input: Record<string, string>): RsvpCopyOverrides {
  const normalized: RsvpCopyOverrides = {}
  for (const [key, rawValue] of Object.entries(input)) {
    if (!isRsvpCopyKey(key)) continue
    const value = rawValue.trim()
    if (value && value !== getDefaultRsvpCopy(key)) normalized[key] = value
  }
  return normalized
}

export function readRsvpCopy(input: unknown): RsvpCopyOverrides {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const strings = Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
  return normalizeRsvpCopy(strings)
}
