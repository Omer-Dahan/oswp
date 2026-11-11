import { suggestPlacements, type SeatingGroup, type SeatingHousehold, type SeatingTable } from '~/lib/seating/seating-score'

const table = (overrides: Partial<SeatingTable>): SeatingTable => ({
  id: 't1',
  name: 'שולחן 1',
  capacity: 10,
  positionX: 0,
  positionY: 0,
  guestIds: [],
  ...overrides,
})

const household = (overrides: Partial<SeatingHousehold>): SeatingHousehold => ({
  id: 'h1',
  side: null,
  groupName: null,
  seatWeight: 2,
  guestIds: [],
  ...overrides,
})

describe('suggestPlacements', () => {
  it('prefers a table that already seats the same group over an identically-sized empty table', () => {
    const existingHousehold = household({ id: 'h-existing', side: 'bride', groupName: 'friends', guestIds: [1, 2] })
    const groupHousehold = household({ id: 'h-new', side: 'bride', groupName: 'friends', seatWeight: 2 })
    const group: SeatingGroup = { side: 'bride', groupName: 'friends', households: [groupHousehold] }

    const tableWithGroup = table({ id: 'tA', name: 'A', capacity: 10, guestIds: [1, 2] })
    const emptyTable = table({ id: 'tB', name: 'B', capacity: 10, guestIds: [] })

    const results = suggestPlacements({
      group,
      tables: [tableWithGroup, emptyTable],
      households: [existingHousehold, groupHousehold],
    })

    expect(results[0]?.tableId).toBe('tA')
  })

  it('prefers a table of the same side over an empty table', () => {
    const existingHousehold = household({ id: 'h-existing', side: 'groom', groupName: 'other', guestIds: [1, 2] })
    const groupHousehold = household({ id: 'h-new', side: 'groom', groupName: 'friends', seatWeight: 2 })
    const group: SeatingGroup = { side: 'groom', groupName: 'friends', households: [groupHousehold] }

    const sameSideTable = table({ id: 'tA', name: 'A', capacity: 10, guestIds: [1, 2] })
    const emptyTable = table({ id: 'tB', name: 'B', capacity: 10, guestIds: [] })

    const results = suggestPlacements({
      group,
      tables: [sameSideTable, emptyTable],
      households: [existingHousehold, groupHousehold],
    })

    expect(results[0]?.tableId).toBe('tA')
  })

  it('between two tables equal in affinity/side match, the nearer one to the group wins', () => {
    const anchorHouseholdA = household({ id: 'h-anchor-a', side: 'bride', groupName: 'friends', guestIds: [1, 2] })
    const anchorHouseholdB = household({ id: 'h-anchor-b', side: 'bride', groupName: 'friends', guestIds: [3, 4] })
    const groupHousehold = household({ id: 'h-new', side: 'bride', groupName: 'friends', seatWeight: 2 })
    const group: SeatingGroup = { side: 'bride', groupName: 'friends', households: [groupHousehold] }

    // Anchors fix the group's center of gravity at x=10; both candidates are
    // empty (no affinity/side match), so only distance should separate them.
    const anchorA = table({ id: 'anchorA', name: 'AnchorA', capacity: 10, positionX: 0, positionY: 0, guestIds: [1, 2] })
    const anchorB = table({ id: 'anchorB', name: 'AnchorB', capacity: 10, positionX: 20, positionY: 0, guestIds: [3, 4] })
    const nearTable = table({ id: 'near', name: 'Near', capacity: 10, positionX: 10, positionY: 5, guestIds: [] })
    const farTable = table({ id: 'far', name: 'Far', capacity: 10, positionX: 100, positionY: 5, guestIds: [] })

    const results = suggestPlacements({
      group,
      tables: [anchorA, anchorB, nearTable, farTable],
      households: [anchorHouseholdA, anchorHouseholdB, groupHousehold],
      maxResults: 4,
    })

    const nearRank = results.findIndex((result) => result.tableId === 'near')
    const farRank = results.findIndex((result) => result.tableId === 'far')
    expect(nearRank).toBeLessThan(farRank)
  })

  it('penalizes wasted seats, preferring a table matched in size over an oversized one', () => {
    const groupHousehold = household({ id: 'h-new', side: null, groupName: null, seatWeight: 2 })
    const group: SeatingGroup = { side: null, groupName: null, households: [groupHousehold] }

    const rightSizedTable = table({ id: 'small', name: 'Small', capacity: 2, guestIds: [] })
    const oversizedTable = table({ id: 'big', name: 'Big', capacity: 20, guestIds: [] })

    const results = suggestPlacements({
      group,
      tables: [rightSizedTable, oversizedTable],
      households: [groupHousehold],
    })

    expect(results[0]?.tableId).toBe('small')
  })

  it('is deterministic across repeated runs on the same input', () => {
    const groupHousehold = household({ id: 'h-new', side: 'bride', groupName: 'friends', seatWeight: 2 })
    const group: SeatingGroup = { side: 'bride', groupName: 'friends', households: [groupHousehold] }
    const tables = [
      table({ id: 't1', name: 'One', capacity: 10, positionX: 5, positionY: 5, guestIds: [] }),
      table({ id: 't2', name: 'Two', capacity: 10, positionX: 15, positionY: 5, guestIds: [] }),
      table({ id: 't3', name: 'Three', capacity: 10, positionX: 25, positionY: 5, guestIds: [] }),
    ]

    const run1 = suggestPlacements({ group, tables, households: [groupHousehold] })
    const run2 = suggestPlacements({ group, tables, households: [groupHousehold] })

    expect(run1).toEqual(run2)
  })

  it('includes the table name and group name in the reason', () => {
    const groupHousehold = household({ id: 'h-new', side: 'bride', groupName: 'משפחה', seatWeight: 2 })
    const group: SeatingGroup = { side: 'bride', groupName: 'משפחה', households: [groupHousehold] }
    const onlyTable = table({ id: 't1', name: 'עשירי', capacity: 10, guestIds: [] })

    const results = suggestPlacements({ group, tables: [onlyTable], households: [groupHousehold] })

    expect(results[0]?.reason).toContain('עשירי')
    expect(results[0]?.reason).toContain('משפחה')
  })
})
