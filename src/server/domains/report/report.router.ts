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

const setGroupPortionPlanSchema = z.object({
  groupName: z.string().trim().min(1),
  plannedHeadcount: z.number().int().min(0),
  note: z.string().optional(),
})

const groupNameSchema = z.object({ groupName: z.string().trim().min(1) })

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

  getGuestExportForDownload: protectedProcedure
    .input(
      eventIdSchema.extend({
        side: z.string().trim().min(1).optional(),
        group: z.string().trim().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return reportService.getGuestExportForDownload(
        ctx.authz,
        weddingId,
        input.eventId,
        input.side,
        input.group
      )
    }),

  getGroupPortionPlans: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return reportService.getGroupPortionPlans(ctx.authz, weddingId)
  }),

  setGroupPortionPlan: protectedProcedure
    .input(setGroupPortionPlanSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return reportService.setGroupPortionPlan(
        ctx.authz,
        weddingId,
        input.groupName,
        input.plannedHeadcount,
        input.note ?? null
      )
    }),

  deleteGroupPortionPlan: protectedProcedure
    .input(groupNameSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      await reportService.deleteGroupPortionPlan(ctx.authz, weddingId, input.groupName)
    }),
})
