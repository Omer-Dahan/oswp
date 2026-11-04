import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'

import GuestSearchFilter from '~/components/guest-list/guest-search-filter'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

jest.mock('~/components/hooks', () => {
  const React = require('react')
  return {
    useOuterClick: () => React.createRef(),
  }
})

jest.mock('~/trpc/react', () => ({
  api: {
    guestTag: {
      getAll: {
        useQuery: () => ({ data: [] }),
      },
    },
  },
}))

function makeHousehold(id: string, side: string | null | undefined): HouseholdWithGuests {
  return {
    id,
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
    side: side ?? null,
    groupName: null,
    attendingCount: null,
    childrenCount: null,
    dietaryNotes: null,
    wishesMessage: null,
    guests: [
      {
        id: Number(id.replace(/\D/g, '')) || 1,
        firstName: `Guest-${id}`,
        lastName: 'Test',
        email: null,
        phone: null,
        householdId: id,
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
  } as unknown as HouseholdWithGuests
}

function Harness({ households }: { households: HouseholdWithGuests[] }) {
  const [filtered, setFiltered] = useState<HouseholdWithGuests[]>(households)
  return (
    <>
      <GuestSearchFilter
        households={households}
        setFilteredHouseholds={setFiltered}
        events={[]}
        selectedEventId='all'
      />
      <ul data-testid='filtered-households'>
        {filtered.map((household) => (
          <li key={household.id}>{household.id}</li>
        ))}
      </ul>
    </>
  )
}

function RestoredHarness({ households }: { households: HouseholdWithGuests[] }) {
  const [filtered, setFiltered] = useState<HouseholdWithGuests[]>(households)
  return (
    <>
      <GuestSearchFilter
        households={households}
        setFilteredHouseholds={setFiltered}
        events={[]}
        selectedEventId='all'
        initialFilters={{
          search: '',
          rsvp: null,
          tagId: null,
          country: null,
          side: null,
          group: 'renamed-group',
        }}
      />
      <span data-testid='restored-count'>{filtered.length}</span>
    </>
  )
}

describe('GuestSearchFilter — side filter "ללא צד" option', () => {
  const households: HouseholdWithGuests[] = [
    makeHousehold('side-groom', 'חתן'),
    makeHousehold('side-bride', 'כלה'),
    makeHousehold('no-side-null', null),
    makeHousehold('no-side-empty', ''),
    makeHousehold('no-side-whitespace', '   '),
  ]

  it('shows "ללא צד" with the count of households missing a side, and filters to only those', () => {
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'צד' }))
    const option = screen.getByText('ללא צד (סה״כ 3 משקי בית)')
    fireEvent.click(option)

    const listItems = within(screen.getByTestId('filtered-households')).getAllByRole('listitem')
    expect(listItems.map((li) => li.textContent)).toEqual([
      'no-side-null',
      'no-side-empty',
      'no-side-whitespace',
    ])
  })

  it('still filters by a real side after the no-side option exists', () => {
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'צד' }))
    fireEvent.click(screen.getByText('חתן (סה״כ 1 משק בית)'))

    const listItems = within(screen.getByTestId('filtered-households')).getAllByRole('listitem')
    expect(listItems.map((li) => li.textContent)).toEqual(['side-groom'])
  })

  it('the clear chip removes the no-side filter', () => {
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'צד' }))
    fireEvent.click(screen.getByText('ללא צד (סה״כ 3 משקי בית)'))

    fireEvent.click(screen.getByText(/^צד: ללא צד/))

    const listItems = within(screen.getByTestId('filtered-households')).getAllByRole('listitem')
    expect(listItems).toHaveLength(households.length)
  })

  it('does not show the "ללא צד" option when every household has a side', () => {
    const allWithSides = [makeHousehold('a', 'חתן'), makeHousehold('b', 'כלה')]
    render(<Harness households={allWithSides} />)

    fireEvent.click(screen.getByRole('button', { name: 'צד' }))

    expect(screen.queryByText(/ללא צד/)).not.toBeInTheDocument()
  })

  it('ignores a stored group name that no longer exists', () => {
    render(<RestoredHarness households={households} />)
    expect(screen.getByTestId('restored-count')).toHaveTextContent(String(households.length))
    expect(screen.queryByText(/renamed-group/)).not.toBeInTheDocument()
  })
})
