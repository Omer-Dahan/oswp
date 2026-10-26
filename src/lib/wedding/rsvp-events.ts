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

/**
 * Resolve the wedding's two RSVP-able events from the wedding's event list:
 * the chuppah/ceremony (the event whose name matches "חופה"/"ceremony",
 * case-insensitive) and the wedding itself (the remaining RSVP-able event —
 * the reception/celebration). Events with `collectRsvp: false` are never
 * candidates. When only one RSVP-able event exists, there is no chuppah.
 */
export function resolveRsvpEvents(events: RsvpEventInput[]): {
  weddingEvent: RsvpEventRef | null
  chuppahEvent: RsvpEventRef | null
} {
  const rsvpable = events.filter((event) => event.collectRsvp !== false)

  if (rsvpable.length === 0) return { weddingEvent: null, chuppahEvent: null }

  const chuppahEvent = rsvpable.find((event) => CHUPPAH_NAME_PATTERN.test(event.name)) ?? null
  const weddingEvent =
    chuppahEvent !== null
      ? rsvpable.find((event) => event.id !== chuppahEvent.id) ?? null
      : rsvpable.find((event) => event.isPrimary) ?? rsvpable[0] ?? null

  return { weddingEvent, chuppahEvent }
}
