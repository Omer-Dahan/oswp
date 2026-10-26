/**
 * Auto-seat planner - pure, deterministic. No Prisma, no randomness.
 *
 * Buckets guests by household (a household is never split), then places each
 * bucket at an existing table with free seats, or opens a new table when none
 * fits. The caller is responsible for turning the plan into database writes.
 */

import {
  MAX_TABLE_CAPACITY,
  NON_SEATABLE_RSVPS,
  getGuestWeights,
  getOccupiedSeats,
} from '~/server/domains/seating/seating.rules'

export type AutoSeatHousehold = {
  id: string
  side: string | null
  groupName: string | null
  invitedCount: number | null
}

export type AutoSeatGuest = {
  id: number
  householdId: string
  isPrimaryContact: boolean
  rsvp: string
  // Already seated for this event, regardless of source
  seated: boolean
}

export type AutoSeatTable = {
  id: string
  name: string
  capacity: number
  guestIds: number[]
}

export type AutoSeatOptions = {
  households: AutoSeatHousehold[]
  guests: AutoSeatGuest[]
  tables: AutoSeatTable[]
  tableCapacity: number
  fillFreeSeatsOnly: boolean
}

export type AutoSeatPlan = {
  assignments: { guestId: number; tableId: string }[]
  newTables: { name: string; capacity: number }[]
  unseated: { householdId: string; reason: 'too_large' | 'no_room' }[]
}

type Bucket = {
  householdId: string
  side: string | null
  groupName: string | null
  guestIds: number[]
  size: number
}

type WorkingTable = {
  key: string
  capacity: number
  freeSeats: number
  tags: Set<string>
}

const tagOf = (side: string | null, groupName: string | null): string => `${side ?? ''}\u0000${groupName ?? ''}`

const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const compareBuckets = (a: Bucket, b: Bucket): number =>
  cmpStr(a.side ?? '', b.side ?? '') ||
  cmpStr(a.groupName ?? '', b.groupName ?? '') ||
  b.size - a.size ||
  cmpStr(a.householdId, b.householdId)

const TABLE_NAME_PATTERN = /^שולחן (\d+)$/

const nextTableNumber = (names: readonly string[]): number => {
  let max = 0
  for (const name of names) {
    const match = TABLE_NAME_PATTERN.exec(name)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

const NON_SEATABLE: readonly string[] = NON_SEATABLE_RSVPS

// Group weight must match the capacity check: the sum of the weights of the
// guests actually being placed, never the household's raw invitedCount.
const buildBuckets = (
  households: readonly AutoSeatHousehold[],
  guests: readonly AutoSeatGuest[],
  weights: ReadonlyMap<number, number>
): Bucket[] => {
  const householdsById = new Map(households.map((household) => [household.id, household]))
  const eligible = guests.filter((guest) => !NON_SEATABLE.includes(guest.rsvp) && !guest.seated)

  const byHousehold = new Map<string, AutoSeatGuest[]>()
  for (const guest of eligible) {
    const bucket = byHousehold.get(guest.householdId)
    if (bucket) bucket.push(guest)
    else byHousehold.set(guest.householdId, [guest])
  }

  const buckets: Bucket[] = []
  for (const [householdId, bucketGuests] of byHousehold) {
    const household = householdsById.get(householdId)
    const guestIds = bucketGuests.map((guest) => guest.id)
    const size = guestIds.reduce((total, id) => total + (weights.get(id) ?? 1), 0)
    buckets.push({
      householdId,
      side: household?.side ?? null,
      groupName: household?.groupName ?? null,
      guestIds,
      size,
    })
  }
  return buckets.sort(compareBuckets)
}

export const planAutoSeating = (options: AutoSeatOptions): AutoSeatPlan => {
  const { households, guests, tables, tableCapacity, fillFreeSeatsOnly } = options

  // Declined guests carry no weight: excluded from the household's guest list
  // entirely, same as the service's findSeatWeights.
  const weights = getGuestWeights(
    households.map((household) => ({
      invitedCount: household.invitedCount,
      guests: guests
        .filter((guest) => guest.householdId === household.id && !NON_SEATABLE.includes(guest.rsvp))
        .map((guest) => ({ id: guest.id, isPrimaryContact: guest.isPrimaryContact })),
    }))
  )

  const buckets = buildBuckets(households, guests, weights)

  const maxCapacity = Math.min(
    MAX_TABLE_CAPACITY,
    Math.max(tableCapacity, ...tables.map((table) => table.capacity), 0)
  )

  const pool: WorkingTable[] = fillFreeSeatsOnly
    ? tables.map((table) => ({
        key: table.id,
        capacity: table.capacity,
        freeSeats: Math.max(0, table.capacity - getOccupiedSeats(table.guestIds, weights)),
        tags: new Set<string>(),
      }))
    : []

  // Side+group tags of the guests already seated at each pre-existing table,
  // so a new household of the same side+group prefers to join them
  if (fillFreeSeatsOnly) {
    const guestHouseholdId = new Map(guests.map((guest) => [guest.id, guest.householdId]))
    const householdsById = new Map(households.map((household) => [household.id, household]))
    for (const [index, table] of tables.entries()) {
      for (const guestId of table.guestIds) {
        const householdId = guestHouseholdId.get(guestId)
        const household = householdId ? householdsById.get(householdId) : undefined
        if (household) pool[index]?.tags.add(tagOf(household.side, household.groupName))
      }
    }
  }

  const names = tables.map((table) => table.name)
  const newTables: { name: string; capacity: number }[] = []
  const assignments: { guestId: number; tableId: string }[] = []
  const unseated: { householdId: string; reason: 'too_large' | 'no_room' }[] = []

  const openNewTable = (size: number): WorkingTable => {
    const capacity = Math.max(tableCapacity, size)
    const name = `שולחן ${nextTableNumber([...names, ...newTables.map((table) => table.name)])}`
    newTables.push({ name, capacity })
    const table: WorkingTable = {
      key: `new:${newTables.length - 1}`,
      capacity,
      freeSeats: capacity,
      tags: new Set<string>(),
    }
    pool.push(table)
    return table
  }

  // Tightest fit first, so a table fills up before another one is opened
  const bestFit = (candidates: readonly WorkingTable[], size: number): WorkingTable | undefined =>
    candidates
      .filter((table) => table.freeSeats >= size)
      .sort((a, b) => a.freeSeats - b.freeSeats)[0]

  for (const bucket of buckets) {
    if (bucket.size > maxCapacity) {
      unseated.push({ householdId: bucket.householdId, reason: 'too_large' })
      continue
    }

    // A table already holding the same side+group is preferred; failing
    // that, any table with room is packed full before a new one opens
    const tag = tagOf(bucket.side, bucket.groupName)
    const target =
      bestFit(pool.filter((table) => table.tags.has(tag)), bucket.size) ??
      bestFit(pool, bucket.size) ??
      openNewTable(bucket.size)

    target.freeSeats -= bucket.size
    target.tags.add(tag)
    for (const guestId of bucket.guestIds) {
      assignments.push({ guestId, tableId: target.key })
    }
  }

  return { assignments, newTables, unseated }
}
