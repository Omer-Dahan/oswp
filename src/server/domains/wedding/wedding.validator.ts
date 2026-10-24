/**
 * Wedding Domain - Validators
 *
 * Zod schemas for validating wedding-related inputs.
 */

import { z } from 'zod'

const NAME_MAX = 100
const nameTooLong = 'השם חייב להיות עד 100 תווים'

/**
 * Schema for creating a new wedding (onboarding)
 */
export const createWeddingSchema = z.object({
  groomFirstName: z.string().min(1, 'שם פרטי של החתן נדרש').max(NAME_MAX, nameTooLong),
  groomMiddleName: z.string().max(NAME_MAX, nameTooLong).optional(),
  groomLastName: z.string().min(1, 'שם משפחה של החתן נדרש').max(NAME_MAX, nameTooLong),
  brideFirstName: z.string().min(1, 'שם פרטי של הכלה נדרש').max(NAME_MAX, nameTooLong),
  brideMiddleName: z.string().max(NAME_MAX, nameTooLong).optional(),
  brideLastName: z.string().min(1, 'שם משפחה של הכלה נדרש').max(NAME_MAX, nameTooLong),
  hasWeddingDetails: z.boolean().optional(),
  weddingDate: z.string().optional(),
  weddingLocation: z.string().max(200, 'מיקום החתונה חייב להיות עד 200 תווים').optional(),
})

/**
 * Schema for updating wedding settings
 */
export const updateWeddingSchema = z.object({
  groomFirstName: z.string().min(1).max(NAME_MAX, nameTooLong).optional(),
  groomLastName: z.string().min(1).max(NAME_MAX, nameTooLong).optional(),
  brideFirstName: z.string().min(1).max(NAME_MAX, nameTooLong).optional(),
  brideLastName: z.string().min(1).max(NAME_MAX, nameTooLong).optional(),
  enabledAddOns: z.array(z.string()).optional(),
})

/**
 * Schema for updating wedding couple names from settings page.
 */
export const updateWeddingDetailsSchema = z.object({
  groomFirstName: z.string().min(1, 'שם פרטי של החתן נדרש').max(NAME_MAX, nameTooLong),
  groomLastName: z.string().min(1, 'שם משפחה של החתן נדרש').max(NAME_MAX, nameTooLong),
  brideFirstName: z.string().min(1, 'שם פרטי של הכלה נדרש').max(NAME_MAX, nameTooLong),
  brideLastName: z.string().min(1, 'שם משפחה של הכלה נדרש').max(NAME_MAX, nameTooLong),
})

export const toggleWeddingAddOnSchema = z.object({
  addOn: z.enum(['website_builder']),
  enabled: z.boolean(),
})

/**
 * Schema for fetching wedding by userId
 */
export const getByUserIdSchema = z
  .object({
    userId: z.string().optional(),
  })
  .optional()

// Export inferred types
export type CreateWeddingSchemaInput = z.infer<typeof createWeddingSchema>
export type ToggleWeddingAddOnInput = z.infer<typeof toggleWeddingAddOnSchema>
export type UpdateWeddingSchemaInput = z.infer<typeof updateWeddingSchema>
export type UpdateWeddingDetailsInput = z.infer<typeof updateWeddingDetailsSchema>
