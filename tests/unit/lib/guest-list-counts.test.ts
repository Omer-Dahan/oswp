import { type CountableHousehold, deriveGuestListCounts } from '~/lib/guest-list-counts'

const household = (
  invitedCount: number,
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
})
