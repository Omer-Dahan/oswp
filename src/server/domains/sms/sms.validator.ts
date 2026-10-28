import { z } from 'zod'

export const sendSmsSchema = z.object({
  householdId: z.string().min(1),
})
