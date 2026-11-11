import {
  type AutoSeatGuest,
  type AutoSeatHousehold,
  type AutoSeatTable,
  planAutoSeating,
} from '~/lib/seating/auto-seat'

const household = (overrides: Partial<AutoSeatHousehold> & { id: string }): AutoSeatHousehold => ({
  side: null,
  groupName: null,
  attendingCount: null,
  ...overrides,
})

const guest = (overrides: Partial<AutoSeatGuest> & { id: number; householdId: string }): AutoSeatGuest => ({
  isPrimaryContact: true,
  rsvp: 'Attending',
  seated: false,
  ...overrides,
})

describe('planAutoSeating', () => {
  it('seats two households of 4 at an existing table of 8', () => {
    const households = [household({ id: 'h1' }), household({ id: 'h2' })]
    const guests = [
      guest({ id: 1, householdId: 'h1' }),
      guest({ id: 2, householdId: 'h1' }),
      guest({ id: 3, householdId: 'h1' }),
      guest({ id: 4, householdId: 'h1' }),
      guest({ id: 5, householdId: 'h2' }),
      guest({ id: 6, householdId: 'h2' }),
      guest({ id: 7, householdId: 'h2' }),
      guest({ id: 8, householdId: 'h2' }),
    ]
    const tables: AutoSeatTable[] = [{ id: 'table-1', name: 'שולחן 1', capacity: 8, guestIds: [] }]

    const plan = planAutoSeating({
      households,
      guests,
      tables,
      fillFreeSeatsOnly: true,
    })

    expect(plan.unseated).toEqual([])
    const tableIds = new Set(plan.assignments.map((assignment) => assignment.tableId))
    expect(tableIds).toEqual(new Set(['table-1']))
    expect(plan.assignments.map((assignment) => assignment.guestId).sort()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ])
  })

  it('never touches a manually seated household', () => {
    const households = [household({ id: 'h1' })]
    const guests = [
      guest({ id: 1, householdId: 'h1', seated: true }),
      guest({ id: 2, householdId: 'h1', seated: true }),
    ]
    const tables: AutoSeatTable[] = [
      { id: 'table-1', name: 'שולחן 1', capacity: 8, guestIds: [1, 2] },
    ]

    const plan = planAutoSeating({
      households,
      guests,
      tables,
      fillFreeSeatsOnly: true,
    })

    expect(plan.assignments).toEqual([])
    expect(plan.unseated).toEqual([])
  })

  it('leaves a household unseated instead of opening a table when nothing existing fits', () => {
    const households = [household({ id: 'h1' })]
    const guests = Array.from({ length: 12 }, (_, index) =>
      guest({ id: index + 1, householdId: 'h1' })
    )
    const tables: AutoSeatTable[] = [{ id: 'table-1', name: 'שולחן 1', capacity: 8, guestIds: [] }]

    const plan = planAutoSeating({
      households,
      guests,
      tables,
      fillFreeSeatsOnly: true,
    })

    expect(plan.assignments).toEqual([])
    expect(plan.unseated).toEqual([{ householdId: 'h1', reason: 'no_table_capacity' }])
  })

  it('leaves a household unseated when there is no existing table at all', () => {
    const households = [household({ id: 'h1' })]
    const guests = [guest({ id: 1, householdId: 'h1' })]

    const plan = planAutoSeating({
      households,
      guests,
      tables: [],
      fillFreeSeatsOnly: true,
    })

    expect(plan.assignments).toEqual([])
    expect(plan.unseated).toEqual([{ householdId: 'h1', reason: 'no_table_capacity' }])
  })

  it('shares a table between two households of the same side+group before splitting across tables', () => {
    const households = [
      household({ id: 'h1', side: 'Groom', groupName: 'Family' }),
      household({ id: 'h2', side: 'Groom', groupName: 'Family' }),
      household({ id: 'h3', side: 'Bride', groupName: 'Friends' }),
    ]
    const guests = [
      guest({ id: 1, householdId: 'h1' }),
      guest({ id: 2, householdId: 'h1' }),
      guest({ id: 3, householdId: 'h1' }),
      guest({ id: 4, householdId: 'h1' }),
      guest({ id: 5, householdId: 'h2' }),
      guest({ id: 6, householdId: 'h2' }),
      guest({ id: 7, householdId: 'h2' }),
      guest({ id: 8, householdId: 'h2' }),
      guest({ id: 9, householdId: 'h3' }),
      guest({ id: 10, householdId: 'h3' }),
      guest({ id: 11, householdId: 'h3' }),
      guest({ id: 12, householdId: 'h3' }),
    ]
    const tables: AutoSeatTable[] = [
      { id: 'table-1', name: 'שולחן 1', capacity: 8, guestIds: [] },
      { id: 'table-2', name: 'שולחן 2', capacity: 8, guestIds: [] },
    ]

    const plan = planAutoSeating({
      households,
      guests,
      tables,
      fillFreeSeatsOnly: true,
    })

    const tableByGuest = new Map(plan.assignments.map((a) => [a.guestId, a.tableId]))
    const groomTable = tableByGuest.get(1)
    expect(tableByGuest.get(5)).toBe(groomTable)
    const brideTable = tableByGuest.get(9)
    expect(brideTable).not.toBe(groomTable)
    expect(plan.unseated).toEqual([])
  })

  it('does nothing when there is nothing missing to seat', () => {
    const plan = planAutoSeating({
      households: [],
      guests: [],
      tables: [],
      fillFreeSeatsOnly: true,
    })

    expect(plan).toEqual({ assignments: [], unseated: [] })
  })

  it('never seats a guest who has not confirmed (Invited) for the event', () => {
    const households = [household({ id: 'h1' })]
    const guests = [
      guest({ id: 1, householdId: 'h1', rsvp: 'Invited' }),
      guest({ id: 2, householdId: 'h1', rsvp: 'Invited' }),
    ]
    const tables: AutoSeatTable[] = [{ id: 'table-1', name: 'שולחן 1', capacity: 8, guestIds: [] }]

    const plan = planAutoSeating({
      households,
      guests,
      tables,
      fillFreeSeatsOnly: true,
    })

    expect(plan.assignments).toEqual([])
    expect(plan.unseated).toEqual([])
  })

  it('weighs a household by its confirmed attendingCount, not its named-guest rows', () => {
    const households = [household({ id: 'h1', attendingCount: 4 })]
    const guests = [
      guest({ id: 1, householdId: 'h1', isPrimaryContact: true }),
      guest({ id: 2, householdId: 'h1' }),
    ]
    const tables: AutoSeatTable[] = [{ id: 'table-1', name: 'שולחן 1', capacity: 4, guestIds: [] }]

    const plan = planAutoSeating({
      households,
      guests,
      tables,
      fillFreeSeatsOnly: true,
    })

    expect(plan.assignments.map((a) => a.guestId).sort()).toEqual([1, 2])

    // The same household would overflow a table with only 3 free seats, even
    // though just 2 named guest rows are being placed.
    const tooSmall: AutoSeatTable[] = [
      { id: 'table-1', name: 'שולחן 1', capacity: 4, guestIds: [99] },
    ]
    const overflowPlan = planAutoSeating({
      households,
      guests: [...guests, guest({ id: 99, householdId: 'h2', seated: true })],
      tables: tooSmall,
      fillFreeSeatsOnly: true,
    })
    expect(overflowPlan.unseated).toEqual([{ householdId: 'h1', reason: 'no_table_capacity' }])
  })
})
