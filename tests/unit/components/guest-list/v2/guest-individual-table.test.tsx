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
  it('renders the eight guest row columns without children or dietary notes', () => {
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
      'מוזמן',
      'מגיע בפועל',
      'קישור הזמנה',
    ])

    const row = screen.getByRole('row', { name: /נועה כהן/ })
    expect(within(row).getAllByRole('cell')).toHaveLength(8)
    expect(screen.queryByText('ילדים')).not.toBeInTheDocument()
    expect(screen.queryByText('הערות תזונה')).not.toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
    expect(screen.queryByText('טבעוני')).not.toBeInTheDocument()
  })

  it('spans the empty state across all eight columns', () => {
    render(
      <GuestIndividualTable
        households={[]}
        householdNumberMap={new Map()}
        onSelectHousehold={jest.fn()}
      />
    )

    expect(screen.getByText('לא נמצאו אורחים')).toHaveAttribute('colspan', '8')
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
    const cells = within(row).getAllByRole('cell')
    expect(screen.getByText('לא השיב')).toBeInTheDocument()
    expect(cells[6]).toBeEmptyDOMElement()
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
    const cells = within(row).getAllByRole('cell')
    expect(cells[5]).toHaveTextContent('1')
    expect(cells[6]).toHaveTextContent('4')
    expect(within(cells[6]!).getByTitle('אישר 4 מתוך 1 שהוזמן')).toBeInTheDocument()
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
})
