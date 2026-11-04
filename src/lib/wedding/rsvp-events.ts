/** Minimal event shape needed to tell the wedding and chuppah apart. */
export type RsvpEventInput = {
  id: string
  name: string
  isPrimary?: boolean
  /** Only RSVP-able events are candidates; `false` events are ignored. */
  collectRsvp?: boolean
}

export type RsvpEventRef = {
  id: string
  name: string
}

const CHUPPAH_NAME_PATTERN = /חופה|ceremony/i

/** True when an event's name marks it as the chuppah/ceremony rather than the meal. */
export const isChuppahEventName = (name: string | null | undefined): boolean =>
  CHUPPAH_NAME_PATTERN.test(name ?? '')

/**
 * Resolve the wedding's two RSVP-able events from the wedding's event list:
 * the chuppah/ceremony (the event whose name matches "חופה"/"ceremony",
 * case-insensitive) and the wedding itself (the remaining RSVP-able event —
 * the reception/celebration). Events with `collectRsvp: false` are never
 * candidates. When only one RSVP-able event exists, it is always the
 * `weddingEvent` (never null) and there is no chuppah.
 */
export function resolveRsvpEvents(events: RsvpEventInput[]): {
  weddingEvent: RsvpEventRef | null
  chuppahEvent: RsvpEventRef | null
} {
  const rsvpable = events.filter((event) => event.collectRsvp !== false)

  if (rsvpable.length === 0) return { weddingEvent: null, chuppahEvent: null }

  if (rsvpable.length === 1) {
    return { weddingEvent: rsvpable[0] ?? null, chuppahEvent: null }
  }

  const chuppahEvent = rsvpable.find((event) => CHUPPAH_NAME_PATTERN.test(event.name)) ?? null
  const weddingEvent =
    chuppahEvent !== null
      ? rsvpable.find((event) => event !== chuppahEvent) ?? null
      : rsvpable.find((event) => event.isPrimary) ?? rsvpable[0] ?? null

  return { weddingEvent, chuppahEvent }
}

/**
 * True when the guest is answering for the chuppah alone: exactly one
 * RSVP-able event is in play (either it is the only one, or `preselectedEventId`
 * narrows the flow to it) and that event is the ceremony. The form uses this to
 * drop the children and dietary steps, which only make sense for the meal.
 */
export function isChuppahOnlySelection(
  events: RsvpEventInput[],
  preselectedEventId: string | null | undefined
): boolean {
  const relevant = events.filter(
    (event) => event.collectRsvp !== false && (!preselectedEventId || event.id === preselectedEventId)
  )
  return relevant.length === 1 && isChuppahEventName(relevant[0]?.name)
}

/** Minimal guest shape needed to tally RSVP responses per event. */
type RsvpCountGuest = {
  invitations: Array<{ eventId: string; rsvp: string }>
}

export type HouseholdWeddingRsvpCounts = {
  attending: number
  invited: number
  declined: number
}

/**
 * Tallies a household's guests by their RSVP to the wedding event only, once
 * per guest - the chuppah (or any other secondary event) contributes nothing.
 * A guest without an invitation to `weddingEventId` is skipped, and an
 * unresolved `weddingEventId` (e.g. no RSVP-able events configured) yields
 * all zeros rather than guessing from other events.
 */
export function getHouseholdWeddingRsvpCounts(
  guests: RsvpCountGuest[],
  weddingEventId: string | null
): HouseholdWeddingRsvpCounts {
  const counts: HouseholdWeddingRsvpCounts = { attending: 0, invited: 0, declined: 0 }
  if (weddingEventId === null) return counts

  for (const guest of guests) {
    const invitation = guest.invitations.find((invitation) => invitation.eventId === weddingEventId)
    if (!invitation) continue

    if (invitation.rsvp === 'Attending') counts.attending += 1
    else if (invitation.rsvp === 'Invited') counts.invited += 1
    else if (invitation.rsvp === 'Declined') counts.declined += 1
  }

  return counts
}

type HouseholdEventStatus = 'Attending' | 'Declined' | 'Unanswered'

const EVENT_STATUS_LABEL: Record<'Attending' | 'Declined', string> = {
  Attending: 'מגיע',
  Declined: 'לא מגיע',
}

/** "ל" + an event name, dropping the event name's own "ה" so "ל" + "החופה" reads "לחופה". */
const withLePrefix = (name: string): string => `ל${name.startsWith('ה') ? name.slice(1) : name}`

/** Minimal guest shape needed to resolve a household's per-event RSVP answer. */
type PartialAnswerGuest = { invitations: Array<{ eventId: string; rsvp: string }> }

/**
 * A household's answer to one event: "Attending"/"Declined" once any guest
 * of the household has answered it, "Unanswered" when every guest is still
 * "Invited" (or has no invitation to it at all) - "Invited" alone is never
 * an answer.
 */
function getHouseholdEventStatus(guests: PartialAnswerGuest[], eventId: string): HouseholdEventStatus {
  let declined = false
  for (const guest of guests) {
    const invitation = guest.invitations.find((invitation) => invitation.eventId === eventId)
    if (!invitation) continue
    if (invitation.rsvp === 'Attending') return 'Attending'
    if (invitation.rsvp === 'Declined') declined = true
  }
  return declined ? 'Declined' : 'Unanswered'
}

/**
 * The owner's decision (04.11.2026): a household whose answers differ across
 * the wedding's two RSVP-able events - one confirmed while the other hasn't
 * answered, or the two answered differently - gets a disambiguating line
 * under its name, e.g. "מגיע לחופה · החתונה טרם השיבה". Agreeing answers
 * (including no answers at all, or fewer than two RSVP-able events) return
 * null, leaving today's badges as the only signal.
 */
export function getPartialEventAnswerLine(
  guests: PartialAnswerGuest[],
  events: RsvpEventInput[]
): string | null {
  const { weddingEvent, chuppahEvent } = resolveRsvpEvents(events)
  if (weddingEvent === null || chuppahEvent === null) return null

  const chuppahStatus = getHouseholdEventStatus(guests, chuppahEvent.id)
  const weddingStatus = getHouseholdEventStatus(guests, weddingEvent.id)
  if (chuppahStatus === weddingStatus) return null

  const describe = (event: RsvpEventRef, status: HouseholdEventStatus): string =>
    status === 'Unanswered' ? `${event.name} טרם השיבה` : `${EVENT_STATUS_LABEL[status]} ${withLePrefix(event.name)}`

  return `${describe(chuppahEvent, chuppahStatus)} · ${describe(weddingEvent, weddingStatus)}`
}
