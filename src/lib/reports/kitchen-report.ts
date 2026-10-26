/**
 * Kitchen Report - Pure Builder
 *
 * Turns the guest/seating data for one event into the rows and summary a
 * venue kitchen needs: who's eating, which households need a kids meal, and
 * who has a dietary restriction. No Prisma imports - callers pass in plain
 * records already scoped to the wedding.
 */

export type KitchenReportAgeGroup = 'INFANT' | 'CHILD' | 'TEEN' | 'ADULT'

const CHILD_AGE_GROUPS: ReadonlySet<KitchenReportAgeGroup> = new Set(['INFANT', 'CHILD'])

export interface KitchenReportHousehold {
  id: string
  childrenCount: number | null
  attendingCount: number | null
  dietaryNotes: string | null
}

export interface KitchenReportGuest {
  id: number
  firstName: string
  lastName: string
  householdId: string
  ageGroup: KitchenReportAgeGroup | null
}

export interface KitchenReportInvitation {
  guestId: number
  eventId: string
  rsvp: string
  dietaryRestrictions: string | null
}

export interface KitchenReportTable {
  id: string
  eventId: string
  name: string
}

export interface KitchenReportAssignment {
  guestId: number
  tableId: string
  eventId: string
}

export interface BuildKitchenReportInput {
  households: KitchenReportHousehold[]
  guests: KitchenReportGuest[]
  invitations: KitchenReportInvitation[]
  tables: KitchenReportTable[]
  assignments: KitchenReportAssignment[]
  eventId: string
}

export interface KitchenReportRow {
  guestId: number
  guestName: string
  householdName: string
  tableName: string | null
  isChild: boolean
  dietaryNote: string | null
}

export interface KitchenReportSummary {
  /** Everyone attending, adults and children. */
  attending: number
  /** The plates the kitchen actually cooks: attending guests over age 10 (TEEN/ADULT). */
  meals: number
  /** Attending children (CHILD/INFANT) — they eat off the family, no meal of their own. */
  children: number
  dietary: number
}

export interface KitchenReport {
  summary: KitchenReportSummary
  rows: KitchenReportRow[]
}

function householdName(
  household: KitchenReportHousehold,
  guestsInHousehold: KitchenReportGuest[]
): string {
  const primary = guestsInHousehold[0]
  return primary ? `${primary.firstName} ${primary.lastName}`.trim() : household.id
}

const UNSEATED_SORT_KEY = '￿'

export function buildKitchenReport(input: BuildKitchenReportInput): KitchenReport {
  const { households, guests, invitations, tables, assignments, eventId } = input

  const guestsById = new Map(guests.map((guest) => [guest.id, guest]))
  const householdsById = new Map(households.map((household) => [household.id, household]))
  const guestsByHousehold = new Map<string, KitchenReportGuest[]>()
  for (const guest of guests) {
    const list = guestsByHousehold.get(guest.householdId) ?? []
    list.push(guest)
    guestsByHousehold.set(guest.householdId, list)
  }

  const tableNameById = new Map(
    tables.filter((table) => table.eventId === eventId).map((table) => [table.id, table.name])
  )
  const tableIdByGuestId = new Map(
    assignments
      .filter((assignment) => assignment.eventId === eventId)
      .map((assignment) => [assignment.guestId, assignment.tableId])
  )

  const attendingInvitations = invitations.filter(
    (invitation) => invitation.eventId === eventId && invitation.rsvp === 'Attending'
  )

  const rows: KitchenReportRow[] = []
  const attendingGuestsByHousehold = new Map<string, KitchenReportGuest[]>()

  for (const invitation of attendingInvitations) {
    const guest = guestsById.get(invitation.guestId)
    if (!guest) continue

    const household = householdsById.get(guest.householdId)
    const guestsInHousehold = guestsByHousehold.get(guest.householdId) ?? []
    const isChild = guest.ageGroup !== null && CHILD_AGE_GROUPS.has(guest.ageGroup)
    const tableId = tableIdByGuestId.get(guest.id) ?? null
    const tableName = tableId ? tableNameById.get(tableId) ?? null : null
    const dietaryNote = invitation.dietaryRestrictions || household?.dietaryNotes || null

    rows.push({
      guestId: guest.id,
      guestName: `${guest.firstName} ${guest.lastName}`.trim(),
      householdName: household ? householdName(household, guestsInHousehold) : guest.householdId,
      tableName,
      isChild,
      dietaryNote,
    })

    const attendingInHousehold = attendingGuestsByHousehold.get(guest.householdId) ?? []
    attendingInHousehold.push(guest)
    attendingGuestsByHousehold.set(guest.householdId, attendingInHousehold)
  }

  rows.sort((a, b) => {
    const tableKey = (name: string | null) => name ?? UNSEATED_SORT_KEY
    return (
      tableKey(a.tableName).localeCompare(tableKey(b.tableName)) ||
      a.householdName.localeCompare(b.householdName) ||
      a.guestName.localeCompare(b.guestName)
    )
  })

  // Children attending (the RSVP answer, falling back to the guest rows) are
  // not a meal each: the kitchen cooks only for guests over age 10. The meal
  // count is therefore the named attending guests who are NOT children —
  // unnamed children (counted via childrenCount, never a guest row) never
  // enter the rows in the first place.
  let children = 0
  for (const [householdId, attendingInHousehold] of attendingGuestsByHousehold) {
    const household = householdsById.get(householdId)
    if (household?.childrenCount != null) {
      children += household.childrenCount
    } else {
      children += attendingInHousehold.filter(
        (guest) => guest.ageGroup !== null && CHILD_AGE_GROUPS.has(guest.ageGroup)
      ).length
    }
  }

  // A household's self-reported attendingCount (from the RSVP stepper) can
  // exceed the number of named Guest rows that RSVPed Attending — those
  // extras are unnamed guests the kitchen still has to feed.
  let extraUnnamedMeals = 0
  for (const [householdId, attendingInHousehold] of attendingGuestsByHousehold) {
    const household = householdsById.get(householdId)
    if (household?.attendingCount == null) continue
    extraUnnamedMeals += Math.max(0, household.attendingCount - attendingInHousehold.length)
  }

  const meals = rows.filter((row) => !row.isChild).length + extraUnnamedMeals

  // A household's dietaryNotes is one restriction shared by the family, not
  // one per guest - count it once per household, not once per row that
  // falls back to it. Per-guest invitation.dietaryRestrictions are distinct
  // and still counted individually.
  const householdsWithFallbackDietary = new Set<string>()
  let dietary = 0
  for (const invitation of attendingInvitations) {
    const guest = guestsById.get(invitation.guestId)
    if (!guest) continue
    if (invitation.dietaryRestrictions) {
      dietary += 1
    } else if (householdsById.get(guest.householdId)?.dietaryNotes) {
      householdsWithFallbackDietary.add(guest.householdId)
    }
  }
  dietary += householdsWithFallbackDietary.size

  return {
    summary: { attending: rows.length, meals, children, dietary },
    rows,
  }
}
