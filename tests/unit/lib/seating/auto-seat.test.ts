import {
  type AutoSeatGuest,
  type AutoSeatHousehold,
  type AutoSeatTable,
  planAutoSeating,
} from '~/lib/seating/auto-seat'

const household = (overrides: Partial<AutoSeatHousehold> & { id: string }): AutoSeatHousehold => ({
  side: null,
  groupName: null,
  invitedCount: null,
  ...overrides,
})

const guest = (overrides: Partial<AutoSeatGuest> & { id: number; householdId: string }): AutoSeatGuest => ({
  isPrimaryContact: true,
  rsvp: 'Attending',
  seated: false,
  ...overrides,
})

describe('planAutoSeating', () => {
  it('seats two households of 4 at one table of 8', () => {
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

    const plan = planAutoSeating({
      households,
      guests,
      tables: [],
      tableCapacity: 8,
      fillFreeSeatsOnly: true,
    })

    expect(plan.unseated).toEqual([])
    expect(plan.newTables).toEqual([{ name: 'שולחן 1', capacity: 8 }])
    const tableIds = new Set(plan.assignments.map((assignment) => assignment.tableId))
    expect(tableIds.size).toBe(1)
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
      tableCapacity: 8,
      fillFreeSeatsOnly: true,
    })

    expect(plan.assignments).toEqual([])
    expect(plan.newTables).toEqual([])
    expect(plan.unseated).toEqual([])
  })

  it('reports a household of 12 as too_large for capacity 8 and opens no table for it', () => {
    const households = [household({ id: 'h1' })]
    const guests = Array.from({ length: 12 }, (_, index) =>
      guest({ id: index + 1, householdId: 'h1' })
    )

    const plan = planAutoSeating({
      households,
      guests,
      tables: [],
      tableCapacity: 8,
      fillFreeSeatsOnly: true,
    })

    expect(plan.assignments).toEqual([])
    expect(plan.newTables).toEqual([])
    expect(plan.unseated).toEqual([{ householdId: 'h1', reason: 'too_large' }])
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

    const plan = planAutoSeating({
      households,
      guests,
      tables: [],
      tableCapacity: 8,
      fillFreeSeatsOnly: true,
    })

    expect(plan.newTables).toEqual([
      { name: 'שולחן 1', capacity: 8 },
      { name: 'שולחן 2', capacity: 8 },
    ])
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
      tableCapacity: 8,
      fillFreeSeatsOnly: true,
    })

    expect(plan).toEqual({ assignments: [], newTables: [], unseated: [] })
  })
})
