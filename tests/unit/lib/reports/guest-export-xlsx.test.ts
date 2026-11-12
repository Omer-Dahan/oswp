import {
  buildGuestExportRows,
  GUEST_EXPORT_HEADERS,
  type GuestExportGuest,
  type GuestExportHousehold,
  type GuestExportInvitation,
} from '~/lib/reports/guest-export-xlsx'

const EVENT_ID = 'event-1'

function household(
  overrides: Partial<GuestExportHousehold> & { id: string }
): GuestExportHousehold {
  return {
    side: null,
    groupName: null,
    attendingCount: null,
    phoneAlt: null,
    city: null,
    address1: null,
    zipCode: null,
    address2: null,
    expectedCheck: null,
    ...overrides,
  }
}

function guest(
  overrides: Partial<GuestExportGuest> & { id: number; householdId: string }
): GuestExportGuest {
  return {
    firstName: 'Guest',
    lastName: String(overrides.id),
    phone: null,
    email: null,
    isPrimaryContact: false,
    ...overrides,
  }
}

function invitation(
  overrides: Partial<GuestExportInvitation> & { guestId: number }
): GuestExportInvitation {
  return { eventId: EVENT_ID, rsvp: 'Attending', ...overrides }
}

describe('GUEST_EXPORT_HEADERS', () => {
  it('has the 13 headers in the exact required order', () => {
    expect(GUEST_EXPORT_HEADERS).toEqual([
      'שיוך',
      'הזמנה לכבוד',
      "מס' אורחים שהוזמנו",
      'צד',
      'קבוצה',
      'סלולרי',
      'טלפון רגיל',
      'אימייל',
      'עיר',
      'רחוב',
      'מיקוד',
      'תא דואר',
      "צ'ק צפוי",
    ])
  })
})

describe('buildGuestExportRows', () => {
  it('excludes a household with no Attending invitation to the event', () => {
    const households = [household({ id: 'h1' })]
    const guests = [guest({ id: 1, householdId: 'h1' })]
    const invitations = [invitation({ guestId: 1, rsvp: 'Invited' })]

    const rows = buildGuestExportRows({ households, guests, invitations, eventId: EVENT_ID })

    expect(rows).toHaveLength(0)
  })

  it('uses the household attendingCount, not the count of named Attending rows', () => {
    const households = [household({ id: 'h1', attendingCount: 3 })]
    const guests = [
      guest({ id: 1, householdId: 'h1', lastName: 'כהן' }),
      guest({ id: 2, householdId: 'h1' }),
    ]
    const invitations = [
      invitation({ guestId: 1 }),
      invitation({ guestId: 2 }),
    ]

    const rows = buildGuestExportRows({ households, guests, invitations, eventId: EVENT_ID })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.invitedCount).toBe(3)
  })

  it('falls back to the count of named Attending rows when attendingCount is null', () => {
    const households = [household({ id: 'h1', attendingCount: null })]
    const guests = [
      guest({ id: 1, householdId: 'h1' }),
      guest({ id: 2, householdId: 'h1' }),
    ]
    const invitations = [invitation({ guestId: 1 }), invitation({ guestId: 2 })]

    const rows = buildGuestExportRows({ households, guests, invitations, eventId: EVENT_ID })

    expect(rows[0]?.invitedCount).toBe(2)
  })

  it('composes the affiliation column from side and group, and the group column from the group alone', () => {
    const households = [household({ id: 'h1', side: 'חתן', groupName: 'חברים' })]
    const guests = [guest({ id: 1, householdId: 'h1' })]
    const invitations = [invitation({ guestId: 1 })]

    const rows = buildGuestExportRows({ households, guests, invitations, eventId: EVENT_ID })

    expect(rows[0]?.affiliation).toBe('חתן · חברים')
    expect(rows[0]?.groupName).toBe('חברים')
    expect(rows[0]?.side).toBe('חתן')
  })

  it('filters by side, returning only households on that side', () => {
    const households = [
      household({ id: 'h1', side: 'חתן' }),
      household({ id: 'h2', side: 'כלה' }),
    ]
    const guests = [
      guest({ id: 1, householdId: 'h1' }),
      guest({ id: 2, householdId: 'h2' }),
    ]
    const invitations = [invitation({ guestId: 1 }), invitation({ guestId: 2 })]

    const rows = buildGuestExportRows({
      households,
      guests,
      invitations,
      eventId: EVENT_ID,
      side: 'חתן',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.side).toBe('חתן')
  })
})
