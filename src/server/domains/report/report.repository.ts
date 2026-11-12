import type { GroupPortionPlan, PrismaClient } from '@prisma/client'

import type {
  GuestExportGuest,
  GuestExportHousehold,
  GuestExportInvitation,
} from '~/lib/reports/guest-export-xlsx'
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

export interface GuestExportSourceData {
  households: GuestExportHousehold[]
  guests: GuestExportGuest[]
  invitations: GuestExportInvitation[]
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
        select: {
          id: true,
          childrenCount: true,
          attendingCount: true,
          dietaryNotes: true,
          groupName: true,
        },
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

  async findGuestExportSource(weddingId: string, eventId: string): Promise<GuestExportSourceData> {
    const [households, guests, invitations] = await Promise.all([
      this.db.household.findMany({
        where: { weddingId },
        select: {
          id: true,
          side: true,
          groupName: true,
          attendingCount: true,
          phoneAlt: true,
          city: true,
          address1: true,
          zipCode: true,
          address2: true,
          expectedCheck: true,
        },
      }),
      this.db.guest.findMany({
        where: { weddingId },
        select: {
          id: true,
          householdId: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          isPrimaryContact: true,
        },
      }),
      this.db.invitation.findMany({
        where: { weddingId, eventId },
        select: { guestId: true, eventId: true, rsvp: true },
      }),
    ])

    return {
      households: households.map((household) => ({
        ...household,
        expectedCheck: household.expectedCheck ? household.expectedCheck.toNumber() : null,
      })),
      guests,
      invitations,
    }
  }

  async findGroupPortionPlans(weddingId: string): Promise<GroupPortionPlan[]> {
    return this.db.groupPortionPlan.findMany({
      where: { weddingId },
      orderBy: { groupName: 'asc' },
    })
  }

  async upsertGroupPortionPlan(
    weddingId: string,
    groupName: string,
    plannedHeadcount: number,
    note: string | null
  ): Promise<GroupPortionPlan> {
    return this.db.groupPortionPlan.upsert({
      where: { weddingId_groupName: { weddingId, groupName } },
      create: { weddingId, groupName, plannedHeadcount, note },
      update: { plannedHeadcount, note },
    })
  }

  async deleteGroupPortionPlan(weddingId: string, groupName: string): Promise<void> {
    await this.db.groupPortionPlan.deleteMany({ where: { weddingId, groupName } })
  }

  async findHouseholdGroupNames(weddingId: string): Promise<string[]> {
    const rows = await this.db.household.findMany({
      where: { weddingId, groupName: { not: null } },
      select: { groupName: true },
      distinct: ['groupName'],
      orderBy: { groupName: 'asc' },
    })
    return rows.map((row) => row.groupName).filter((name): name is string => !!name)
  }
}
