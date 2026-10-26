import type { Answer, RsvpFormResponse } from '~/app/utils/shared-types'

export interface AnswerWithType extends Answer {
  questionType: 'Text' | 'Option'
}

const getAnswerKey = (answer: Pick<Answer, 'questionId' | 'guestId' | 'householdId'>): string => {
  const audienceKey =
    answer.guestId != null ? `guest:${answer.guestId}` : `house:${answer.householdId ?? ''}`
  return `${answer.questionId}:${audienceKey}`
}

export const findExistingAnswer = (
  answers: AnswerWithType[],
  params: Pick<Answer, 'questionId' | 'guestId' | 'householdId'>
): AnswerWithType | undefined => {
  const key = getAnswerKey(params)
  return answers.find((answer) => getAnswerKey(answer) === key)
}

export const upsertAnswer = (
  answers: AnswerWithType[],
  incoming: AnswerWithType
): AnswerWithType[] => {
  const incomingKey = getAnswerKey(incoming)
  const hasExisting = answers.some((answer) => getAnswerKey(answer) === incomingKey)

  if (!hasExisting) return [...answers, incoming]

  return answers.map((answer) => (getAnswerKey(answer) === incomingKey ? incoming : answer))
}

export const removeAnswer = (
  answers: AnswerWithType[],
  params: Pick<Answer, 'questionId' | 'guestId' | 'householdId'>
): AnswerWithType[] => {
  const keyToRemove = getAnswerKey(params)
  return answers.filter((answer) => getAnswerKey(answer) !== keyToRemove)
}

/** Clamp a count to [min, max], tolerating a max below min by collapsing to min. */
export const clampCount = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), Math.max(max, min))
}

/** The most guests any household may ever report attending, regardless of the imported invited count. */
export const MAX_ATTENDING = 20

/**
 * The most guests a household can report attending: always `MAX_ATTENDING`,
 * independent of the couple's imported `invitedCount` figure.
 */
export const getMaxAttendingBound = (
  _invitedCount: number | null | undefined,
  _namedGuestCount: number
): number => {
  return MAX_ATTENDING
}

/**
 * The "additional, unnamed guests" stepper is available whenever the
 * household's current total is still below the hard cap of `MAX_ATTENDING`.
 */
export const canUseExtraGuests = (
  invitedCount: number | null | undefined,
  namedGuestCount: number
): boolean => {
  return namedGuestCount < MAX_ATTENDING
}

/**
 * Whether a guest should default to "attending" on the who-is-coming step.
 * This session's local edits (already in `rsvpResponses`) take priority over
 * the guest's persisted invitation status, so a returning guest sees their
 * last answer rather than always resetting to attending.
 */
export const isGuestAttendingByDefault = (
  guestId: number,
  guestInvitations: Array<{ eventId: string; rsvp: string }>,
  localResponses: RsvpFormResponse[]
): boolean => {
  const localForGuest = guestInvitations
    .map((invite) =>
      localResponses.find(
        (response) => response.guestId === guestId && response.eventId === invite.eventId
      )
    )
    .filter((response): response is RsvpFormResponse => response !== undefined)

  if (localForGuest.length > 0) {
    return localForGuest.some((response) => response.rsvp === 'Attending')
  }

  if (guestInvitations.length > 0) {
    return guestInvitations.some((invite) => invite.rsvp === 'Attending')
  }

  return true
}

/**
 * The named guests pre-selected as attending when the who-is-coming step
 * first renders. A household that has never answered must open with at
 * least one attendee, so when the usual per-guest defaults select nobody
 * (e.g. every invitation is still "Invited", not "Attending"), the primary
 * contact — or the first named guest when none is flagged primary — is
 * pre-selected instead.
 */
export const getInitialAttendingGuestIds = (
  namedGuests: Array<{
    id: number
    isPrimaryContact: boolean
    invitations: Array<{ eventId: string; rsvp: string }>
  }>,
  localResponses: RsvpFormResponse[],
  hasAnsweredBefore: boolean
): Set<number> => {
  const defaultIds = new Set(
    namedGuests
      .filter((guest) => isGuestAttendingByDefault(guest.id, guest.invitations, localResponses))
      .map((guest) => guest.id)
  )

  if (!hasAnsweredBefore && defaultIds.size === 0) {
    const fallbackGuest = namedGuests.find((guest) => guest.isPrimaryContact) ?? namedGuests[0]
    if (fallbackGuest) defaultIds.add(fallbackGuest.id)
  }

  return defaultIds
}

/**
 * The "additional, unnamed guests" count when the who-is-coming step first
 * renders. A saved total of 0 is treated as "not answered" — a household
 * never opens the step at a total of 0.
 */
export const getInitialExtraGuests = (
  hasAnsweredBefore: boolean,
  savedTotal: number | null | undefined,
  namedAttendingCount: number,
  maxExtras: number
): number => {
  if (hasAnsweredBefore) return clampCount((savedTotal ?? 0) - namedAttendingCount, 0, maxExtras)
  return namedAttendingCount > 0 ? 0 : clampCount(1, 0, maxExtras)
}

export interface ExtraGuestRow {
  id: string
  name: string
}

/**
 * Whether another named "extra guest" row can be added on the who-is-coming
 * step without the household's total (named guests + named extra rows +
 * unnamed stepper extras) exceeding `maxTotal`.
 */
export const canAddExtraGuestRow = (
  namedAttendingCount: number,
  extraRowCount: number,
  stepperExtraCount: number,
  maxTotal: number
): boolean => namedAttendingCount + extraRowCount + stepperExtraCount < maxTotal

/**
 * The non-empty, trimmed names from the extra-guest rows. Only these become
 * persisted tag-along Guest rows on submit — a row added but left blank
 * reserves a slot in the UI but isn't counted as an attendee.
 */
export const getFilledExtraGuestNames = (rows: ExtraGuestRow[]): string[] =>
  rows.map((row) => row.name.trim()).filter((name) => name.length > 0)

const getRsvpKey = (response: Pick<RsvpFormResponse, 'eventId' | 'guestId'>): string => {
  return `${response.eventId}:${response.guestId}`
}

export const upsertRsvpResponses = (
  existing: RsvpFormResponse[],
  incoming: RsvpFormResponse[]
): RsvpFormResponse[] => {
  if (incoming.length === 0) return existing

  const incomingByKey = new Map(incoming.map((response) => [getRsvpKey(response), response]))
  const mergedExisting = existing.map((response) => {
    const replacement = incomingByKey.get(getRsvpKey(response))
    return replacement ?? response
  })

  const existingKeys = new Set(existing.map((response) => getRsvpKey(response)))
  const newItems = incoming.filter((response) => !existingKeys.has(getRsvpKey(response)))

  return [...mergedExisting, ...newItems]
}
