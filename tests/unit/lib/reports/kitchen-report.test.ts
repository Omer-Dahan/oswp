import {
  buildKitchenReport,
  type KitchenReportAssignment,
  type KitchenReportGuest,
  type KitchenReportHousehold,
  type KitchenReportInvitation,
  type KitchenReportTable,
} from '~/lib/reports/kitchen-report'

const EVENT_ID = 'event-1'

function household(overrides: Partial<KitchenReportHousehold> & { id: string }): KitchenReportHousehold {
  return { childrenCount: null, dietaryNotes: null, ...overrides }
}

function guest(overrides: Partial<KitchenReportGuest> & { id: number; householdId: string }): KitchenReportGuest {
  return { firstName: 'Guest', lastName: String(overrides.id), ageGroup: 'ADULT', ...overrides }
}

function invitation(
  overrides: Partial<KitchenReportInvitation> & { guestId: number }
): KitchenReportInvitation {
  return { eventId: EVENT_ID, rsvp: 'Attending', dietaryRestrictions: null, ...overrides }
}

describe('buildKitchenReport', () => {
  it('falls back to counting attending CHILD/INFANT guests when childrenCount is not declared', () => {
    const households = [household({ id: 'h1', childrenCount: null })]
    const guests = [
      guest({ id: 1, householdId: 'h1', ageGroup: 'ADULT' }),
      guest({ id: 2, householdId: 'h1', ageGroup: 'CHILD' }),
      guest({ id: 3, householdId: 'h1', ageGroup: 'INFANT' }),
    ]
    const invitations = [
      invitation({ guestId: 1 }),
      invitation({ guestId: 2 }),
      invitation({ guestId: 3 }),
    ]

    const report = buildKitchenReport({
      households,
      guests,
      invitations,
      tables: [],
      assignments: [],
      eventId: EVENT_ID,
    })

    expect(report.summary.kidsMeals).toBe(2)
    expect(report.rows.find((row) => row.guestId === 2)?.isChild).toBe(true)
    expect(report.rows.find((row) => row.guestId === 1)?.isChild).toBe(false)
  })

  it('uses the declared childrenCount instead of the fallback when present', () => {
    const households = [household({ id: 'h1', childrenCount: 3 })]
    const guests = [guest({ id: 1, householdId: 'h1', ageGroup: 'CHILD' })]
    const invitations = [invitation({ guestId: 1 })]

    const report = buildKitchenReport({
      households,
      guests,
      invitations,
      tables: [],
      assignments: [],
      eventId: EVENT_ID,
    })

    expect(report.summary.kidsMeals).toBe(3)
  })

  it('picks up a dietary note from either the per-guest invitation or the household', () => {
    const households = [
      household({ id: 'h1', dietaryNotes: null }),
      household({ id: 'h2', dietaryNotes: 'Kosher' }),
    ]
    const guests = [
      guest({ id: 1, householdId: 'h1' }),
      guest({ id: 2, householdId: 'h2' }),
      guest({ id: 3, householdId: 'h2' }),
    ]
    const invitations = [
      invitation({ guestId: 1, dietaryRestrictions: 'Gluten-free' }),
      invitation({ guestId: 2 }),
      invitation({ guestId: 3 }),
    ]

    const report = buildKitchenReport({
      households,
      guests,
      invitations,
      tables: [],
      assignments: [],
      eventId: EVENT_ID,
    })

    expect(report.summary.dietary).toBe(3)
    expect(report.rows.find((row) => row.guestId === 1)?.dietaryNote).toBe('Gluten-free')
    expect(report.rows.find((row) => row.guestId === 2)?.dietaryNote).toBe('Kosher')
    expect(report.rows.find((row) => row.guestId === 3)?.dietaryNote).toBe('Kosher')
  })

  it('orders rows deterministically by table, then household, then guest name', () => {
    const households = [household({ id: 'h1' }), household({ id: 'h2' })]
    const guests = [
      guest({ id: 1, householdId: 'h1', firstName: 'Zohar', lastName: 'Cohen' }),
      guest({ id: 2, householdId: 'h2', firstName: 'Amit', lastName: 'Levi' }),
    ]
    const invitations = [invitation({ guestId: 1 }), invitation({ guestId: 2 })]
    const tables: KitchenReportTable[] = [
      { id: 't1', eventId: EVENT_ID, name: 'Table A' },
      { id: 't2', eventId: EVENT_ID, name: 'Table B' },
    ]
    const assignments: KitchenReportAssignment[] = [
      { guestId: 1, tableId: 't2', eventId: EVENT_ID },
      { guestId: 2, tableId: 't1', eventId: EVENT_ID },
    ]

    const report = buildKitchenReport({
      households,
      guests,
      invitations,
      tables,
      assignments,
      eventId: EVENT_ID,
    })

    expect(report.rows.map((row) => row.guestId)).toEqual([2, 1])
    expect(report.rows[0]?.tableName).toBe('Table A')
    expect(report.rows[1]?.tableName).toBe('Table B')
  })

  it('counts unnamed extras per household across all events, not just the current one', () => {
    const CHUPPAH_EVENT_ID = 'event-chuppah'
    const households = [household({ id: 'h1', attendingCount: 3 })]
    const guests = [
      guest({ id: 1, householdId: 'h1' }),
      guest({ id: 2, householdId: 'h1' }),
    ]
    const invitations = [
      invitation({ guestId: 1, eventId: EVENT_ID }),
      invitation({ guestId: 1, eventId: CHUPPAH_EVENT_ID }),
      invitation({ guestId: 2, eventId: EVENT_ID }),
    ]

    const chuppahReport = buildKitchenReport({
      households,
      guests,
      invitations,
      tables: [],
      assignments: [],
      eventId: CHUPPAH_EVENT_ID,
    })

    expect(chuppahReport.summary.attending).toBe(2)
    expect(chuppahReport.summary.meals).toBe(2)
    expect(chuppahReport.summary.children).toBe(0)
  })

  it('caps a household declared childrenCount at its own headcount for this event', () => {
    const households = [household({ id: 'h1', childrenCount: 5 })]
    const guests = [guest({ id: 1, householdId: 'h1', ageGroup: 'ADULT' })]
    const invitations = [invitation({ guestId: 1 })]

    const report = buildKitchenReport({
      households,
      guests,
      invitations,
      tables: [],
      assignments: [],
      eventId: EVENT_ID,
    })

    expect(report.summary.meals).toBe(0)
    expect(report.summary.children).toBe(1)
    expect(report.summary.attending).toBe(report.summary.meals + report.summary.children)
  })

  it("does not let one household's over-declared childrenCount eat another household's meals", () => {
    const households = [
      household({ id: 'h1', childrenCount: 5 }),
      household({ id: 'h2', childrenCount: null }),
    ]
    const guests = [
      guest({ id: 1, householdId: 'h1', ageGroup: 'ADULT' }),
      guest({ id: 2, householdId: 'h2', ageGroup: 'ADULT' }),
      guest({ id: 3, householdId: 'h2', ageGroup: 'ADULT' }),
    ]
    const invitations = [
      invitation({ guestId: 1 }),
      invitation({ guestId: 2 }),
      invitation({ guestId: 3 }),
    ]

    const report = buildKitchenReport({
      households,
      guests,
      invitations,
      tables: [],
      assignments: [],
      eventId: EVENT_ID,
    })

    expect(report.summary.children).toBe(1)
    expect(report.summary.meals).toBe(2)
    expect(report.summary.attending).toBe(3)
  })

  it('reports a null tableName for an event with no seating assignments', () => {
    const households = [household({ id: 'h1' })]
    const guests = [guest({ id: 1, householdId: 'h1' })]
    const invitations = [invitation({ guestId: 1 })]

    const report = buildKitchenReport({
      households,
      guests,
      invitations,
      tables: [],
      assignments: [],
      eventId: EVENT_ID,
    })

    expect(report.rows).toHaveLength(1)
    expect(report.rows[0]?.tableName).toBeNull()
  })
})
