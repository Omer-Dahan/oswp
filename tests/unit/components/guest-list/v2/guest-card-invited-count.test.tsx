import { render, screen } from '@testing-library/react'

import { GuestCard } from '~/components/guest-list/v2/list/guest-card'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

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

describe('GuestCard invited count', () => {
  it('renders a dash when invitedCount is unknown, never inferring from the guest rows', () => {
    render(
      <GuestCard
        household={{ ...baseHousehold, invitedCount: null }}
        onSelectHousehold={jest.fn()}
      />
    )

    expect(screen.getByText(/^— אורחים/)).toBeInTheDocument()
  })

  it('renders the imported invitedCount when it is a positive number', () => {
    render(
      <GuestCard
        household={{ ...baseHousehold, invitedCount: 2 }}
        onSelectHousehold={jest.fn()}
      />
    )

    expect(screen.getByText(/^2 אורחים/)).toBeInTheDocument()
  })
})
