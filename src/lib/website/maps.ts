/**
 * Venue navigation helpers — Waze/Google Maps links and the "depart by" label.
 *
 * Pure functions only: no React, no Prisma. `resolveWazeUrl` is the single
 * gate a stored Waze link must pass before it's ever rendered to a guest.
 */

type EventLike = {
  venue: string | null
  venueAddress: string | null
  venueWazeUrl: string | null
}

export function buildWazeUrl(query: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`
}

export function buildGoogleMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** The best available free-text venue location, or `null` when neither is set. */
export function venueQuery(event: EventLike): string | null {
  const address = event.venueAddress?.trim()
  if (address) return address
  const venue = event.venue?.trim()
  return venue || null
}

/** A stored Waze link is only usable if it's an actual `https://waze.com/ul/...` share link. */
export function isValidStoredWazeUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    (url.hostname === 'waze.com' || url.hostname === 'www.waze.com') &&
    url.pathname.startsWith('/ul/')
  )
}

/**
 * The venue's Waze link: the couple's own stored share link when it's a valid
 * `waze.com/ul/...` link, otherwise a link built from the venue address/name,
 * otherwise `null` when there's nothing to navigate to.
 */
export function resolveWazeUrl(event: EventLike): string | null {
  if (event.venueWazeUrl && isValidStoredWazeUrl(event.venueWazeUrl)) {
    return event.venueWazeUrl
  }
  const query = venueQuery(event)
  return query ? buildWazeUrl(query) : null
}

/** Hebrew "leave by" label, e.g. `צאו לדרך עד 17:30` for an 18:00 start, or `null` without a start time. */
export function departByLabel(startTime: string | null | undefined, minutesBefore = 30): string | null {
  if (!startTime) return null
  const match = startTime.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const totalMinutes = (hours * 60 + minutes - minutesBefore + 24 * 60) % (24 * 60)
  const departHours = Math.floor(totalMinutes / 60)
  const departMinutes = totalMinutes % 60

  const label = `${String(departHours).padStart(2, '0')}:${String(departMinutes).padStart(2, '0')}`
  return `צאו לדרך עד ${label}`
}
