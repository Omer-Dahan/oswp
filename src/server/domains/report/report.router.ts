/**
 * Report Domain - Router
 *
 * tRPC router for operational reports (currently: the kitchen sheet).
 */

import { z } from 'zod'

import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc'
import { requireActiveWeddingId } from '~/server/authz/active-wedding'
import { reportService } from '~/server/domains/report'

const eventIdSchema = z.object({ eventId: z.string().min(1) })

export const reportRouter = createTRPCRouter({
  getKitchenReport: protectedProcedure.input(eventIdSchema).query(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return reportService.getKitchenReport(ctx.authz, weddingId, input.eventId)
  }),

  getKitchenReportForExport: protectedProcedure
    .input(eventIdSchema)
    .query(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return reportService.getKitchenReportForExport(ctx.authz, weddingId, input.eventId)
    }),
})
