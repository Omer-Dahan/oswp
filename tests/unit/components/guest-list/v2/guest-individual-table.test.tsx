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
  childrenCount: null,
  dietaryNotes: null,
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
    expect(cells[7]).toBeEmptyDOMElement()
    expect(cells[8]).toBeEmptyDOMElement()
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
