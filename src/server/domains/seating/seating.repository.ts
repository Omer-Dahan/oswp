import { Prisma, type PrismaClient } from '@prisma/client'

import { RSVP_STATUS } from '~/lib/constants/rsvp'
import type { RsvpEventInput } from '~/lib/wedding/rsvp-events'
import {
  SeatAlreadyTakenError,
  SeatingTableNotFoundError,
} from '~/server/domains/seating/seating.errors'

import { getGuestWeights } from '~/server/domains/seating/seating.rules'
import type {
  AutoSeatGuestRecord,
  CreateSeatingTableInput,
  SeatableGuestRecord,
  SeatingTable,
  SeatingTableLock,
  SeatingTableRecord,
} from '~/server/domains/seating/seating.types'

// Only a confirmed guest is seatable: a household with no Attending row for
// the wedding event (e.g. still Invited, or only confirmed the chuppah) never
// enters the seating list, and a Declined guest within an attending
// household is excluded without having to check household-level separately.
const seatableInvitation = (eventId: string) => ({
  eventId,
  rsvp: RSVP_STATUS.ATTENDING,
})

// Seats whose guest has declined or lost their invitation since being seated
const staleAssignments = (eventId: string) => ({
  eventId,
  guest: { invitations: { none: seatableInvitation(eventId) } },
})

export class SeatingRepository {
  constructor(private db: PrismaClient) {}

  async eventBelongsToWedding(eventId: string, weddingId: string): Promise<boolean> {
    const event = await this.db.event.findFirst({
      where: { id: eventId, weddingId },
      select: { id: true },
    })
    return event !== null
  }

  /** The wedding's events, with what `resolveRsvpEvents` needs to tell the wedding apart from the chuppah. */
  async findWeddingEvents(weddingId: string): Promise<RsvpEventInput[]> {
    return this.db.event.findMany({
      where: { weddingId },
      select: { id: true, name: true, isPrimary: true, collectRsvp: true },
    })
  }

  async findTablesByEventId(eventId: string): Promise<SeatingTableRecord[]> {
    return this.db.seatingTable.findMany({
      where: { eventId },
      include: {
        seatAssignments: {
          where: { guest: { invitations: { some: seatableInvitation(eventId) } } },
          select: { guestId: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * Guests who confirmed Attending for the event, with what the seating UI
   * needs to group them by household and show their details.
   */
  async findSeatableGuests(eventId: string): Promise<SeatableGuestRecord[]> {
    return this.db.invitation.findMany({
      where: seatableInvitation(eventId),
      select: {
        rsvp: true,
        dietaryRestrictions: true,
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            ageGroup: true,
            isPrimaryContact: true,
            isTagAlong: true,
            householdId: true,
            household: {
              select: {
                id: true,
                address1: true,
                address2: true,
                city: true,
                state: true,
                zipCode: true,
                country: true,
                notes: true,
                invitedCount: true,
                attendingCount: true,
              },
            },
            guestTagAssignments: { select: { guestTag: { select: { name: true } } } },
            seatAssignments: { where: { eventId }, select: { tableId: true } },
          },
        },
      },
      orderBy: { guestId: 'asc' },
    })
  }

  /**
   * Maps every seatable guest of the event to the number of seats their
   * household's party occupies, so capacity checks count parties, not rows.
   */
  async findSeatWeights(eventId: string): Promise<Map<number, number>> {
    const invitations = await this.db.invitation.findMany({
      where: seatableInvitation(eventId),
      select: {
        guest: {
          select: {
            id: true,
            isPrimaryContact: true,
            householdId: true,
            household: { select: { attendingCount: true } },
          },
        },
      },
    })

    const households = new Map<
      string,
      { attendingCount: number | null; guests: Array<{ id: number; isPrimaryContact: boolean }> }
    >()
    for (const { guest } of invitations) {
      let household = households.get(guest.householdId)
      if (!household) {
        household = { attendingCount: guest.household.attendingCount, guests: [] }
        households.set(guest.householdId, household)
      }
      household.guests.push({ id: guest.id, isPrimaryContact: guest.isPrimaryContact })
    }

    return getGuestWeights([...households.values()])
  }

  async findTableById(id: string): Promise<SeatingTable | null> {
    return this.db.seatingTable.findUnique({ where: { id } })
  }

  async createTable(data: CreateSeatingTableInput & { weddingId: string }): Promise<SeatingTable> {
    return this.db.seatingTable.create({ data })
  }

  async deleteTable(id: string): Promise<SeatingTable> {
    return this.db.seatingTable.delete({ where: { id } })
  }

  /**
   * Returns the subset of guestIds that are seatable for the event.
   */
  async findSeatableGuestIds(eventId: string, guestIds: number[]): Promise<number[]> {
    const invitations = await this.db.invitation.findMany({
      where: { ...seatableInvitation(eventId), guestId: { in: guestIds } },
      select: { guestId: true },
    })
    return invitations.map((invitation) => invitation.guestId)
  }

  /**
   * Runs work in a transaction holding a row lock on the table, so capacity
   * checks and seat changes for that table are serialized. Stale seats for the
   * event are removed first so they never count toward capacity.
   */
  async withLockedTable<T>(
    table: { id: string; eventId: string },
    work: (lock: SeatingTableLock) => Promise<T>
  ): Promise<T> {
    try {
      return await this.db.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw<Array<{ name: string; capacity: number }>>`
          SELECT "name", "capacity" FROM "SeatingTable" WHERE "id" = ${table.id} FOR UPDATE`
        if (!locked) throw new SeatingTableNotFoundError()

        await tx.seatAssignment.deleteMany({ where: staleAssignments(table.eventId) })

        return work({
          table: { name: locked.name, capacity: locked.capacity },
          seatedGuestIds: async () => {
            const seats = await tx.seatAssignment.findMany({
              where: { tableId: table.id },
              select: { guestId: true },
            })
            return seats.map((seat) => seat.guestId)
          },
          // Seats guests at the table, moving them off any other table for the event
          replaceAssignments: async (guestIds) => {
            await tx.seatAssignment.deleteMany({
              where: { eventId: table.eventId, guestId: { in: guestIds } },
            })
            await tx.seatAssignment.createMany({
              data: guestIds.map((guestId) => ({
                eventId: table.eventId,
                tableId: table.id,
                guestId,
              })),
            })
          },
          // Seats guests at the table without touching any other table; returns
          // the created assignment ids so a caller can offer to undo the placement.
          createAssignments: async (guestIds) => {
            if (guestIds.length === 0) return []
            await tx.seatAssignment.createMany({
              data: guestIds.map((guestId) => ({
                eventId: table.eventId,
                tableId: table.id,
                guestId,
              })),
            })
            const created = await tx.seatAssignment.findMany({
              where: { eventId: table.eventId, tableId: table.id, guestId: { in: guestIds } },
              select: { id: true },
            })
            return created.map((row) => row.id)
          },
          updateTable: (data) => tx.seatingTable.update({ where: { id: table.id }, data }),
        })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new SeatAlreadyTakenError()
      }
      throw error
    }
  }

  async deleteAssignments(eventId: string, guestIds: number[]): Promise<void> {
    await this.db.seatAssignment.deleteMany({ where: { eventId, guestId: { in: guestIds } } })
  }

  /**
   * Every invitation for the event, with what the auto-seat planner needs to
   * bucket guests by household and tell who is already seated. Unlike
   * findSeatableGuests this is unfiltered: eligibility is the planner's rule.
   */
  async findAutoSeatGuests(eventId: string): Promise<AutoSeatGuestRecord[]> {
    return this.db.invitation.findMany({
      where: { eventId },
      select: {
        rsvp: true,
        guest: {
          select: {
            id: true,
            isPrimaryContact: true,
            householdId: true,
            household: { select: { id: true, side: true, groupName: true, attendingCount: true } },
            seatAssignments: { where: { eventId }, select: { tableId: true } },
          },
        },
      },
    })
  }

  /**
   * Creates the auto-seat plan's AUTO assignments. Never invents a table and
   * never touches an existing SeatAssignment row.
   */
  async createAutoSeating(
    eventId: string,
    assignments: Array<{ guestId: number; tableId: string }>
  ): Promise<void> {
    if (assignments.length === 0) return
    await this.db.seatAssignment.createMany({
      data: assignments.map(({ guestId, tableId }) => ({
        eventId,
        guestId,
        tableId,
        source: 'AUTO' as const,
      })),
    })
  }
}
