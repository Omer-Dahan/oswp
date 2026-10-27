/** Minimal event shape needed to tell the wedding and chuppah apart. */
type RsvpEventInput = {
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
      ? rsvpable.find((event) => event.id !== chuppahEvent.id) ?? null
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
