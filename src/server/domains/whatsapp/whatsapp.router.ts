/**
 * WhatsApp Domain - Router
 */

import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc'
import { requireActiveWeddingId } from '~/server/authz/active-wedding'
import { whatsAppService } from '~/server/domains/whatsapp'
import { saveAccountSchema } from '~/server/domains/whatsapp/whatsapp.validator'

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
})
