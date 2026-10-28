/**
 * Wedding Domain - Validators
 *
 * Zod schemas for validating wedding-related inputs.
 */

import { z } from 'zod'
import { isRsvpCopyKey, normalizeRsvpCopy } from '~/lib/rsvp/copy'
import { RSVP_STEP_KEYS } from '~/lib/rsvp/steps'

const NAME_MAX = 100
const nameTooLong = 'השם חייב להיות עד 100 תווים'

export const updateRsvpStepsSchema = z.object({
  rsvpSteps: z
    .array(z.enum(RSVP_STEP_KEYS))
    .max(RSVP_STEP_KEYS.length)
    .refine((steps) => new Set(steps).size === steps.length, {
      message: 'RSVP steps must be unique',
    }),
})

export const updateRsvpCopySchema = z
  .object({
    rsvpCopy: z.record(z.string(), z.string().max(600)),
  })
  .superRefine(({ rsvpCopy }, context) => {
    for (const key of Object.keys(rsvpCopy)) {
      if (!isRsvpCopyKey(key)) {
        context.addIssue({
          code: 'custom',
          path: ['rsvpCopy', key],
          message: `Unknown RSVP copy key: ${key}`,
        })
      }
    }
  })
  .transform(({ rsvpCopy }) => ({ rsvpCopy: normalizeRsvpCopy(rsvpCopy) }))

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
  rsvpSteps: updateRsvpStepsSchema.shape.rsvpSteps.optional(),
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
export type UpdateRsvpStepsInput = z.infer<typeof updateRsvpStepsSchema>
export type UpdateRsvpCopyInput = z.infer<typeof updateRsvpCopySchema>
