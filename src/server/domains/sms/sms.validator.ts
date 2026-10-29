import { z } from 'zod'

export const sendSmsSchema = z.object({
  householdId: z.string().min(1),
})

export const setSmsTemplateSchema = z.object({
  template: z.string().max(5000, 'נוסח ההודעה ארוך מדי').nullable(),
})
