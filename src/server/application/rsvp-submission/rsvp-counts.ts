type RsvpCountResponse = {
  guestId: number
  rsvp: string
}

type DeriveRsvpCountsInput = {
  responses: RsvpCountResponse[]
  attendingCount?: number | null
  childrenCount?: number | null
  extraGuestNames?: string[]
}

export type PersistedRsvpCounts = {
  attendingCount: number | null
  childrenCount: number | null
  namedAttendeeIds: number[]
}

export function deriveRsvpCounts({
  responses,
  attendingCount,
  childrenCount,
  extraGuestNames = [],
}: DeriveRsvpCountsInput): PersistedRsvpCounts {
  const namedAttendeeIds = Array.from(
    new Set(
      responses
        .filter((response) => response.rsvp === 'Attending')
        .map((response) => response.guestId)
    )
  )
  const hasAttendees =
    namedAttendeeIds.length > 0 || extraGuestNames.length > 0 || (attendingCount ?? 0) > 0

  if (!hasAttendees) {
    return { attendingCount: null, childrenCount: null, namedAttendeeIds }
  }

  return {
    attendingCount: attendingCount ?? Math.max(1, namedAttendeeIds.length),
    childrenCount: childrenCount ?? 0,
    namedAttendeeIds,
  }
}
