import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc'
import { requireActiveWeddingId } from '~/server/authz/active-wedding'
import { smsService } from '~/server/domains/sms'
import { sendSmsSchema, setSmsTemplateSchema } from '~/server/domains/sms/sms.validator'

export const smsRouter = createTRPCRouter({
  listSmsRecipients: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.listRecipients(ctx.authz, weddingId)
  }),

  getSmsTemplate: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.getTemplate(ctx.authz, weddingId)
  }),

  setSmsTemplate: protectedProcedure
    .input(setSmsTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return smsService.setTemplate(ctx.authz, weddingId, input.template)
    }),

  sendSms: protectedProcedure.input(sendSmsSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.sendInvite(ctx.authz, weddingId, input.householdId)
  }),

  sendSmsAgain: protectedProcedure.input(sendSmsSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.sendAgain(ctx.authz, weddingId, input.householdId)
  }),
})
