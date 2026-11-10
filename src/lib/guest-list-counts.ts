import { getHouseholdPartySize } from '~/lib/household-party-size'
import { getHouseholdEventStatus, resolveRsvpEvents, type RsvpEventInput } from '~/lib/wedding/rsvp-events'

type CountableInvitation = {
  eventId: string
  rsvp: string
}

type CountableGuest = {
  invitations?: CountableInvitation[] | null
}

export type CountableHousehold = {
  invitedCount: number | null
  attendingCount: number | null
  guests: CountableGuest[]
}

export type GuestListCounts = {
  guests: number
  households: number
  attending: number
  declined: number
  noResponse: number
  pendingHouseholds: number
  pendingGuests: number
}

const clamp = (value: number, maximum: number) => Math.max(0, Math.min(value, maximum))

/**
 * `eventId` scopes the tally to one event. With no `eventId` (the "all
 * events" tab), the tally resolves the wedding's own RSVP-able event via
 * `events` and scopes to that - the same event the guest card names - rather
 * than the loose "answered any event" count this used to show, which never
 * matched what the cards displayed. An unresolved event (no `events` given,
 * or no RSVP-able event configured) counts every household as having no
 * response, rather than guessing from unrelated events.
 */
export function deriveGuestListCounts(
  households: CountableHousehold[],
  eventId?: string,
  events: RsvpEventInput[] = []
): GuestListCounts {
  const scopedEventId = eventId ?? resolveRsvpEvents(events).weddingEvent?.id ?? null

  return households.reduce<GuestListCounts>(
    (counts, household) => {
      const partySize = getHouseholdPartySize(household) ?? 0
      counts.guests += partySize
      counts.households += 1

      if (partySize === 0) return counts

      const guestsForStatus = household.guests.map((guest) => ({
        invitations: guest.invitations ?? [],
      }))
      const status =
        scopedEventId === null ? 'Unanswered' : getHouseholdEventStatus(guestsForStatus, scopedEventId)

      if (status === 'Unanswered') {
        counts.pendingHouseholds += 1
        counts.pendingGuests += partySize
      }

      if (scopedEventId === null) {
        counts.noResponse += partySize
        return counts
      }

      const responses = household.guests
        .flatMap((guest) => guest.invitations ?? [])
        .filter((invitation) => invitation.eventId === scopedEventId)
      const namedAttending = responses.filter((invitation) => invitation.rsvp === 'Attending').length
      const namedDeclined = responses.filter((invitation) => invitation.rsvp === 'Declined').length

      // A household that declined this event contributes nothing to
      // attending regardless of a stale household-wide attendingCount (e.g.
      // a chuppah-only household, derived-declined for the wedding) - the
      // stored count only wins while the household hasn't declined.
      const attending =
        status === 'Declined' ? 0 : clamp(household.attendingCount ?? namedAttending, partySize)
      const remainingAfterAttending = partySize - attending
      const declined =
        status === 'Declined'
          ? remainingAfterAttending
          : household.attendingCount === 0 && namedDeclined > 0
            ? remainingAfterAttending
            : clamp(namedDeclined, remainingAfterAttending)

      counts.attending += attending
      counts.declined += declined
      counts.noResponse += partySize - attending - declined
      return counts
    },
    {
      guests: 0,
      households: 0,
      attending: 0,
      declined: 0,
      noResponse: 0,
      pendingHouseholds: 0,
      pendingGuests: 0,
    }
  )
}
