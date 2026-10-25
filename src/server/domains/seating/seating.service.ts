import { TRPCError } from '@trpc/server'

import { planAutoSeating } from '~/lib/seating/auto-seat'
import { getNextTablePosition } from '~/components/seating-chart/seating-layout'
import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import {
  SeatAlreadyTakenError,
  SeatingTableNotFoundError,
} from '~/server/domains/seating/seating.errors'
import type { SeatingRepository } from '~/server/domains/seating/seating.repository'
import {
  getOccupiedSeats,
  getOpenSeats,
  getSeatsNeeded,
  openSeatsMessage,
  tableHasRoom,
} from '~/server/domains/seating/seating.rules'
import type {
  AssignGuestsInput,
  AutoSeatInput,
  AutoSeatResult,
  CreateSeatingTableInput,
  SeatableGuestRecord,
  SeatingChart,
  SeatingHousehold,
  SeatingTable,
  SeatingTableLock,
  UnassignGuestsInput,
  UpdateSeatingTableInput,
} from '~/server/domains/seating/seating.types'

const formatAddress = (household: SeatableGuestRecord['guest']['household']): string | null => {
  const cityLine = [household.city, [household.state, household.zipCode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const parts = [household.address1, household.address2, cityLine, household.country].filter(
    Boolean
  )
  return parts.length > 0 ? parts.join(', ') : null
}

const groupByHousehold = (records: SeatableGuestRecord[]): SeatingHousehold[] => {
  const households = new Map<string, SeatingHousehold>()

  for (const { rsvp, dietaryRestrictions, guest } of records) {
    let household = households.get(guest.householdId)
    if (!household) {
      household = {
        id: guest.household.id,
        address: formatAddress(guest.household),
        notes: guest.household.notes,
        invitedCount: guest.household.invitedCount,
        guests: [],
      }
      households.set(guest.householdId, household)
    }
    household.guests.push({
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      phone: guest.phone,
      ageGroup: guest.ageGroup,
      isPrimaryContact: guest.isPrimaryContact,
      isTagAlong: guest.isTagAlong,
      householdId: guest.householdId,
      rsvp,
      dietaryRestrictions,
      tags: guest.guestTagAssignments.map((assignment) => assignment.guestTag.name),
      tableId: guest.seatAssignments[0]?.tableId ?? null,
    })
  }

  const sorted = [...households.values()]
  for (const household of sorted) {
    household.guests.sort(
      (a, b) => Number(b.isPrimaryContact) - Number(a.isPrimaryContact) || a.id - b.id
    )
  }
  return sorted.sort((a, b) => {
    const aName = `${a.guests[0]?.lastName ?? ''} ${a.guests[0]?.firstName ?? ''}`
    const bName = `${b.guests[0]?.lastName ?? ''} ${b.guests[0]?.firstName ?? ''}`
    return aName.localeCompare(bName)
  })
}

export class SeatingService {
  constructor(private repo: SeatingRepository) {}

  async getChart(ctx: AuthzContext, weddingId: string, eventId: string): Promise<SeatingChart> {
    requirePermission(ctx, { event: ['read'], guest: ['read'] })
    await this.assertEventInWedding(eventId, weddingId)

    const [tables, guests] = await Promise.all([
      this.repo.findTablesByEventId(eventId),
      this.repo.findSeatableGuests(eventId),
    ])

    return {
      tables: tables.map((table) => ({
        id: table.id,
        name: table.name,
        shape: table.shape,
        capacity: table.capacity,
        positionX: table.positionX,
        positionY: table.positionY,
        guestIds: table.seatAssignments.map((assignment) => assignment.guestId),
      })),
      households: groupByHousehold(guests),
    }
  }

  async createTable(
    ctx: AuthzContext,
    weddingId: string,
    input: CreateSeatingTableInput
  ): Promise<SeatingTable> {
    requirePermission(ctx, { event: ['update'] })
    await this.assertEventInWedding(input.eventId, weddingId)
    return this.repo.createTable({ ...input, weddingId })
  }

  async updateTable(
    ctx: AuthzContext,
    weddingId: string,
    id: string,
    data: UpdateSeatingTableInput
  ): Promise<SeatingTable> {
    requirePermission(ctx, { event: ['update'] })
    const table = await this.getTableInWedding(id, weddingId)

    return this.withLockedTable(table, async (lock) => {
      if (data.capacity !== undefined) {
        const [seatedGuestIds, weights] = await Promise.all([
          lock.seatedGuestIds(),
          this.repo.findSeatWeights(table.eventId),
        ])
        const seatedCount = getOccupiedSeats(seatedGuestIds, weights)
        if (data.capacity < seatedCount) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `יש בשולחן ${lock.table.name} ${seatedCount} מקומות תפוסים, הזיזו אורחים לפני הקטנת מספר המקומות`,
          })
        }
      }
      return lock.updateTable(data)
    })
  }

  async deleteTable(ctx: AuthzContext, weddingId: string, id: string): Promise<SeatingTable> {
    requirePermission(ctx, { event: ['update'] })
    await this.getTableInWedding(id, weddingId)
    return this.repo.deleteTable(id)
  }

  async assignGuests(
    ctx: AuthzContext,
    weddingId: string,
    input: AssignGuestsInput
  ): Promise<void> {
    requirePermission(ctx, { event: ['update'] })
    const table = await this.getTableInWedding(input.tableId, weddingId)
    const guestIds = [...new Set(input.guestIds)]

    const seatableIds = new Set(await this.repo.findSeatableGuestIds(table.eventId, guestIds))
    if (guestIds.some((id) => !seatableIds.has(id))) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'רק אורחים שהוזמנו לאירוע ולא סירבו יכולים להיות משובצים',
      })
    }

    const weights = await this.repo.findSeatWeights(table.eventId)

    await this.withLockedTable(table, async (lock) => {
      const { capacity, name } = lock.table
      const seatedGuestIds = await lock.seatedGuestIds()
      const seats = { capacity, guestIds: seatedGuestIds }
      if (!tableHasRoom(seats, guestIds, weights)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: openSeatsMessage(name, getOpenSeats(seats, weights)),
        })
      }

      if (getSeatsNeeded(seatedGuestIds, guestIds, weights) === 0) return
      await lock.replaceAssignments(guestIds)
    })
  }

  async unassignGuests(
    ctx: AuthzContext,
    weddingId: string,
    input: UnassignGuestsInput
  ): Promise<void> {
    requirePermission(ctx, { event: ['update'] })
    await this.assertEventInWedding(input.eventId, weddingId)
    await this.repo.deleteAssignments(input.eventId, input.guestIds)
  }

  /**
   * Seats every eligible, not-yet-seated household the planner can place.
   * Additive only: it creates new tables and AUTO assignments, and never
   * touches a seat a planner (or an earlier auto-seat run) already made.
   */
  async autoSeat(
    ctx: AuthzContext,
    weddingId: string,
    input: AutoSeatInput
  ): Promise<AutoSeatResult> {
    requirePermission(ctx, { event: ['update'] })
    await this.assertEventInWedding(input.eventId, weddingId)

    const [tables, invitations] = await Promise.all([
      this.repo.findTablesByEventId(input.eventId),
      this.repo.findAutoSeatGuests(input.eventId),
    ])

    const householdsById = new Map<
      string,
      { id: string; side: string | null; groupName: string | null; invitedCount: number | null }
    >()
    const guests = invitations.map((invitation) => {
      const { household } = invitation.guest
      if (!householdsById.has(household.id)) householdsById.set(household.id, household)
      return {
        id: invitation.guest.id,
        householdId: invitation.guest.householdId,
        isPrimaryContact: invitation.guest.isPrimaryContact,
        rsvp: invitation.rsvp,
        seated: invitation.guest.seatAssignments.length > 0,
      }
    })

    const plan = planAutoSeating({
      households: [...householdsById.values()],
      guests,
      tables: tables.map((table) => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        guestIds: table.seatAssignments.map((assignment) => assignment.guestId),
      })),
      tableCapacity: input.tableCapacity,
      fillFreeSeatsOnly: input.fillFreeSeatsOnly,
    })

    if (plan.assignments.length === 0 && plan.newTables.length === 0) {
      return { seated: 0, createdTables: 0, unseated: plan.unseated.length }
    }

    // Places each new table on the floor plan in turn, so none overlaps an
    // existing table or one placed earlier in this same run
    const placed: Array<{
      positionX: number
      positionY: number
      shape: 'ROUND'
      capacity: number
    }> = tables.map((table) => ({
      positionX: table.positionX,
      positionY: table.positionY,
      shape: 'ROUND',
      capacity: table.capacity,
    }))
    const newTables = plan.newTables.map((table) => {
      const position = getNextTablePosition(placed, { shape: 'ROUND', capacity: table.capacity })
      const positionX = position?.x ?? 0
      const positionY = position?.y ?? 0
      placed.push({ positionX, positionY, shape: 'ROUND', capacity: table.capacity })
      return { ...table, positionX, positionY }
    })

    await this.repo.createAutoSeating(weddingId, input.eventId, newTables, plan.assignments)

    return {
      seated: plan.assignments.length,
      createdTables: plan.newTables.length,
      unseated: plan.unseated.length,
    }
  }

  /**
   * Runs work under the table's row lock, translating concurrent-edit errors
   * from the repository into user-facing tRPC errors.
   */
  private async withLockedTable<T>(
    table: { id: string; eventId: string },
    work: (lock: SeatingTableLock) => Promise<T>
  ): Promise<T> {
    try {
      return await this.repo.withLockedTable({ id: table.id, eventId: table.eventId }, work)
    } catch (error) {
      if (error instanceof SeatAlreadyTakenError) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'מישהו אחר הזיז אורחים כרגע, רעננו ונסו שוב',
        })
      }
      if (error instanceof SeatingTableNotFoundError) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'השולחן נמחק כרגע, רעננו כדי לראות את תצוגת ההושבה העדכנית',
        })
      }
      throw error
    }
  }

  private async assertEventInWedding(eventId: string, weddingId: string): Promise<void> {
    const inScope = await this.repo.eventBelongsToWedding(eventId, weddingId)
    if (!inScope) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this event',
      })
    }
  }

  private async getTableInWedding(id: string, weddingId: string): Promise<SeatingTable> {
    const table = await this.repo.findTableById(id)
    if (!table || table.weddingId !== weddingId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this table',
      })
    }
    return table
  }
}
