import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'

import GuestSearchFilter from '~/components/guest-list/guest-search-filter'
import { SELF_ADD_GROUP_NAME } from '~/lib/constants/guest-self-add'
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

function makeHousehold(
  id: string,
  side: string | null | undefined,
  groupName: string | null | undefined = null
): HouseholdWithGuests {
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
    groupName: groupName ?? null,
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

describe('GuestSearchFilter side filter "ללא צד" option', () => {
  const households: HouseholdWithGuests[] = [
    makeHousehold('side-groom', 'חתן'),
    makeHousehold('side-bride', 'כלה'),
    makeHousehold('no-side-null', null),
    makeHousehold('no-side-empty', ''),
    makeHousehold('no-side-whitespace', '   '),
  ]

  it('shows "ללא צד" with the count of households missing a side, and filters to only those', () => {
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'סינון' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'צד' }), {
      target: { value: '__no_side__' },
    })

    const listItems = within(screen.getByTestId('filtered-households')).getAllByRole('listitem', {
      hidden: true,
    })
    expect(listItems.map((li) => li.textContent)).toEqual([
      'no-side-null',
      'no-side-empty',
      'no-side-whitespace',
    ])
  })

  it('still filters by a real side after the no-side option exists', () => {
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'סינון' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'צד' }), { target: { value: 'חתן' } })

    const listItems = within(screen.getByTestId('filtered-households')).getAllByRole('listitem', {
      hidden: true,
    })
    expect(listItems.map((li) => li.textContent)).toEqual(['side-groom'])
  })

  it('the clear chip removes the no-side filter', () => {
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'סינון' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'צד' }), {
      target: { value: '__no_side__' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'הסרת הסינון צד: ללא צד' }))

    const listItems = within(screen.getByTestId('filtered-households')).getAllByRole('listitem', {
      hidden: true,
    })
    expect(listItems).toHaveLength(households.length)
  })

  it('does not show the "ללא צד" option when every household has a side', () => {
    const allWithSides = [makeHousehold('a', 'חתן'), makeHousehold('b', 'כלה')]
    render(<Harness households={allWithSides} />)

    fireEvent.click(screen.getByRole('button', { name: 'סינון' }))

    expect(screen.queryByText(/ללא צד/)).not.toBeInTheDocument()
  })

  it('ignores a stored group name that no longer exists', () => {
    render(<RestoredHarness households={households} />)
    expect(screen.getByTestId('restored-count')).toHaveTextContent(String(households.length))
    expect(screen.queryByText(/renamed-group/)).not.toBeInTheDocument()
  })

  it('announces the filtered count and shows reset only while a filter is active', () => {
    render(<Harness households={households} />)

    expect(
      screen.getByText(`מציג ${households.length} מתוך ${households.length} משקי בית`)
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'סינון' }))
    expect(screen.queryByRole('button', { name: 'איפוס' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'צד' }), { target: { value: 'חתן' } })
    expect(screen.getAllByText(`מציג 1 מתוך ${households.length} משקי בית`).length).toBeGreaterThan(
      0
    )
    expect(screen.getByRole('button', { name: 'איפוס' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'הסרת הסינון צד: חתן' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'איפוס' }))
    expect(screen.queryByRole('button', { name: 'איפוס' })).not.toBeInTheDocument()
  })
})

describe('GuestSearchFilter group filter for self-added households', () => {
  it('lists the self-add group with a count when such households exist, and filters to only those', () => {
    const selfAddHouseholds: HouseholdWithGuests[] = [
      makeHousehold('self-added-1', null, SELF_ADD_GROUP_NAME),
      makeHousehold('self-added-2', null, SELF_ADD_GROUP_NAME),
      makeHousehold('regular-1', 'חתן', 'קבוצה רגילה'),
    ]

    render(<Harness households={selfAddHouseholds} />)

    fireEvent.click(screen.getByRole('button', { name: 'סינון' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'קבוצה' }), {
      target: { value: SELF_ADD_GROUP_NAME.toLowerCase() },
    })

    const listItems = within(screen.getByTestId('filtered-households')).getAllByRole('listitem', {
      hidden: true,
    })
    expect(listItems.map((li) => li.textContent)).toEqual(['self-added-1', 'self-added-2'])
  })

  it('does not show the self-add group option when no household belongs to it', () => {
    const households: HouseholdWithGuests[] = [makeHousehold('a', 'חתן', 'קבוצה רגילה')]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'סינון' }))

    expect(screen.queryByText(new RegExp(SELF_ADD_GROUP_NAME))).not.toBeInTheDocument()
  })
})
