/**
 * WhatsApp Domain - Validators
 */

import { z } from 'zod'

export const saveAccountSchema = z.object({
  phoneNumberId: z.string().regex(/^\d+$/, 'מזהה מספר הטלפון צריך להכיל ספרות בלבד'),
  wabaId: z.string().regex(/^\d+$/, 'מזהה ה-WABA צריך להכיל ספרות בלבד'),
  accessToken: z.string().min(20, 'הטוקן קצר מדי'),
  verifyToken: z.string().min(8, 'טוקן האימות חייב להיות באורך 8 תווים לפחות'),
  appSecret: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(8, 'App secret חייב להיות באורך 8 תווים לפחות').optional()
  ),
})

export type SaveAccountInput = z.infer<typeof saveAccountSchema>

export const queueBatchSchema = z.object({
  eventId: z.string().optional(),
  tagId: z.string().optional(),
  householdIds: z.array(z.string()).optional(),
  templateName: z.string().min(1),
  kind: z.enum(['INVITE', 'REMINDER', 'CUSTOM']),
  resend: z.boolean().optional(),
})

export type QueueBatchInput = z.infer<typeof queueBatchSchema>

export const processQueueSchema = z.object({
  max: z.number().int().positive().max(25).optional(),
})

export type ProcessQueueInput = z.infer<typeof processQueueSchema>

export const listRecentOutboundSchema = z.object({
  limit: z.number().int().positive().max(200).optional(),
})

export const composePreviewSchema = z.object({
  eventId: z.string().optional(),
  tagId: z.string().optional(),
  householdIds: z.array(z.string()).optional(),
  templateName: z.string().min(1),
})

export type ComposePreviewInput = z.infer<typeof composePreviewSchema>

export const listPendingInboundSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
})

export type ListPendingInboundInput = z.infer<typeof listPendingInboundSchema>

export const resolveInboundSchema = z.object({
  inboundId: z.string().min(1),
  decision: z.enum(['attending', 'declined', 'dismissed']),
})

export type ResolveInboundInput = z.infer<typeof resolveInboundSchema>

export const linkInboundSchema = z.object({
  inboundId: z.string().min(1),
  guestId: z.number().int().positive(),
  replacePhone: z.boolean().optional(),
})

export type LinkInboundInput = z.infer<typeof linkInboundSchema>
