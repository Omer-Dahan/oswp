import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'

import type { Event } from '~/app/utils/shared-types'
import GuestSearchFilter from '~/components/guest-list/guest-search-filter'
import { SELF_ADD_GROUP_NAME } from '~/lib/constants/guest-self-add'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

jest.mock('~/components/hooks', () => {
  const React = require('react')
  return {
    useOuterClick: () => React.createRef(),
  }
})

let mockTags: Array<{ id: string; name: string }> = []

jest.mock('~/trpc/react', () => ({
  api: {
    guestTag: {
      getAll: {
        useQuery: () => ({ data: mockTags }),
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

function Harness({
  households,
  events = [],
}: {
  households: HouseholdWithGuests[]
  events?: Event[]
}) {
  const [filtered, setFiltered] = useState<HouseholdWithGuests[]>(households)
  return (
    <>
      <GuestSearchFilter
        households={households}
        setFilteredHouseholds={setFiltered}
        events={events}
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
          rsvp: [],
          tagId: [],
          country: [],
          side: [],
          group: ['renamed-group'],
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
    const option = screen.getByText('ללא צד (3)')
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
    fireEvent.click(screen.getByText('חתן (1)'))

    const listItems = within(screen.getByTestId('filtered-households')).getAllByRole('listitem')
    expect(listItems.map((li) => li.textContent)).toEqual(['side-groom'])
  })

  it('the clear chip removes the no-side filter', () => {
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'צד' }))
    fireEvent.click(screen.getByText('ללא צד (3)'))

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

describe('GuestSearchFilter — group filter for self-added households', () => {
  it('lists the self-add group with a count when such households exist, and filters to only those', () => {
    const selfAddHouseholds: HouseholdWithGuests[] = [
      makeHousehold('self-added-1', null, SELF_ADD_GROUP_NAME),
      makeHousehold('self-added-2', null, SELF_ADD_GROUP_NAME),
      makeHousehold('regular-1', 'חתן', 'קבוצה רגילה'),
    ]

    render(<Harness households={selfAddHouseholds} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))
    const option = screen.getByText(`${SELF_ADD_GROUP_NAME} (2)`)
    fireEvent.click(option)

    const listItems = within(screen.getByTestId('filtered-households')).getAllByRole('listitem')
    expect(listItems.map((li) => li.textContent)).toEqual(['self-added-1', 'self-added-2'])
  })

  it('does not show the self-add group option when no household belongs to it', () => {
    const households: HouseholdWithGuests[] = [makeHousehold('a', 'חתן', 'קבוצה רגילה')]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))

    expect(screen.queryByText(new RegExp(SELF_ADD_GROUP_NAME))).not.toBeInTheDocument()
  })
})

function makeHouseholdWithGuest(
  id: string,
  firstName: string,
  lastName: string,
  groupName: string | null = null
): HouseholdWithGuests {
  const household = makeHousehold(id, null, groupName)
  return {
    ...household,
    guests: [{ ...household.guests[0], firstName, lastName }],
  } as HouseholdWithGuests
}

const makeEvent = (id: string, name: string) => ({ id, name, questions: [] }) as unknown as Event

const withInvitation = (
  household: HouseholdWithGuests,
  eventId: string,
  rsvp: string
): HouseholdWithGuests => ({
  ...household,
  guests: [
    {
      ...household.guests[0],
      invitations: [{ eventId, rsvp }] as HouseholdWithGuests['guests'][number]['invitations'],
    },
  ],
})

const filteredHouseholdIds = () =>
  within(screen.getByTestId('filtered-households'))
    .getAllByRole('listitem')
    .map((item) => item.textContent)

describe('GuestSearchFilter — multi-value semantics', () => {
  it('shows the union of two selected groups', () => {
    const households = [
      makeHousehold('friends', 'חתן', 'חברים'),
      makeHousehold('family', 'כלה', 'משפחה'),
      makeHousehold('work', 'חתן', 'עבודה'),
    ]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))
    fireEvent.click(screen.getByText('חברים (1)'))
    fireEvent.click(screen.getByText('משפחה (1)'))

    expect(filteredHouseholdIds()).toEqual(['friends', 'family'])
    expect(screen.getByRole('button', { name: 'קבוצה · 2' })).toBeInTheDocument()
  })

  it('intersects one selected group with one selected side', () => {
    const households = [
      makeHousehold('groom-family', 'חתן', 'משפחה'),
      makeHousehold('bride-family', 'כלה', 'משפחה'),
      makeHousehold('groom-friends', 'חתן', 'חברים'),
    ]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))
    fireEvent.click(screen.getAllByText('משפחה (1)')[0])
    fireEvent.click(screen.getByRole('button', { name: 'צד' }))
    fireEvent.click(screen.getByText('חתן (2)'))

    expect(filteredHouseholdIds()).toEqual(['groom-family'])
  })

  it('shows the union of two RSVP statuses on the same event', () => {
    const event = makeEvent('event-a', 'אירוע א')
    const households = [
      withInvitation(makeHousehold('attending', 'חתן'), event.id, 'Attending'),
      withInvitation(makeHousehold('declined', 'כלה'), event.id, 'Declined'),
      withInvitation(makeHousehold('invited', 'חתן'), event.id, 'Invited'),
    ]
    render(<Harness households={households} events={[event]} />)

    fireEvent.click(screen.getByRole('button', { name: 'סטטוס RSVP' }))
    fireEvent.click(screen.getByText('מגיע/ה'))
    fireEvent.click(screen.getByText('לא מגיע/ה'))

    expect(filteredHouseholdIds()).toEqual(['attending', 'declined'])
  })

  it('shows the union of statuses selected on different events', () => {
    const eventA = makeEvent('event-a', 'אירוע א')
    const eventB = makeEvent('event-b', 'אירוע ב')
    const households = [
      withInvitation(makeHousehold('event-a-attending', 'חתן'), eventA.id, 'Attending'),
      withInvitation(makeHousehold('event-b-declined', 'כלה'), eventB.id, 'Declined'),
      withInvitation(makeHousehold('event-a-invited', 'חתן'), eventA.id, 'Invited'),
    ]
    render(<Harness households={households} events={[eventA, eventB]} />)

    fireEvent.click(screen.getByRole('button', { name: 'סטטוס RSVP' }))
    fireEvent.click(screen.getAllByText('מגיע/ה')[0])
    fireEvent.click(screen.getAllByText('לא מגיע/ה')[1])

    expect(filteredHouseholdIds()).toEqual(['event-a-attending', 'event-b-declined'])
  })

  it('returns all households after the selection is cleared', () => {
    const households = [
      makeHousehold('friends', 'חתן', 'חברים'),
      makeHousehold('family', 'כלה', 'משפחה'),
    ]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))
    fireEvent.click(screen.getByText('חברים (1)'))
    fireEvent.click(screen.getByText('הכל'))

    expect(filteredHouseholdIds()).toEqual(['friends', 'family'])
  })
})

describe('GuestSearchFilter — tolerant name search', () => {
  // Real prod row (Guest id 1348): firstName stored with a trailing space,
  // which used to break the "first last" concatenation this filter builds.
  const households: HouseholdWithGuests[] = [
    makeHouseholdWithGuest('aviran-tsumo', 'אבירן ', 'צומו', 'אבא - עבודה'),
    // Control case: a clean, already-findable household that must keep working.
    makeHouseholdWithGuest('anat-haretz', 'ענת', 'הרץ'),
  ]

  const search = (searchText: string) => {
    render(<Harness households={households} />)
    fireEvent.change(screen.getByPlaceholderText('חיפוש אורחים'), {
      target: { value: searchText },
    })
    return within(screen.getByTestId('filtered-households'))
      .getAllByRole('listitem')
      .map((li) => li.textContent)
  }

  it('finds the household by first + last name', () => {
    expect(search('אבירן צומו')).toEqual(['aviran-tsumo'])
  })

  it('finds the household with the terms reversed', () => {
    expect(search('צומו אבירן')).toEqual(['aviran-tsumo'])
  })

  it('finds the household by last name alone', () => {
    expect(search('צומו')).toEqual(['aviran-tsumo'])
  })

  it('tolerates extra whitespace typed into the search box', () => {
    expect(search('  אבירן   צומו  ')).toEqual(['aviran-tsumo'])
  })

  it('keeps finding the already-clean control household', () => {
    expect(search('ענת הרץ')).toEqual(['anat-haretz'])
  })
})

describe('GuestSearchFilter — grouped affiliation options', () => {
  const households = [
    makeHousehold('groom-friends-1', 'חתן', 'חברים'),
    makeHousehold('groom-friends-2', 'חתן', 'חברים'),
    makeHousehold('groom-friends-3', 'חתן', 'חברים'),
    makeHousehold('groom-family', 'חתן', 'משפחה'),
    makeHousehold('bride-work-1', 'כלה', 'עבודה'),
    makeHousehold('bride-work-2', 'כלה', 'עבודה'),
    makeHousehold('bride-family', 'כלה', 'משפחה'),
    makeHousehold('no-side-neighbors', null, 'שכנים'),
  ]

  it('groups by side and sorts each section by household count, then alphabetically', () => {
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))

    const sections = screen.getAllByRole('region')
    expect(sections.map((section) => section.getAttribute('aria-label'))).toEqual([
      'קבוצות צד חתן',
      'קבוצות צד כלה',
      'קבוצות צד ללא צד',
    ])
    expect(within(sections[0]).getByText('2 קבוצות · 4 משקי בית')).toBeInTheDocument()
    expect(
      within(sections[0])
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['חברים (3)', 'משפחה (1)'])
    expect(
      within(sections[1])
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['עבודה (2)', 'משפחה (1)'])
  })

  it('narrows the grouped list with Hebrew search and shows the empty state', () => {
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))
    const search = screen.getByRole('textbox', { name: 'חיפוש קבוצה' })
    fireEvent.change(search, { target: { value: 'עבו' } })

    expect(screen.getByText('עבודה (2)')).toBeInTheDocument()
    expect(screen.queryByText('חברים (3)')).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'לא קיימת' } })
    expect(screen.getByText('לא נמצאה קבוצה בשם הזה')).toBeInTheDocument()
  })

  it('keeps the filter controls left anchored, ordered, and non-wrapping from md', () => {
    mockTags = [{ id: 'family', name: 'משפחה' }]
    const householdsWithTag = households.map((household, index) => ({
      ...household,
      guests:
        index === 0
          ? [
              {
                ...household.guests[0],
                guestTags: [
                  { tagId: 'family' },
                ] as HouseholdWithGuests['guests'][number]['guestTags'],
              },
            ]
          : household.guests,
    }))
    render(<Harness households={householdsWithTag} />)

    const row = screen.getByTestId('affiliation-filter-row')
    expect(row).toHaveClass('ms-auto', 'justify-end', 'md:flex-nowrap')
    expect(
      within(row)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['סטטוס RSVP', 'תגית אורח', 'צד', 'קבוצה', 'ארץ'])
    mockTags = []
  })

  it('has no active-filter-chips row when no filter is active', () => {
    render(<Harness households={households} />)
    expect(screen.queryByTestId('active-filter-chips')).not.toBeInTheDocument()
  })

  it('renders the active-filter chips inline inside the dropdown row', () => {
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'צד' }))
    fireEvent.click(screen.getByText('חתן (4)'))

    const row = screen.getByTestId('affiliation-filter-row')
    const chipsRow = screen.getByTestId('active-filter-chips')
    expect(row).toContainElement(chipsRow)
    expect(within(chipsRow).getByText(/^צד: חתן/)).toBeInTheDocument()
  })
})

describe('GuestSearchFilter — tag option search', () => {
  beforeEach(() => {
    mockTags = Array.from({ length: 9 }, (_, index) => ({
      id: `tag-${index + 1}`,
      name: index === 8 ? 'משפחה קרובה' : `תגית ${index + 1}`,
    }))
  })

  afterEach(() => {
    mockTags = []
  })

  it('shows household counts and search when more than eight tags are available', () => {
    const taggedHouseholds = mockTags.map((tag, index) => {
      const household = makeHousehold(`tagged-${index + 1}`, 'חתן')
      household.guests[0].guestTags = [
        { tagId: tag.id },
      ] as HouseholdWithGuests['guests'][number]['guestTags']
      return household
    })

    render(<Harness households={taggedHouseholds} />)
    fireEvent.click(screen.getByRole('button', { name: 'תגית אורח' }))

    const search = screen.getByRole('textbox', { name: 'חיפוש תגית' })
    fireEvent.change(search, { target: { value: 'משפחה' } })
    expect(screen.getByText('משפחה קרובה (1)')).toBeInTheDocument()
    expect(screen.queryByText('תגית 1 (1)')).not.toBeInTheDocument()
  })
})
