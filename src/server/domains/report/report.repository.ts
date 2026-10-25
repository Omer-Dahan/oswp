import type { PrismaClient } from '@prisma/client'

import type {
  KitchenReportAssignment,
  KitchenReportGuest,
  KitchenReportHousehold,
  KitchenReportInvitation,
  KitchenReportTable,
} from '~/lib/reports/kitchen-report'

export interface KitchenReportSourceData {
  households: KitchenReportHousehold[]
  guests: KitchenReportGuest[]
  invitations: KitchenReportInvitation[]
  tables: KitchenReportTable[]
  assignments: KitchenReportAssignment[]
}

export class ReportRepository {
  constructor(private db: PrismaClient) {}

  async eventBelongsToWedding(eventId: string, weddingId: string): Promise<boolean> {
    const event = await this.db.event.findFirst({
      where: { id: eventId, weddingId },
      select: { id: true },
    })
    return event !== null
  }

  async findEventName(eventId: string): Promise<string | null> {
    const event = await this.db.event.findUnique({ where: { id: eventId }, select: { name: true } })
    return event?.name ?? null
  }

  async findKitchenReportSource(weddingId: string, eventId: string): Promise<KitchenReportSourceData> {
    const [households, guests, invitations, tables, assignments] = await Promise.all([
      this.db.household.findMany({
        where: { weddingId },
        select: { id: true, childrenCount: true, dietaryNotes: true },
      }),
      this.db.guest.findMany({
        where: { weddingId },
        select: { id: true, firstName: true, lastName: true, householdId: true, ageGroup: true },
      }),
      this.db.invitation.findMany({
        where: { weddingId, eventId },
        select: { guestId: true, eventId: true, rsvp: true, dietaryRestrictions: true },
      }),
      this.db.seatingTable.findMany({
        where: { weddingId, eventId },
        select: { id: true, eventId: true, name: true },
      }),
      this.db.seatAssignment.findMany({
        where: { eventId, table: { weddingId } },
        select: { guestId: true, tableId: true, eventId: true },
      }),
    ])

    return { households, guests, invitations, tables, assignments }
  }
}
