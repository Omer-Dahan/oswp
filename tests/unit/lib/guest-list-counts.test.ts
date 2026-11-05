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
    })
  })

  it('counts confirmed guests above the imported invited count without breaking the pill sum', () => {
    expect(deriveGuestListCounts([household(1, 4, ['Attending'])], 'wedding')).toEqual({
      guests: 4,
      households: 1,
      attending: 4,
      declined: 0,
      noResponse: 0,
    })
  })

  it('uses a confirmed count when the sheet has no invited count', () => {
    expect(deriveGuestListCounts([household(null, 2, ['Attending'])], 'wedding')).toEqual({
      guests: 2,
      households: 1,
      attending: 2,
      declined: 0,
      noResponse: 0,
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
    })
  })
})
