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
let mockTagsLoading = false

jest.mock('~/trpc/react', () => ({
  api: {
    guestTag: {
      getAll: {
        useQuery: () => ({ data: mockTags, isLoading: mockTagsLoading }),
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
  mobileFiltersOpen = false,
}: {
  households: HouseholdWithGuests[]
  events?: Event[]
  mobileFiltersOpen?: boolean
}) {
  const [filtered, setFiltered] = useState<HouseholdWithGuests[]>(households)
  return (
    <>
      <GuestSearchFilter
        households={households}
        setFilteredHouseholds={setFiltered}
        events={events}
        selectedEventId='all'
        mobileFiltersOpen={mobileFiltersOpen}
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

// Finding #5: production has 52 households in a "חברים" group split across
// both sides - selecting one side's group must not pull in the other side's.
describe('GuestSearchFilter — finding #5: side-scoped group keys', () => {
  it('selecting "חברים" under חתן does not also select the כלה household named חברים', () => {
    const households = [
      makeHousehold('groom-friend', 'חתן', 'חברים'),
      makeHousehold('bride-friend', 'כלה', 'חברים'),
    ]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))
    const sections = screen.getAllByRole('region')
    fireEvent.click(within(sections[0]).getByText('חברים (1)'))

    expect(filteredHouseholdIds()).toEqual(['groom-friend'])
  })

  it('shows the chip and button label with the side so the two חברים groups are distinguishable', () => {
    const households = [
      makeHousehold('groom-friend', 'חתן', 'חברים'),
      makeHousehold('bride-friend', 'כלה', 'חברים'),
    ]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))
    const sections = screen.getAllByRole('region')
    fireEvent.click(within(sections[0]).getByText('חברים (1)'))

    expect(screen.getByRole('button', { name: 'חברים · חתן' })).toBeInTheDocument()
    expect(screen.getByText(/^קבוצה: חברים · חתן/)).toBeInTheDocument()
  })
})

// Finding #11: four production group names carry a stray double space -
// they must collapse to one option, findable regardless of the typed spacing.
describe('GuestSearchFilter — finding #11: tolerant group key normalisation', () => {
  it('merges a double-spaced group name with its single-spaced twin into one option', () => {
    const households = [
      makeHousehold('a', 'חתן', 'אבא  עבודה'),
      makeHousehold('b', 'חתן', 'אבא עבודה'),
    ]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))

    const mergedOption = screen.getByText(
      (content) => content.includes('עבודה') && content.includes('(2)')
    )
    expect(mergedOption).toBeInTheDocument()
    fireEvent.click(mergedOption)

    expect(filteredHouseholdIds()).toEqual(['a', 'b'])
  })
})

// Finding #16: households with no group name get a findable "ללא קבוצה" option.
describe('GuestSearchFilter — finding #16: no-group option', () => {
  it('lists "ללא קבוצה" and filters to households missing a group', () => {
    const households = [
      makeHousehold('has-group', 'חתן', 'חברים'),
      makeHousehold('no-group', 'חתן', null),
    ]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))
    fireEvent.click(screen.getByText('ללא קבוצה (1)'))

    expect(filteredHouseholdIds()).toEqual(['no-group'])
  })
})

// Finding #18: a side header control selects every group on that side at once.
describe('GuestSearchFilter — finding #18: select the whole side', () => {
  it('selects every group under חתן, then deselects them on a second click', () => {
    const households = [
      makeHousehold('groom-a', 'חתן', 'חברים'),
      makeHousehold('groom-b', 'חתן', 'עבודה'),
      makeHousehold('bride-a', 'כלה', 'משפחה'),
    ]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'קבוצה' }))
    fireEvent.click(screen.getByRole('button', { name: 'בחירת כל הצד · חתן' }))

    expect(filteredHouseholdIds()).toEqual(['groom-a', 'groom-b'])

    fireEvent.click(screen.getByRole('button', { name: 'ביטול בחירת כל הצד · חתן' }))

    expect(filteredHouseholdIds()).toHaveLength(households.length)
  })
})

// Finding #6: a restored tag filter must survive the tag query still loading,
// and be re-validated (not blindly kept) once it resolves.
describe('GuestSearchFilter — finding #6: tag filter survives a slow tag query', () => {
  afterEach(() => {
    mockTagsLoading = false
    mockTags = []
  })

  it('keeps a restored tag id alive through the loading window, applying it once the tag resolves as real', () => {
    mockTagsLoading = true
    mockTags = []
    const tagged = makeHousehold('tagged', 'חתן')
    tagged.guests[0].guestTags = [
      { tagId: 'tag-1' },
    ] as HouseholdWithGuests['guests'][number]['guestTags']
    const households = [tagged, makeHousehold('untagged', 'חתן')]
    const initialFilters = {
      search: '',
      rsvp: [],
      tagId: ['tag-1'],
      country: [],
      side: [],
      group: [],
    }

    function Harness3() {
      const [filtered, setFiltered] = useState<HouseholdWithGuests[]>(households)
      return (
        <>
          <GuestSearchFilter
            households={households}
            setFilteredHouseholds={setFiltered}
            events={[]}
            selectedEventId='all'
            initialFilters={initialFilters}
          />
          <ul data-testid='filtered-households'>
            {filtered.map((household) => (
              <li key={household.id}>{household.id}</li>
            ))}
          </ul>
        </>
      )
    }

    const { rerender } = render(<Harness3 />)

    // While the tag query is loading there's no tag UI to show yet, but the
    // restored filter must still be intact internally - not wiped to [].
    mockTagsLoading = false
    mockTags = [{ id: 'tag-1', name: 'משפחה' }]
    rerender(<Harness3 />)

    expect(filteredHouseholdIds()).toEqual(['tagged'])
    expect(screen.getByRole('button', { name: 'משפחה' })).toBeInTheDocument()
  })

  it('drops a restored tag id once resolved as nonexistent, instead of keeping it forever', () => {
    mockTagsLoading = true
    mockTags = []
    const taggedWithOtherTag = makeHousehold('a', 'חתן')
    taggedWithOtherTag.guests[0].guestTags = [
      { tagId: 'tag-2' },
    ] as HouseholdWithGuests['guests'][number]['guestTags']
    const households = [taggedWithOtherTag]
    const initialFilters = {
      search: '',
      rsvp: [],
      tagId: ['tag-1'],
      country: [],
      side: [],
      group: [],
    }

    function Harness3() {
      const [, setFiltered] = useState<HouseholdWithGuests[]>(households)
      return (
        <GuestSearchFilter
          households={households}
          setFilteredHouseholds={setFiltered}
          events={[]}
          selectedEventId='all'
          initialFilters={initialFilters}
        />
      )
    }

    const { rerender } = render(<Harness3 />)

    mockTagsLoading = false
    mockTags = [{ id: 'tag-2', name: 'עבודה' }]
    rerender(<Harness3 />)

    fireEvent.click(screen.getByRole('button', { name: 'תגית אורח' }))
    expect(screen.getByText('הכל').closest('button')).toHaveAttribute('aria-pressed', 'true')
  })
})

// Finding #7: a status filter scoped to one event must not survive a switch
// to a tab for a different event.
describe('GuestSearchFilter — finding #7: event-scoped RSVP filter', () => {
  it('drops the restored RSVP filter when it belongs to a different event than the selected tab', () => {
    const eventA = makeEvent('event-a', 'אירוע א')
    const eventB = makeEvent('event-b', 'אירוע ב')
    // Stable references: Harness2 re-renders when its own effects push a
    // filtered result back up, so these must not be recreated inline on
    // every render or the push effect loops forever.
    const stableHouseholds = [makeHousehold('a', 'חתן')]
    const stableEvents = [eventA, eventB]
    const stableInitialFilters = {
      search: '',
      rsvp: [{ eventId: 'event-a', rsvpValue: 'Attending' }],
      tagId: [],
      country: [],
      side: [],
      group: [],
    }

    function Harness2({ selectedEventId }: { selectedEventId: string }) {
      const [filtered, setFiltered] = useState<HouseholdWithGuests[]>([])
      return (
        <>
          <GuestSearchFilter
            households={stableHouseholds}
            setFilteredHouseholds={setFiltered}
            events={stableEvents}
            selectedEventId={selectedEventId}
            initialFilters={stableInitialFilters}
          />
          <span data-testid='count'>{filtered.length}</span>
        </>
      )
    }

    render(<Harness2 selectedEventId='event-b' />)

    expect(screen.getByRole('button', { name: 'סטטוס RSVP' })).toBeInTheDocument()
    expect(screen.queryByText('מגיע/ה', { selector: 'span' })).not.toBeInTheDocument()
  })
})

describe('GuestSearchFilter — finding #13/#20: accessibility and keyboard nav', () => {
  it('marks the trigger buttons with aria-haspopup/aria-expanded and options with aria-pressed', () => {
    const households = [makeHousehold('a', 'חתן', 'חברים')]
    render(<Harness households={households} />)

    const sideButton = screen.getByRole('button', { name: 'צד' })
    expect(sideButton).toHaveAttribute('aria-haspopup', 'listbox')
    expect(sideButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(sideButton)
    expect(sideButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('חתן (1)').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('gives each active-filter chip an aria-label naming what it removes', () => {
    const households = [makeHousehold('a', 'חתן')]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'צד' }))
    fireEvent.click(screen.getByText('חתן (1)'))

    expect(screen.getByRole('button', { name: 'הסרת סינון צד: חתן' })).toBeInTheDocument()
  })

  it('Escape closes an open desktop dropdown and returns focus to its trigger', () => {
    const households = [makeHousehold('a', 'חתן')]
    render(<Harness households={households} />)

    const sideButton = screen.getByRole('button', { name: 'צד' })
    fireEvent.click(sideButton)
    expect(screen.getByText('חתן (1)')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByText('חתן (1)'), { key: 'Escape' })

    expect(screen.queryByText('חתן (1)')).not.toBeInTheDocument()
    expect(sideButton).toHaveFocus()
  })

  it('ArrowDown moves focus to the next option in an open dropdown', () => {
    const households = [makeHousehold('a', 'חתן'), makeHousehold('b', 'כלה')]
    render(<Harness households={households} />)

    fireEvent.click(screen.getByRole('button', { name: 'צד' }))
    const allOption = screen.getByText('הכל').closest('button') as HTMLButtonElement
    allOption.focus()
    fireEvent.keyDown(allOption, { key: 'ArrowDown' })

    expect(screen.getByText('חתן (1)').closest('button')).toHaveFocus()
  })

  it('the mobile backdrop is not reachable by Tab (tabIndex -1)', () => {
    const households = [makeHousehold('a', 'חתן')]
    render(<Harness households={households} mobileFiltersOpen />)

    expect(screen.getByLabelText('סגירת מסננים', { selector: 'button.fixed' })).toHaveAttribute(
      'tabIndex',
      '-1'
    )
  })
})

describe('GuestSearchFilter — finding #14: settled flex-wrap on the filter row', () => {
  it('keeps exactly one of md:flex-wrap/md:flex-nowrap and adds a wrap fallback for 768-1000px', () => {
    const households = [makeHousehold('a', 'חתן')]
    render(<Harness households={households} />)

    const row = screen.getByTestId('affiliation-filter-row')
    expect(row).toHaveClass('md:flex-nowrap')
    expect(row.className).not.toMatch(/(?<!-)md:flex-wrap\b/)
    expect(row.className).toContain('[@media(min-width:768px)_and_(max-width:1000px)]:flex-wrap')
  })
})
