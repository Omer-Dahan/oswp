import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc'
import { requireActiveWeddingId } from '~/server/authz/active-wedding'
import { smsService } from '~/server/domains/sms'
import { sendSmsSchema } from '~/server/domains/sms/sms.validator'

export const smsRouter = createTRPCRouter({
  listSmsRecipients: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.listRecipients(ctx.authz, weddingId)
  }),

  sendSms: protectedProcedure.input(sendSmsSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.sendInvite(ctx.authz, weddingId, input.householdId)
  }),
})
