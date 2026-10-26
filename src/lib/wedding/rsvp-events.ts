/** Minimal event shape needed to tell the wedding and chuppah apart. */
type RsvpEventInput = {
  id: string
  name: string
  isPrimary?: boolean
}

export type RsvpEventRef = {
  id: string
  name: string
}

const CHUPPAH_NAME_PATTERN = /חופה|ceremony/i

/**
 * Resolve the wedding's two RSVP-able events from the wedding's full event
 * list: the wedding itself (the `isPrimary` event, falling back to the first
 * event when none is flagged) and the chuppah/ceremony (the remaining event
 * whose name matches "חופה"/"ceremony", case-insensitive). When there's only
 * one event, there is no chuppah to resolve.
 */
export function resolveRsvpEvents(events: RsvpEventInput[]): {
  weddingEvent: RsvpEventRef | null
  chuppahEvent: RsvpEventRef | null
} {
  if (events.length === 0) return { weddingEvent: null, chuppahEvent: null }

  const weddingEvent = events.find((event) => event.isPrimary) ?? events[0]
  if (!weddingEvent || events.length === 1) {
    return { weddingEvent: weddingEvent ?? null, chuppahEvent: null }
  }

  const chuppahEvent =
    events.find((event) => event.id !== weddingEvent.id && CHUPPAH_NAME_PATTERN.test(event.name)) ??
    null

  return { weddingEvent, chuppahEvent }
}
