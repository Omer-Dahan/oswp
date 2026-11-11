import { TRPCError } from '@trpc/server'

import { RSVP_STATUS } from '~/lib/constants/rsvp'
import { planAutoSeating } from '~/lib/seating/auto-seat'
import {
  suggestPlacements,
  type SeatingGroup,
  type SeatingHousehold as ScoreHousehold,
  type SeatingTable as ScoreTable,
} from '~/lib/seating/seating-score'
import { resolveRsvpEvents } from '~/lib/wedding/rsvp-events'
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
  missingSeatsMessage,
  openSeatsMessage,
  tableHasRoom,
} from '~/server/domains/seating/seating.rules'
import type {
  ApplyGroupPlacementInput,
  ApplyGroupPlacementResult,
  AssignGuestsInput,
  AutoSeatGuestRecord,
  AutoSeatInput,
  AutoSeatResult,
  CreateSeatingTableInput,
  SeatableGuestRecord,
  SeatingChart,
  SeatingGroupSummary,
  SeatingHousehold,
  SeatingPlacementSuggestion,
  SeatingTable,
  SeatingTableLock,
  SuggestForGroupInput,
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
        attendingCount: guest.household.attendingCount,
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
    await this.assertWeddingEvent(eventId, weddingId)

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
    await this.assertWeddingEvent(input.eventId, weddingId)
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
    await this.assertWeddingEvent(input.eventId, weddingId)
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
    await this.assertWeddingEvent(input.eventId, weddingId)

    const [tables, invitations] = await Promise.all([
      this.repo.findTablesByEventId(input.eventId),
      this.repo.findAutoSeatGuests(input.eventId),
    ])

    const householdsById = new Map<
      string,
      { id: string; side: string | null; groupName: string | null; attendingCount: number | null }
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
      fillFreeSeatsOnly: input.fillFreeSeatsOnly,
    })

    if (plan.assignments.length === 0) {
      return { seated: 0, createdTables: 0, unseated: plan.unseated.length }
    }

    await this.repo.createAutoSeating(input.eventId, plan.assignments)

    return {
      seated: plan.assignments.length,
      createdTables: 0,
      unseated: plan.unseated.length,
    }
  }

  /**
   * One row per household confirmed for the wedding event, grouped by
   * side+group. A household counts as assigned only once every one of its
   * seatable guests already has a seat for the event; seatsNeeded only ever
   * covers the household's still-unseated guests.
   */
  async getGroups(
    ctx: AuthzContext,
    weddingId: string,
    eventId: string
  ): Promise<SeatingGroupSummary[]> {
    requirePermission(ctx, { event: ['read'] })
    await this.assertWeddingEvent(eventId, weddingId)

    const [invitations, weights] = await Promise.all([
      this.repo.findAutoSeatGuests(eventId),
      this.repo.findSeatWeights(eventId),
    ])

    const households = this.buildGroupHouseholds(invitations)

    const groups = new Map<string, SeatingGroupSummary>()
    for (const household of households) {
      const key = `${household.side ?? ''}\u0000${household.groupName ?? ''}`
      let group = groups.get(key)
      if (!group) {
        group = {
          side: household.side,
          groupName: household.groupName,
          assignedHouseholds: 0,
          unassignedHouseholds: 0,
          seatsNeeded: 0,
        }
        groups.set(key, group)
      }
      if (household.unseatedGuestIds.length === 0) {
        group.assignedHouseholds += 1
      } else {
        group.unassignedHouseholds += 1
        group.seatsNeeded += this.seatWeightOf(household.unseatedGuestIds, weights)
      }
    }

    return [...groups.values()].sort(
      (a, b) =>
        (a.side ?? '').localeCompare(b.side ?? '') ||
        (a.groupName ?? '').localeCompare(b.groupName ?? '')
    )
  }

  /**
   * Scores the event's existing tables for the group's still-unseated
   * households (never invents a table), returning up to three suggestions.
   */
  async suggestForGroup(
    ctx: AuthzContext,
    weddingId: string,
    input: SuggestForGroupInput
  ): Promise<SeatingPlacementSuggestion[]> {
    requirePermission(ctx, { event: ['read'] })
    await this.assertWeddingEvent(input.eventId, weddingId)

    const [tableRecords, invitations, weights] = await Promise.all([
      this.repo.findTablesByEventId(input.eventId),
      this.repo.findAutoSeatGuests(input.eventId),
      this.repo.findSeatWeights(input.eventId),
    ])

    const households = this.buildGroupHouseholds(invitations)

    // All seatable households, full guest list, so affinity scoring can
    // attribute a table's current occupants to their household correctly.
    const allHouseholds: ScoreHousehold[] = households.map((household) => ({
      id: household.id,
      side: household.side,
      groupName: household.groupName,
      seatWeight: this.seatWeightOf(household.guestIds, weights),
      guestIds: household.guestIds,
    }))

    // Only the group's still-unseated households are what need a placement.
    const unassignedHouseholds: ScoreHousehold[] = households
      .filter(
        (household) =>
          household.side === input.side &&
          household.groupName === input.groupName &&
          household.unseatedGuestIds.length > 0
      )
      .map((household) => ({
        id: household.id,
        side: household.side,
        groupName: household.groupName,
        seatWeight: this.seatWeightOf(household.unseatedGuestIds, weights),
        guestIds: household.unseatedGuestIds,
      }))

    if (unassignedHouseholds.length === 0) return []

    const scoreTables: ScoreTable[] = tableRecords.map((table) => ({
      id: table.id,
      name: table.name,
      capacity: table.capacity,
      positionX: table.positionX,
      positionY: table.positionY,
      guestIds: table.seatAssignments.map((assignment) => assignment.guestId),
    }))

    const group: SeatingGroup = {
      side: input.side,
      groupName: input.groupName,
      households: unassignedHouseholds,
    }
    const seatsNeeded = unassignedHouseholds.reduce((total, h) => total + h.seatWeight, 0)

    const suggestions = suggestPlacements({
      group,
      tables: scoreTables,
      households: allHouseholds,
      maxResults: 3,
    })

    const tableRecordsById = new Map(tableRecords.map((table) => [table.id, table]))
    const householdIds = unassignedHouseholds.map((household) => household.id)

    return suggestions.map((suggestion) => {
      const table = tableRecordsById.get(suggestion.tableId)
      if (!table) throw new Error(`Unknown table: ${suggestion.tableId}`)
      const openSeats = getOpenSeats(
        {
          capacity: table.capacity,
          guestIds: table.seatAssignments.map((assignment) => assignment.guestId),
        },
        weights
      )
      return {
        tableId: table.id,
        tableName: table.name,
        reason: suggestion.reason,
        openSeats,
        seatsNeeded,
        fits: openSeats >= seatsNeeded,
        householdIds,
      }
    })
  }

  /**
   * Seats every seatable, not-yet-seated guest of the given households at
   * one table, as a planner's deliberate decision (source MANUAL). Never
   * touches a Declined guest or a guest already seated for the event.
   */
  async applyGroupPlacement(
    ctx: AuthzContext,
    weddingId: string,
    input: ApplyGroupPlacementInput
  ): Promise<ApplyGroupPlacementResult> {
    requirePermission(ctx, { event: ['update'] })
    await this.assertWeddingEvent(input.eventId, weddingId)
    const table = await this.getTableInWedding(input.tableId, weddingId)
    if (table.eventId !== input.eventId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this table',
      })
    }

    const householdIds = new Set(input.householdIds)
    const invitations = await this.repo.findAutoSeatGuests(input.eventId)
    const guestIds = invitations
      .filter(
        (invitation) =>
          invitation.rsvp === RSVP_STATUS.ATTENDING &&
          householdIds.has(invitation.guest.householdId) &&
          invitation.guest.seatAssignments.length === 0
      )
      .map((invitation) => invitation.guest.id)

    const weights = await this.repo.findSeatWeights(input.eventId)

    return this.withLockedTable(table, async (lock) => {
      const seatedGuestIds = await lock.seatedGuestIds()
      const seats = { capacity: lock.table.capacity, guestIds: seatedGuestIds }
      if (!tableHasRoom(seats, guestIds, weights)) {
        const missing =
          getSeatsNeeded(seatedGuestIds, guestIds, weights) - getOpenSeats(seats, weights)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: missingSeatsMessage(lock.table.name, missing),
        })
      }
      const assignmentIds = await lock.createAssignments(guestIds)
      return { assignmentIds }
    })
  }

  // Confirmed-for-the-event households, with every seatable guest id and the
  // subset that still has no seat for the event.
  private buildGroupHouseholds(invitations: AutoSeatGuestRecord[]): Array<{
    id: string
    side: string | null
    groupName: string | null
    guestIds: number[]
    unseatedGuestIds: number[]
  }> {
    const households = new Map<
      string,
      {
        id: string
        side: string | null
        groupName: string | null
        guestIds: number[]
        unseatedGuestIds: number[]
      }
    >()
    for (const invitation of invitations) {
      if (invitation.rsvp !== RSVP_STATUS.ATTENDING) continue
      const { guest } = invitation
      let household = households.get(guest.householdId)
      if (!household) {
        household = {
          id: guest.householdId,
          side: guest.household.side,
          groupName: guest.household.groupName,
          guestIds: [],
          unseatedGuestIds: [],
        }
        households.set(guest.householdId, household)
      }
      household.guestIds.push(guest.id)
      if (guest.seatAssignments.length === 0) household.unseatedGuestIds.push(guest.id)
    }
    return [...households.values()]
  }

  private seatWeightOf(guestIds: number[], weights: ReadonlyMap<number, number>): number {
    return guestIds.reduce((total, id) => total + (weights.get(id) ?? 1), 0)
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

  /**
   * Seating only ever belongs to the wedding event, never the chuppah: every
   * mutation that takes a client-supplied eventId must resolve to this before
   * touching the table/assignment, so a request aimed at the chuppah is refused.
   */
  private async assertWeddingEvent(eventId: string, weddingId: string): Promise<void> {
    await this.assertEventInWedding(eventId, weddingId)
    const weddingEventId = await this.resolveWeddingEventId(weddingId)
    if (eventId !== weddingEventId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'הושבה אפשרית רק עבור אירוע החתונה',
      })
    }
  }

  private async resolveWeddingEventId(weddingId: string): Promise<string> {
    const events = await this.repo.findWeddingEvents(weddingId)
    const { weddingEvent } = resolveRsvpEvents(events)
    if (!weddingEvent) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'לא נמצא אירוע חתונה' })
    }
    return weddingEvent.id
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
