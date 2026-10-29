import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc'
import { requireActiveWeddingId } from '~/server/authz/active-wedding'
import { smsService } from '~/server/domains/sms'
import {
  createSmsSenderSchema,
  sendSmsSchema,
  setSmsSenderActiveSchema,
  setSmsTemplateSchema,
  smsSenderIdSchema,
  updateSmsSenderSchema,
} from '~/server/domains/sms/sms.validator'

export const smsRouter = createTRPCRouter({
  listSmsRecipients: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.listRecipients(ctx.authz, weddingId)
  }),

  getSmsTemplate: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.getTemplate(ctx.authz, weddingId)
  }),

  listSmsSenders: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.listSenders(ctx.authz, weddingId)
  }),

  createSmsSender: protectedProcedure
    .input(createSmsSenderSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return smsService.createSender(ctx.authz, weddingId, input)
    }),

  updateSmsSender: protectedProcedure
    .input(updateSmsSenderSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return smsService.updateSender(ctx.authz, weddingId, input)
    }),

  setDefaultSmsSender: protectedProcedure
    .input(smsSenderIdSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return smsService.setDefaultSender(ctx.authz, weddingId, input.id)
    }),

  setSmsSenderActive: protectedProcedure
    .input(setSmsSenderActiveSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return smsService.setSenderActive(ctx.authz, weddingId, input.id, input.isActive)
    }),

  setSmsTemplate: protectedProcedure
    .input(setSmsTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return smsService.setTemplate(ctx.authz, weddingId, input.template)
    }),

  sendSms: protectedProcedure.input(sendSmsSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.sendInvite(ctx.authz, weddingId, input)
  }),

  sendSmsAgain: protectedProcedure.input(sendSmsSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return smsService.sendAgain(ctx.authz, weddingId, input)
  }),
})
