import { TRPCError } from '@trpc/server'

import { buildKitchenReport, type KitchenReport } from '~/lib/reports/kitchen-report'
import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import type { ReportRepository } from '~/server/domains/report/report.repository'

export interface GroupPortionPlanDto {
  groupName: string
  plannedHeadcount: number
  note: string | null
}

export class ReportService {
  constructor(private repo: ReportRepository) {}

  async getKitchenReport(
    ctx: AuthzContext,
    weddingId: string,
    eventId: string
  ): Promise<KitchenReport> {
    requirePermission(ctx, { guest: ['read'] })
    await this.assertEventInWedding(eventId, weddingId)

    const [source, plans] = await Promise.all([
      this.repo.findKitchenReportSource(weddingId, eventId),
      this.repo.findGroupPortionPlans(weddingId),
    ])
    return buildKitchenReport({ ...source, eventId, plans })
  }

  async getKitchenReportForExport(
    ctx: AuthzContext,
    weddingId: string,
    eventId: string
  ): Promise<{ report: KitchenReport; eventName: string }> {
    requirePermission(ctx, { guest: ['read'] })
    await this.assertEventInWedding(eventId, weddingId)

    const [source, eventName, plans] = await Promise.all([
      this.repo.findKitchenReportSource(weddingId, eventId),
      this.repo.findEventName(eventId),
      this.repo.findGroupPortionPlans(weddingId),
    ])

    return {
      report: buildKitchenReport({ ...source, eventId, plans }),
      eventName: eventName ?? 'event',
    }
  }

  async getGroupPortionPlans(
    ctx: AuthzContext,
    weddingId: string
  ): Promise<{ plans: GroupPortionPlanDto[]; availableGroupNames: string[] }> {
    requirePermission(ctx, { guest: ['read'] })
    const [plans, availableGroupNames] = await Promise.all([
      this.repo.findGroupPortionPlans(weddingId),
      this.repo.findHouseholdGroupNames(weddingId),
    ])
    return {
      plans: plans.map((plan) => ({
        groupName: plan.groupName,
        plannedHeadcount: plan.plannedHeadcount,
        note: plan.note,
      })),
      availableGroupNames,
    }
  }

  async setGroupPortionPlan(
    ctx: AuthzContext,
    weddingId: string,
    groupName: string,
    plannedHeadcount: number,
    note: string | null
  ): Promise<GroupPortionPlanDto> {
    requirePermission(ctx, { guest: ['update'] })
    const trimmedGroupName = groupName.trim()
    const plan = await this.repo.upsertGroupPortionPlan(
      weddingId,
      trimmedGroupName,
      plannedHeadcount,
      note
    )
    return { groupName: plan.groupName, plannedHeadcount: plan.plannedHeadcount, note: plan.note }
  }

  async deleteGroupPortionPlan(ctx: AuthzContext, weddingId: string, groupName: string): Promise<void> {
    requirePermission(ctx, { guest: ['update'] })
    await this.repo.deleteGroupPortionPlan(weddingId, groupName.trim())
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
}
