/**
 * WhatsApp Domain - Router
 */

import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc'
import { requireActiveWeddingId } from '~/server/authz/active-wedding'
import { inboundReviewService, whatsAppService } from '~/server/domains/whatsapp'
import {
  composePreviewSchema,
  linkInboundSchema,
  listPendingInboundSchema,
  listRecentOutboundSchema,
  processQueueSchema,
  queueBatchSchema,
  resolveInboundSchema,
  saveAccountSchema,
  setTemplateHeaderImageSchema,
} from '~/server/domains/whatsapp/whatsapp.validator'

export const whatsappRouter = createTRPCRouter({
  getAccount: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return whatsAppService.getAccount(ctx.authz, weddingId)
  }),

  saveAccount: protectedProcedure.input(saveAccountSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return whatsAppService.saveAccount(ctx.authz, weddingId, input)
  }),

  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return whatsAppService.testConnection(ctx.authz, weddingId)
  }),

  syncTemplates: protectedProcedure.mutation(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return whatsAppService.syncTemplates(ctx.authz, weddingId)
  }),

  queueBatch: protectedProcedure.input(queueBatchSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return whatsAppService.queueBatch(ctx.authz, weddingId, input)
  }),

  processQueue: protectedProcedure.input(processQueueSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return whatsAppService.processQueue(ctx.authz, weddingId, input)
  }),

  getQueuedCount: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return whatsAppService.getQueuedCount(ctx.authz, weddingId)
  }),

  cancelQueue: protectedProcedure.mutation(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return whatsAppService.cancelQueue(ctx.authz, weddingId)
  }),

  listRecentOutbound: protectedProcedure
    .input(listRecentOutboundSchema)
    .query(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return whatsAppService.listRecentOutbound(ctx.authz, weddingId, input.limit)
    }),

  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return whatsAppService.listTemplates(ctx.authz, weddingId)
  }),

  getComposePreview: protectedProcedure
    .input(composePreviewSchema)
    .query(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return whatsAppService.getComposePreview(ctx.authz, weddingId, input)
    }),

  listPendingInbound: protectedProcedure
    .input(listPendingInboundSchema)
    .query(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return inboundReviewService.listPendingInbound(ctx.authz, weddingId, input.limit)
    }),

  resolveInbound: protectedProcedure.input(resolveInboundSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return inboundReviewService.resolveInbound(ctx.authz, weddingId, input)
  }),

  linkInboundToHousehold: protectedProcedure
    .input(linkInboundSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return inboundReviewService.linkInboundToHousehold(ctx.authz, weddingId, input)
    }),

  setTemplateHeaderImage: protectedProcedure
    .input(setTemplateHeaderImageSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return whatsAppService.setTemplateHeaderImage(ctx.authz, weddingId, input)
    }),
})
