import { render, screen, within } from '@testing-library/react'

import { GuestIndividualTable } from '~/components/guest-list/v2/list/guest-individual-table'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

jest.mock('~/trpc/react', () => ({
  api: {
    useUtils: () => ({
      sms: { getInviteMessage: { fetch: jest.fn() } },
    }),
  },
}))

const household: HouseholdWithGuests = {
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
  invitedCount: 1,
  side: 'כלה',
  groupName: 'משפחה',
  attendingCount: 4,
  childrenCount: 2,
  dietaryNotes: 'טבעוני',
  wishesMessage: null,
  gifts: [],
  guests: [
    {
      id: 1,
      firstName: 'נועה',
      lastName: 'כהן',
      email: 'hidden@example.com',
      phone: '0501234567',
      householdId: 'household-1',
      weddingId: 'wedding-1',
      isPrimaryContact: true,
      ageGroup: 'ADULT',
      isTagAlong: false,
      guestTags: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      invitations: [{ id: 'invite-1', eventId: 'wedding', guestId: 1, rsvp: 'Invited' }],
    },
  ],
}

describe('GuestIndividualTable', () => {
  it('renders the six guest row columns, with the counts under the name', () => {
    render(
      <GuestIndividualTable
        households={[household]}
        householdNumberMap={new Map([['household-1', 1]])}
        onSelectHousehold={jest.fn()}
      />
    )

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'שם האורח',
      'טלפון',
      'צד',
      'קבוצה',
      'סטטוס',
      'קישור הזמנה',
    ])

    const row = screen.getByRole('row', { name: /נועה כהן/ })
    expect(within(row).getAllByRole('cell')).toHaveLength(6)
    expect(within(row).getByText('מוזמן 1')).toBeInTheDocument()
    expect(screen.queryByText('ילדים')).not.toBeInTheDocument()
    expect(screen.queryByText('הערות תזונה')).not.toBeInTheDocument()
    expect(screen.queryByText('טבעוני')).not.toBeInTheDocument()
  })

  it('spans the empty state across all six columns', () => {
    render(
      <GuestIndividualTable
        households={[]}
        householdNumberMap={new Map()}
        onSelectHousehold={jest.fn()}
      />
    )

    expect(screen.getByText('לא נמצאו אורחים')).toHaveAttribute('colspan', '6')
  })

  it('keeps unanswered RSVP details empty and derives status independently', () => {
    render(
      <GuestIndividualTable
        households={[{ ...household, attendingCount: null }]}
        householdNumberMap={new Map([['household-1', 1]])}
        onSelectHousehold={jest.fn()}
      />
    )

    const row = screen.getByRole('row', { name: /נועה כהן/ })
    expect(screen.getByText('לא השיב')).toBeInTheDocument()
    expect(within(row).getByText('מוזמן 1')).toBeInTheDocument()
    expect(within(row).queryByText(/מגיע/)).not.toBeInTheDocument()
    expect(screen.queryByText('hidden@example.com')).not.toBeInTheDocument()
  })

  it('shows both 1 invited and 4 confirmed with a visible mismatch marker', () => {
    render(
      <GuestIndividualTable
        households={[household]}
        householdNumberMap={new Map([['household-1', 1]])}
        onSelectHousehold={jest.fn()}
      />
    )

    const row = screen.getByRole('row', { name: /נועה כהן/ })
    expect(within(row).getByText('מוזמן 1')).toBeInTheDocument()
    expect(within(row).getByTitle('אישר 4 מתוך 1 שהוזמן')).toHaveTextContent('מגיע 4')
  })

  it('does not infer status from attendingCount', () => {
    render(
      <GuestIndividualTable
        households={[household]}
        householdNumberMap={new Map([['household-1', 1]])}
        onSelectHousehold={jest.fn()}
      />
    )

    expect(screen.getByText('לא השיב')).toBeInTheDocument()
    expect(screen.queryByText('אישר')).not.toBeInTheDocument()
  })

  it('shows the mirrored mixed-event line when the household answered only the wedding', () => {
    const weddingEvent = { id: 'wedding', name: 'החתונה', isPrimary: true, collectRsvp: true }
    const chuppahEvent = { id: 'chuppah', name: 'החופה', collectRsvp: true }
    const weddingOnlyHousehold: HouseholdWithGuests = {
      ...household,
      guests: [{ ...household.guests[0]!, invitations: [{ id: 'invite-1', eventId: 'wedding', guestId: 1, rsvp: 'Attending' }] }],
    }

    render(
      <GuestIndividualTable
        households={[weddingOnlyHousehold]}
        householdNumberMap={new Map([['household-1', 1]])}
        onSelectHousehold={jest.fn()}
        events={[weddingEvent, chuppahEvent]}
      />
    )

    expect(screen.getByText('החופה טרם השיבה · מגיע לחתונה')).toBeInTheDocument()
  })

  it('shows nothing under the name when invited and attending are both unknown', () => {
    render(
      <GuestIndividualTable
        households={[{ ...household, invitedCount: null, attendingCount: null }]}
        householdNumberMap={new Map([['household-1', 1]])}
        onSelectHousehold={jest.fn()}
      />
    )

    const row = screen.getByRole('row', { name: /נועה כהן/ })
    expect(within(row).queryByText(/מוזמן/)).not.toBeInTheDocument()
    expect(within(row).queryByText(/מגיע/)).not.toBeInTheDocument()
  })
})
