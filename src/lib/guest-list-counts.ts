import { getHouseholdPartySize } from '~/lib/household-party-size'

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
}

const clamp = (value: number, maximum: number) => Math.max(0, Math.min(value, maximum))

export function deriveGuestListCounts(
  households: CountableHousehold[],
  eventId?: string
): GuestListCounts {
  return households.reduce<GuestListCounts>(
    (counts, household) => {
      const partySize = getHouseholdPartySize(household) ?? 0
      counts.guests += partySize
      counts.households += 1

      if (!eventId || partySize === 0) return counts

      const responses = household.guests
        .flatMap((guest) => guest.invitations ?? [])
        .filter((invitation) => invitation.eventId === eventId)
      const namedAttending = responses.filter(
        (invitation) => invitation.rsvp === 'Attending'
      ).length
      const namedDeclined = responses.filter((invitation) => invitation.rsvp === 'Declined').length

      const attending = clamp(household.attendingCount ?? namedAttending, partySize)
      const remainingAfterAttending = partySize - attending
      const declined =
        household.attendingCount === 0 && namedDeclined > 0
          ? remainingAfterAttending
          : clamp(namedDeclined, remainingAfterAttending)

      counts.attending += attending
      counts.declined += declined
      counts.noResponse += partySize - attending - declined
      return counts
    },
    { guests: 0, households: 0, attending: 0, declined: 0, noResponse: 0 }
  )
}
