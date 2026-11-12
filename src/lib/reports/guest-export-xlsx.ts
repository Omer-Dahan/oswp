/**
 * Guest Export (Excel) - Pure Builder
 *
 * Turns confirmed guests for one event into rows laid out in the couple's
 * own Excel template (see guest-csv-import.schema.ts for the import side of
 * the same column set). No Prisma imports - callers pass in plain records
 * already scoped to the wedding.
 */

export interface GuestExportHousehold {
  id: string
  side: string | null
  groupName: string | null
  attendingCount: number | null
  phoneAlt: string | null
  city: string | null
  address1: string | null
  zipCode: string | null
  address2: string | null
  expectedCheck: number | null
}

export interface GuestExportGuest {
  id: number
  householdId: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  isPrimaryContact: boolean
}

export interface GuestExportInvitation {
  guestId: number
  eventId: string
  rsvp: string
}

export interface BuildGuestExportInput {
  households: GuestExportHousehold[]
  guests: GuestExportGuest[]
  invitations: GuestExportInvitation[]
  eventId: string
  /** Only households on this side are included. Omit to include every side. */
  side?: string
  /** Only households in this group are included. Omit to include every group. */
  groupName?: string
}

export interface GuestExportRow {
  affiliation: string
  honoreeName: string
  invitedCount: number
  side: string
  groupName: string
  mobile: string
  landline: string
  email: string
  city: string
  street: string
  zipCode: string
  poBox: string
  expectedCheck: number | ''
}

export const GUEST_EXPORT_HEADERS = [
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
] as const

/** The guest whose name/contact details represent the household on the export - the primary contact, or the first guest when none is marked. */
function leadGuestOf(
  householdId: string,
  guestsByHousehold: Map<string, GuestExportGuest[]>
): GuestExportGuest | undefined {
  const guestsInHousehold = guestsByHousehold.get(householdId) ?? []
  return guestsInHousehold.find((guest) => guest.isPrimaryContact) ?? guestsInHousehold[0]
}

/** "משפחת {lastName}" when there is a last name, else the lead guest's full name - matches the household label on the guest card and the seating rail. */
function honoreeNameOf(lead: GuestExportGuest | undefined): string {
  if (!lead) return ''
  return lead.lastName ? `משפחת ${lead.lastName}` : `${lead.firstName} ${lead.lastName}`.trim()
}

export function buildGuestExportRows(input: BuildGuestExportInput): GuestExportRow[] {
  const { households, guests, invitations, eventId, side, groupName } = input

  const guestsById = new Map(guests.map((guest) => [guest.id, guest]))
  const guestsByHousehold = new Map<string, GuestExportGuest[]>()
  for (const guest of guests) {
    const list = guestsByHousehold.get(guest.householdId) ?? []
    list.push(guest)
    guestsByHousehold.set(guest.householdId, list)
  }

  const attendingCountByHousehold = new Map<string, number>()
  for (const invitation of invitations) {
    if (invitation.eventId !== eventId || invitation.rsvp !== 'Attending') continue
    const guest = guestsById.get(invitation.guestId)
    if (!guest) continue
    attendingCountByHousehold.set(
      guest.householdId,
      (attendingCountByHousehold.get(guest.householdId) ?? 0) + 1
    )
  }

  const rows: GuestExportRow[] = []
  for (const household of households) {
    const attendingRows = attendingCountByHousehold.get(household.id) ?? 0
    if (attendingRows === 0) continue
    if (side !== undefined && household.side !== side) continue
    if (groupName !== undefined && household.groupName !== groupName) continue

    const lead = leadGuestOf(household.id, guestsByHousehold)

    rows.push({
      affiliation: [household.side, household.groupName].filter(Boolean).join(' · '),
      honoreeName: honoreeNameOf(lead),
      invitedCount: household.attendingCount ?? attendingRows,
      side: household.side ?? '',
      groupName: household.groupName ?? '',
      mobile: lead?.phone ?? '',
      landline: household.phoneAlt ?? '',
      email: lead?.email ?? '',
      city: household.city ?? '',
      street: household.address1 ?? '',
      zipCode: household.zipCode ?? '',
      poBox: household.address2 ?? '',
      expectedCheck: household.expectedCheck ?? '',
    })
  }

  return rows
}

function rowToArray(row: GuestExportRow): Array<string | number> {
  return [
    row.affiliation,
    row.honoreeName,
    row.invitedCount,
    row.side,
    row.groupName,
    row.mobile,
    row.landline,
    row.email,
    row.city,
    row.street,
    row.zipCode,
    row.poBox,
    row.expectedCheck,
  ]
}

const COLUMN_WIDTHS = [20, 24, 16, 10, 16, 14, 14, 24, 12, 20, 10, 12, 12]

export async function buildGuestExportWorkbook(
  rows: GuestExportRow[]
): Promise<import('exceljs').Workbook> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('אורחים מאושרים', { views: [{ rightToLeft: true }] })
  sheet.columns = COLUMN_WIDTHS.map((width, index) => ({ key: `c${index}`, width }))

  const sectionRow = sheet.addRow([])
  sheet.mergeCells(sectionRow.number, 1, sectionRow.number, 8)
  sheet.getCell(sectionRow.number, 1).value = 'פרטי התקשרות'
  sheet.mergeCells(sectionRow.number, 9, sectionRow.number, 12)
  sheet.getCell(sectionRow.number, 9).value = 'כתובת'
  sectionRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center' }
  })

  const headerRow = sheet.addRow([...GUEST_EXPORT_HEADERS])
  headerRow.font = { bold: true }

  for (const row of rows) {
    sheet.addRow(rowToArray(row))
  }

  return workbook
}
