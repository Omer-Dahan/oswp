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

  it('resolves the "all events" tab to the wedding event instead of counting any event answered', () => {
    // Finding #3: the "all" tab used to tally an answer on *any* event (the
    // chuppah included), which never matched what the cards name. It must
    // resolve and scope to the wedding's own RSVP-able event instead.
    const weddingEvents = [
      { id: 'chuppah', name: 'החופה', collectRsvp: true },
      { id: 'wedding', name: 'החתונה', isPrimary: true, collectRsvp: true },
    ]
    const answeredOnlyOnChuppah: CountableHousehold = {
      invitedCount: 1,
      attendingCount: null,
      guests: [{ invitations: [{ eventId: 'chuppah', rsvp: 'Attending' }] }],
    }

    expect(deriveGuestListCounts([answeredOnlyOnChuppah], undefined, weddingEvents)).toEqual({
      guests: 1,
      households: 1,
      attending: 0,
      declined: 0,
      noResponse: 1,
      pendingHouseholds: 1,
      pendingGuests: 1,
    })
  })

  it('counts every household as no response when no event can be resolved', () => {
    const household = {
      invitedCount: 3,
      attendingCount: 3,
      guests: [{ invitations: [{ eventId: 'wedding', rsvp: 'Attending' }] }],
    }

    expect(deriveGuestListCounts([household])).toEqual({
      guests: 3,
      households: 1,
      attending: 0,
      declined: 0,
      noResponse: 3,
      pendingHouseholds: 1,
      pendingGuests: 3,
    })
  })

  it('does not let a stale household attendingCount count a chuppah-only decline as attending the wedding', () => {
    // Finding #1: 20 production households answered only the chuppah, which
    // derives a Declined row on the wedding invitation, but their stored
    // attendingCount (set from an earlier, broader answer) must not leak
    // into the wedding tab's attending figure.
    const chuppahOnlyHousehold: CountableHousehold = {
      invitedCount: 2,
      attendingCount: 2,
      guests: [
        { invitations: [{ eventId: 'wedding', rsvp: 'Declined' }] },
        { invitations: [{ eventId: 'wedding', rsvp: 'Declined' }] },
      ],
    }

    expect(deriveGuestListCounts([chuppahOnlyHousehold], 'wedding')).toEqual({
      guests: 2,
      households: 1,
      attending: 0,
      declined: 2,
      noResponse: 0,
      pendingHouseholds: 0,
      pendingGuests: 0,
    })
  })

  it('agrees with the "טרם השיבו" filter definition: pending is the scoped household-level answer', () => {
    // Finding #4: a household invited to two events must be judged pending
    // only against the *scoped* event's answer, not any other event's.
    const answeredChuppahOnly: CountableHousehold = {
      invitedCount: 1,
      attendingCount: null,
      guests: [
        {
          invitations: [
            { eventId: 'chuppah', rsvp: 'Attending' },
            { eventId: 'wedding', rsvp: 'Invited' },
          ],
        },
      ],
    }

    expect(deriveGuestListCounts([answeredChuppahOnly], 'wedding')).toEqual({
      guests: 1,
      households: 1,
      attending: 0,
      declined: 0,
      noResponse: 1,
      pendingHouseholds: 1,
      pendingGuests: 1,
    })
    expect(deriveGuestListCounts([answeredChuppahOnly], 'chuppah')).toEqual({
      guests: 1,
      households: 1,
      attending: 1,
      declined: 0,
      noResponse: 0,
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
