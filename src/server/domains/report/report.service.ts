import { TRPCError } from '@trpc/server'

import { buildKitchenReport, type KitchenReport } from '~/lib/reports/kitchen-report'
import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import type { ReportRepository } from '~/server/domains/report/report.repository'

export class ReportService {
  constructor(private repo: ReportRepository) {}

  async getKitchenReport(
    ctx: AuthzContext,
    weddingId: string,
    eventId: string
  ): Promise<KitchenReport> {
    requirePermission(ctx, { guest: ['read'] })
    await this.assertEventInWedding(eventId, weddingId)

    const source = await this.repo.findKitchenReportSource(weddingId, eventId)
    return buildKitchenReport({ ...source, eventId })
  }

  async getKitchenReportForExport(
    ctx: AuthzContext,
    weddingId: string,
    eventId: string
  ): Promise<{ report: KitchenReport; eventName: string }> {
    requirePermission(ctx, { guest: ['read'] })
    await this.assertEventInWedding(eventId, weddingId)

    const [source, eventName] = await Promise.all([
      this.repo.findKitchenReportSource(weddingId, eventId),
      this.repo.findEventName(eventId),
    ])

    return {
      report: buildKitchenReport({ ...source, eventId }),
      eventName: eventName ?? 'event',
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
}
