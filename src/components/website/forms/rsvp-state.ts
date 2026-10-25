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
