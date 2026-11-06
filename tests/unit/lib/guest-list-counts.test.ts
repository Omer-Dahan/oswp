import { type CountableHousehold, deriveGuestListCounts } from '~/lib/guest-list-counts'

const household = (
  invitedCount: number | null,
  attendingCount: number | null,
  responses: string[]
): CountableHousehold => ({
  invitedCount,
  attendingCount,
  guests: responses.map((rsvp) => ({ invitations: [{ eventId: 'wedding', rsvp }] })),
})

describe('deriveGuestListCounts', () => {
  it('uses the household reported attendee count as people while counting one household', () => {
    const counts = deriveGuestListCounts([household(3, 3, ['Attending'])], 'wedding')

    expect(counts).toEqual({
      guests: 3,
      households: 1,
      attending: 3,
      declined: 0,
      noResponse: 0,
      pendingHouseholds: 0,
      pendingGuests: 0,
    })
  })

  it('keeps no response as the exact complement of attending and declined guests', () => {
    const ownerFixture = [
      household(51, 51, ['Attending']),
      household(13, 0, ['Declined']),
      household(100, null, ['Invited']),
    ]

    expect(deriveGuestListCounts(ownerFixture, 'wedding')).toEqual({
      guests: 164,
      households: 3,
      attending: 51,
      declined: 13,
      noResponse: 100,
      pendingHouseholds: 1,
      pendingGuests: 100,
    })
  })

  it('counts confirmed guests above the imported invited count without breaking the pill sum', () => {
    expect(deriveGuestListCounts([household(1, 4, ['Attending'])], 'wedding')).toEqual({
      guests: 4,
      households: 1,
      attending: 4,
      declined: 0,
      noResponse: 0,
      pendingHouseholds: 0,
      pendingGuests: 0,
    })
  })

  it('uses a confirmed count when the sheet has no invited count', () => {
    expect(deriveGuestListCounts([household(null, 2, ['Attending'])], 'wedding')).toEqual({
      guests: 2,
      households: 1,
      attending: 2,
      declined: 0,
      noResponse: 0,
      pendingHouseholds: 0,
      pendingGuests: 0,
    })
  })

  it('counts each guest with an answer on any event when no event is selected', () => {
    const answeredAcrossEvents: CountableHousehold = {
      invitedCount: 3,
      attendingCount: 3,
      guests: [
        { invitations: [{ eventId: 'chuppah', rsvp: 'Attending' }] },
        { invitations: [{ eventId: 'wedding', rsvp: 'Invited' }] },
        { invitations: [{ eventId: 'wedding', rsvp: 'Declined' }] },
      ],
    }

    expect(deriveGuestListCounts([answeredAcrossEvents])).toEqual({
      guests: 3,
      households: 1,
      attending: 1,
      declined: 1,
      noResponse: 1,
      pendingHouseholds: 0,
      pendingGuests: 0,
    })
  })

  it('does not count a partially answered household as pending', () => {
    const counts = deriveGuestListCounts(
      [household(4, 2, ['Attending', 'Attending'])],
      'wedding'
    )

    expect(counts).toEqual({
      guests: 4,
      households: 1,
      attending: 2,
      declined: 0,
      noResponse: 2,
      pendingHouseholds: 0,
      pendingGuests: 0,
    })
  })

  it('counts a household with no invitations at all as pending', () => {
    const silentHousehold: CountableHousehold = {
      invitedCount: 3,
      attendingCount: null,
      guests: [],
    }

    expect(deriveGuestListCounts([silentHousehold], 'wedding')).toEqual({
      guests: 3,
      households: 1,
      attending: 0,
      declined: 0,
      noResponse: 3,
      pendingHouseholds: 1,
      pendingGuests: 3,
    })
  })

  it('counts only the silent household as pending next to a declined one', () => {
    const silentHousehold: CountableHousehold = {
      invitedCount: 2,
      attendingCount: null,
      guests: [],
    }
    const declinedHousehold = household(1, 0, ['Declined'])

    expect(deriveGuestListCounts([silentHousehold, declinedHousehold], 'wedding')).toEqual({
      guests: 3,
      households: 2,
      attending: 0,
      declined: 1,
      noResponse: 2,
      pendingHouseholds: 1,
      pendingGuests: 2,
    })
  })
})
