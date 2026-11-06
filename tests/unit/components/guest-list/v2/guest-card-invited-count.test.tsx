import { render, screen } from '@testing-library/react'

import { GuestCard } from '~/components/guest-list/v2/list/guest-card'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

jest.mock('~/trpc/react', () => ({
  api: {
    useUtils: () => ({
      sms: {
        getInviteMessage: {
          fetch: jest.fn().mockResolvedValue({ message: '' }),
        },
      },
    }),
  },
}))

const baseHousehold: HouseholdWithGuests = {
  id: 'household-1',
  weddingId: 'wedding-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  address1: null,
  address2: null,
  city: null,
  state: null,
  zipCode: null,
  country: null,
  likelihoodOfAttending: null,
  notes: null,
  invitedCount: null,
  side: null,
  groupName: null,
  attendingCount: null,
  childrenCount: null,
  dietaryNotes: null,
  wishesMessage: null,
  guests: [
    {
      id: 1,
      firstName: 'Alex',
      lastName: 'Rivera',
      email: null,
      phone: null,
      householdId: 'household-1',
      weddingId: 'wedding-1',
      isPrimaryContact: true,
      ageGroup: 'ADULT',
      isTagAlong: false,
      guestTags: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      invitations: [],
    },
  ],
}

// The card's arrival count is driven by per-guest wedding RSVP tallies, not by
// the household's imported `invitedCount`/`attendingCount` fields (those still
// feed the row view's InvitedAttendingLine) - so these cases exercise the
// arrival-first states via guest invitations instead.
describe('GuestCard party count', () => {
  it('shows "לא הוזמן" when there is no RSVP data to report an invited count from', () => {
    render(
      <GuestCard
        household={{ ...baseHousehold, invitedCount: null }}
        onSelectHousehold={jest.fn()}
      />
    )

    expect(screen.getByText('טרם השיבו')).toBeInTheDocument()
    expect(screen.getByText('לא הוזמן')).toBeInTheDocument()
    expect(screen.queryByText(/הוזמנו/)).not.toBeInTheDocument()
    expect(screen.queryByText(/מתוך/)).not.toBeInTheDocument()
  })

  it('does not show an invited total once guests are invited but have not answered', () => {
    const guestsInvited = [1, 2].map((guestId) => ({
      ...baseHousehold.guests[0]!,
      id: guestId,
      invitations: [
        {
          id: `inv-${guestId}`,
          weddingId: 'wedding-1',
          guestId,
          eventId: 'event-1',
          rsvp: 'Invited',
          dietaryRestrictions: null,
          submittedBy: null,
          submittedAt: null,
          invitedAt: new Date('2026-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    }))

    render(
      <GuestCard
        household={{ ...baseHousehold, guests: guestsInvited }}
        onSelectHousehold={jest.fn()}
      />
    )

    expect(screen.getByText('טרם השיבו')).toBeInTheDocument()
    expect(screen.queryByText(/הוזמנו/)).not.toBeInTheDocument()
    expect(screen.queryByText('לא הוזמן')).not.toBeInTheDocument()
  })

  it('shows the arrival count alongside the invited total when some guests have answered', () => {
    const household: HouseholdWithGuests = {
      ...baseHousehold,
      guests: [
        {
          ...baseHousehold.guests[0]!,
          invitations: [
            {
              id: 'inv-1',
              weddingId: 'wedding-1',
              guestId: 1,
              eventId: 'event-1',
              rsvp: 'Attending',
              dietaryRestrictions: null,
              submittedBy: null,
              submittedAt: null,
              invitedAt: new Date('2026-01-01T00:00:00.000Z'),
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
        },
        {
          ...baseHousehold.guests[0]!,
          id: 2,
          invitations: [
            {
              id: 'inv-2',
              weddingId: 'wedding-1',
              guestId: 2,
              eventId: 'event-1',
              rsvp: 'Invited',
              dietaryRestrictions: null,
              submittedBy: null,
              submittedAt: null,
              invitedAt: new Date('2026-01-01T00:00:00.000Z'),
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
        },
      ],
    }

    render(<GuestCard household={household} onSelectHousehold={jest.fn()} />)

    expect(screen.getByText('מגיע לחתונה').closest('div')).toHaveTextContent('1')
    expect(screen.queryByText(/מתוך/)).not.toBeInTheDocument()
  })

  it("uses the household's reported attending count over the named-guest count, and renders the plural copy", () => {
    const household: HouseholdWithGuests = {
      ...baseHousehold,
      attendingCount: 2,
      guests: [
        {
          ...baseHousehold.guests[0]!,
          invitations: [
            {
              id: 'inv-1',
              weddingId: 'wedding-1',
              guestId: 1,
              eventId: 'event-1',
              rsvp: 'Attending',
              dietaryRestrictions: null,
              submittedBy: null,
              submittedAt: null,
              invitedAt: new Date('2026-01-01T00:00:00.000Z'),
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
        },
      ],
    }

    render(<GuestCard household={household} onSelectHousehold={jest.fn()} />)

    expect(screen.getByText('מגיעים לחתונה').closest('div')).toHaveTextContent('2')
    expect(screen.queryByText(/מתוך/)).not.toBeInTheDocument()
    expect(screen.queryByText(/לפי דיווח האורח/)).not.toBeInTheDocument()
  })
})
