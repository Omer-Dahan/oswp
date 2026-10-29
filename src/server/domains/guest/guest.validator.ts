/**
 * Guest Domain - Validators
 *
 * Zod schemas for validating guest-related inputs.
 */

import { z } from 'zod'

import { optionalPhoneSchema } from '~/lib/phone/phone-validator'

const GUEST_AGE_GROUP_VALUES = ['INFANT', 'CHILD', 'TEEN', 'ADULT'] as const

const NAME_MAX = 100
const nameTooLong = 'השם חייב להיות עד 100 תווים'

/**
 * Schema for creating a guest
 */
export const createGuestSchema = z.object({
  firstName: z.string().min(1, { message: 'שם פרטי נדרש' }).max(NAME_MAX, nameTooLong),
  lastName: z.string().max(NAME_MAX, nameTooLong).optional().default(''),
  email: z.string().email('כתובת מייל לא תקינה').optional().nullable(),
  phone: optionalPhoneSchema,
  householdId: z.string().min(1, 'Household ID is required'),
  isPrimaryContact: z.boolean().optional().default(false),
  ageGroup: z.enum(GUEST_AGE_GROUP_VALUES).default('ADULT'),
  isTagAlong: z.boolean().default(false),
  tagIds: z.array(z.guid()).max(10, 'Maximum 10 tags allowed').optional().default([]),
})

/**
 * Schema for updating a guest
 */
export const updateGuestSchema = z.object({
  guestId: z.number(),
  firstName: z.string().max(NAME_MAX, nameTooLong).optional(),
  lastName: z.string().max(NAME_MAX, nameTooLong).optional(),
  email: z.string().email('כתובת מייל לא תקינה').optional().nullable(),
  phone: optionalPhoneSchema,
  ageGroup: z.enum(GUEST_AGE_GROUP_VALUES).optional(),
  isTagAlong: z.boolean().optional(),
  tagIds: z.array(z.guid()).max(10, 'Maximum 10 tags allowed').optional(),
})

/**
 * Schema for guest ID
 */
export const guestIdSchema = z.object({
  guestId: z.number(),
})

/**
 * Schema for getting guests by household
 */
export const getByHouseholdSchema = z.object({
  householdId: z.string().min(1, 'Household ID is required'),
})

/**
 * Schema for getting guests by event
 */
export const getByEventSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
})

/**
 * Schema for guest party input (used in household operations)
 * This is the canonical schema for guest data in multi-guest contexts
 */
export const guestPartySchema = z.object({
  guestId: z.number().optional(),
  firstName: z.string().min(1, { message: 'שם פרטי נדרש' }).max(NAME_MAX, nameTooLong),
  lastName: z.string().max(NAME_MAX, nameTooLong).optional().default(''),
  email: z
    .string()
    .email('כתובת מייל לא תקינה')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  phone: optionalPhoneSchema,
  isPrimaryContact: z.boolean().default(false),
  ageGroup: z.enum(GUEST_AGE_GROUP_VALUES).default('ADULT'),
  isTagAlong: z.boolean().default(false),
  tagIds: z.array(z.guid()).max(10, 'Maximum 10 tags allowed').default([]),
  invites: z.record(z.string(), z.string()),
})

// Export inferred types
export type CreateGuestSchemaInput = z.infer<typeof createGuestSchema>
export type UpdateGuestSchemaInput = z.infer<typeof updateGuestSchema>
export type GuestIdSchemaInput = z.infer<typeof guestIdSchema>
export type GetByHouseholdSchemaInput = z.infer<typeof getByHouseholdSchema>
export type GetByEventSchemaInput = z.infer<typeof getByEventSchema>
export type GuestPartySchemaInput = z.infer<typeof guestPartySchema>
