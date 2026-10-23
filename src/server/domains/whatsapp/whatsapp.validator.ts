/**
 * WhatsApp Domain - Validators
 */

import { z } from 'zod'

export const saveAccountSchema = z.object({
  phoneNumberId: z.string().regex(/^\d+$/, 'Phone number ID must contain digits only'),
  wabaId: z.string().regex(/^\d+$/, 'WABA ID must contain digits only'),
  accessToken: z.string().min(20, 'Access token looks too short'),
  verifyToken: z.string().min(8, 'Verify token must be at least 8 characters'),
  // Accepted for forward-compat with webhook signature verification; the
  // current schema does not yet persist it.
  appSecret: z.string().min(20, 'App secret looks too short').optional(),
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
