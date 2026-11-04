import { z } from 'zod'

export const sendSmsSchema = z.object({
  householdId: z.string().min(1),
  senderId: z.string().uuid().optional(),
  confirmCrossSide: z.boolean().optional(),
})

const templateSideSchema = z.enum(['חתן', 'כלה']).nullable()

export const getSmsTemplateSchema = z.object({
  side: templateSideSchema,
})

export const setSmsTemplateSchema = z.object({
  side: templateSideSchema,
  template: z.string().max(5000, 'נוסח ההודעה ארוך מדי').nullable(),
  signature: z.string().trim().max(200, 'החתימה ארוכה מדי').nullable(),
})

export const getInviteMessageSchema = z.object({
  householdId: z.string().min(1),
})

const senderSideSchema = z.enum(['חתן', 'כלה'])

export const createSmsSenderSchema = z.object({
  label: z.string().trim().min(1).max(100),
  side: senderSideSchema,
  gatewayUrl: z.string().url().max(500),
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
  deviceId: z.string().trim().max(200).optional(),
})

export const updateSmsSenderSchema = createSmsSenderSchema
  .omit({ username: true, password: true })
  .extend({
    id: z.string().uuid(),
    username: z.string().trim().min(1).max(200).optional(),
    password: z.string().min(1).max(500).optional(),
  })

export const smsSenderIdSchema = z.object({ id: z.string().uuid() })

export const setSmsSenderActiveSchema = smsSenderIdSchema.extend({ isActive: z.boolean() })

export type CreateSmsSenderInput = z.infer<typeof createSmsSenderSchema>
export type UpdateSmsSenderInput = z.infer<typeof updateSmsSenderSchema>
