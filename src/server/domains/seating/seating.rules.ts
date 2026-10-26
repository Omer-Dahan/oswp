/**
 * Seating Domain - Pure rules
 *
 * Shared by the service (authoritative checks) and the client (drop previews).
 */

import { RSVP_STATUS } from '~/lib/constants/rsvp'

// RSVP values that mean the guest will not be at the event
export const NON_SEATABLE_RSVPS = [RSVP_STATUS.DECLINED, RSVP_STATUS.NOT_INVITED] as const

export const MIN_TABLE_CAPACITY = 1
export const MAX_TABLE_CAPACITY = 30

type SeatWeights = ReadonlyMap<number, number>

const weightOf = (id: number, weights?: SeatWeights): number => weights?.get(id) ?? 1

const sumWeights = (ids: readonly number[], weights?: SeatWeights): number =>
  ids.reduce((total, id) => total + weightOf(id, weights), 0)

export const getSeatsNeeded = (
  seatedGuestIds: readonly number[],
  incomingGuestIds: readonly number[],
  weights?: SeatWeights
): number => {
  const seated = new Set(seatedGuestIds)
  const incoming = new Set(incomingGuestIds.filter((id) => !seated.has(id)))
  return sumWeights([...incoming], weights)
}

type TableSeats = { capacity: number; guestIds: readonly number[] }

// Total seats taken up by the guests already at the table
export const getOccupiedSeats = (
  guestIds: readonly number[],
  weights?: SeatWeights
): number => sumWeights(guestIds, weights)

export const getOpenSeats = (table: TableSeats, weights?: SeatWeights): number =>
  Math.max(0, table.capacity - getOccupiedSeats(table.guestIds, weights))

export const tableHasRoom = (
  table: TableSeats,
  incomingGuestIds: readonly number[],
  weights?: SeatWeights
): boolean =>
  getOccupiedSeats(table.guestIds, weights) +
    getSeatsNeeded(table.guestIds, incomingGuestIds, weights) <=
  table.capacity

export const openSeatsMessage = (tableName: string, openSeats: number): string =>
  `בשולחן ${tableName} נשארו ${openSeats} מקומות פנויים`

export const householdSeatsMessage = (
  tableName: string,
  openSeats: number,
  householdLabel: string,
  neededSeats: number
): string => `בשולחן ${tableName} נשארו ${openSeats} מקומות — ${householdLabel} צריכה ${neededSeats}`

// Household/guest shape needed to attribute a party's seats to one guest
type WeightableGuest = { id: number; isPrimaryContact: boolean }
export type WeightableHousehold = {
  invitedCount: number | null
  guests: readonly WeightableGuest[]
}

export const getPartySize = (household: WeightableHousehold): number =>
  Math.max(1, household.invitedCount ?? household.guests.length)

// Every named guest occupies one real seat. The primary contact additionally
// absorbs any unnamed plus-ones implied by invitedCount exceeding the number
// of named guests, so the household's total weight still equals its party
// size. A non-primary guest therefore always carries weight >= 1, so seating
// (or moving) them alone is never mistaken for a no-op.
export const getGuestWeights = (households: readonly WeightableHousehold[]): Map<number, number> => {
  const weights = new Map<number, number>()
  for (const household of households) {
    const primary = household.guests.find((guest) => guest.isPrimaryContact) ?? household.guests[0]
    if (!primary) continue
    const size = getPartySize(household)
    const othersCount = household.guests.length - 1
    const primaryWeight = Math.max(1, size - othersCount)
    for (const guest of household.guests) {
      weights.set(guest.id, guest.id === primary.id ? primaryWeight : 1)
    }
  }
  return weights
}
