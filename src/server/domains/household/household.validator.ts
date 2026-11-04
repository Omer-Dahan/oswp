/**
 * Household Domain - Validators
 *
 * Zod schemas for validating household-related inputs.
 */

import { z } from 'zod'

import { optionalPhoneSchema } from '~/lib/phone/phone-validator'
import { guestPartySchema, guestPartyUpdateSchema } from '~/server/domains/guest/guest.validator'

/**
 * Re-export guest party schemas for convenience
 * (Canonical definitions are in guest.validator.ts)
 */
export const guestPartyInputSchema = guestPartySchema
export const guestPartyUpdateInputSchema = guestPartyUpdateSchema

/**
 * Schema for gift input
 */
export const giftInputSchema = z.object({
  eventId: z.string(),
  thankyou: z.boolean(),
  description: z.string().optional().nullish(),
})

/**
 * Trims a free-text field and folds an empty/whitespace-only result to
 * `null` (clear the field) rather than writing `''` to the database.
 * Passes `undefined`/`null` through unchanged so "not provided" and
 * "explicitly cleared" stay distinguishable downstream.
 */
function trimToNull(value: string | null | undefined): string | null | undefined {
  if (value == null) return value
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

/**
 * Base household fields (address, contact info, notes)
 * Shared across create, update, and form schemas
 */
export const baseHouseholdFields = z.object({
  address1: z.string().nullish().optional(),
  address2: z.string().nullish().optional(),
  city: z.string().nullish().optional(),
  state: z.string().nullish().optional(),
  country: z.string().nullish().optional(),
  zipCode: z.string().nullish().optional(),
  phone: optionalPhoneSchema,
  email: z
    .string()
    .email({ message: 'כתובת מייל לא תקינה' })
    .nullish()
    .optional()
    .or(z.literal('').transform(() => null)),
  notes: z.string().max(1000, 'הערות חייבות להיות עד 1000 תווים').nullish().optional(),
  likelihoodOfAttending: z.number().int().min(1).max(5).nullish().optional(),
  invitedCount: z
    .number()
    .int()
    .min(0)
    .max(50)
    .nullish()
    .transform((v) => (v === 0 ? null : v))
    .optional(),
  side: z.string().max(40).nullish().transform(trimToNull).optional(),
  groupName: z.string().max(60).nullish().transform(trimToNull).optional(),
  phoneAlt: z.string().max(40).nullish().optional(),
  expectedCheck: z.number().min(0).nullish().optional(),
})

/**
 * Message shown when the invitee count is missing or out of range. Shared by
 * the manual-create schema (server) and the guest-form schema (client) so
 * the two never drift apart.
 */
export const REQUIRED_INVITED_COUNT_MESSAGE = 'יש להזין מספר מוזמנים בין 1 ל-30'

/**
 * Invitee count for a household created manually via the guest-list "add
 * household" form. Unlike `baseHouseholdFields.invitedCount` (lenient, used
 * by CSV import where the figure is routinely missing), this is mandatory:
 * the owner's decision is that a household can't be created without stating
 * how many people were invited.
 */
export const requiredInvitedCountSchema = z
  .number({ error: REQUIRED_INVITED_COUNT_MESSAGE })
  .int(REQUIRED_INVITED_COUNT_MESSAGE)
  .min(1, REQUIRED_INVITED_COUNT_MESSAGE)
  .max(30, REQUIRED_INVITED_COUNT_MESSAGE)

/**
 * Ensures exactly one non-tag-along guest is marked as primary contact.
 * Shared by `createHouseholdSchema` and `createHouseholdManualSchema` so
 * both create paths enforce the same rule with the same message.
 */
const hasExactlyOnePrimaryContact = (data: { guestParty: GuestPartyInputSchemaInput[] }) => {
  const invitedGuests = data.guestParty.filter((guest) => !guest.isTagAlong)
  const primaryContacts = invitedGuests.filter((guest) => guest.isPrimaryContact)
  return primaryContacts.length === 1
}

const primaryContactRefineOptions = {
  message: 'יש לסמן איש קשר ראשי אחד בדיוק',
  path: ['guestParty'],
}

/**
 * Household fields shared by both create schemas, before the primary-contact
 * refinement (so each variant can `.extend()` invitedCount independently).
 */
const createHouseholdBaseSchema = baseHouseholdFields.extend({
  guestParty: z.array(guestPartyInputSchema).min(1, 'נדרש לפחות אורח אחד'),
})

/**
 * Schema for creating a household. Used by bulk CSV import, where
 * `invitedCount` is routinely absent from the sheet — kept lenient
 * (see `baseHouseholdFields`).
 */
export const createHouseholdSchema = createHouseholdBaseSchema.refine(
  hasExactlyOnePrimaryContact,
  primaryContactRefineOptions
)

/**
 * Schema for creating a household from the guest-list "add household" form.
 * Same as `createHouseholdSchema`, except `invitedCount` is mandatory
 * (1 to 30) — see `requiredInvitedCountSchema`.
 */
export const createHouseholdManualSchema = createHouseholdBaseSchema
  .extend({
    invitedCount: requiredInvitedCountSchema,
  })
  .refine(hasExactlyOnePrimaryContact, primaryContactRefineOptions)

/**
 * Schema for updating a household.
 *
 * Unlike `createHouseholdSchema`, this does NOT require exactly one primary
 * contact across `guestParty`: an update is routinely sent by a panel that
 * owns only a slice of the household (the drawer edits household fields +
 * the primary contact's email/phone, the members editor edits names/tags),
 * so a request legitimately mentions zero or one guest with `isPrimaryContact`
 * set rather than the whole household every time.
 */
export const updateHouseholdSchema = baseHouseholdFields.extend({
  householdId: z.string().min(1, 'Household ID is required'),
  guestParty: z.array(guestPartyUpdateInputSchema).min(1, 'נדרש לפחות אורח אחד'),
  deletedGuests: z.array(z.number()).optional(),
  gifts: z.array(giftInputSchema),
})

/**
 * Schema for deleting a household
 */
export const deleteHouseholdSchema = z.object({
  householdId: z.string().min(1, 'Household ID is required'),
})

/**
 * Schema for searching households
 */
export const searchHouseholdSchema = z.object({
  searchText: z.string().min(2, { message: 'Search input should be minimum 2 characters' }),
})

/**
 * Schema for searching households from the public guest-facing RSVP flow.
 * Scoped to a wedding via the website's subUrl since the guest is unauthenticated.
 */
export const publicSearchHouseholdSchema = z.object({
  subUrl: z.string().min(1, { message: 'Wedding website is required' }),
  searchText: z
    .string()
    .min(2, { message: 'Search input should be minimum 2 characters' })
    .max(100, { message: 'Search input should be at most 100 characters' }),
  accessToken: z.string().optional(),
})

/**
 * Schema for fetching a single household's private fields (dietary notes,
 * wishes message) from the public guest-facing RSVP flow. Gated server-side
 * on `searchText` matching the household via the same logic as
 * `publicSearchHouseholdSchema`'s search, so these fields are only released
 * to a guest who can actually name someone in the household.
 */
export const publicHouseholdDetailsSchema = z.object({
  subUrl: z.string().min(1, { message: 'Wedding website is required' }),
  householdId: z.string().min(1, 'Household ID is required'),
  searchText: z
    .string()
    .min(2, { message: 'Search input should be minimum 2 characters' })
    .max(100, { message: 'Search input should be at most 100 characters' }),
  accessToken: z.string().optional(),
})

/**
 * Schema for household ID parameter
 */
export const householdIdSchema = z.object({
  householdId: z.string().min(1, 'Household ID is required'),
})

/**
 * Schema for bulk creating multiple households (CSV import)
 */
export const bulkCreateHouseholdsSchema = z.object({
  households: z
    .array(createHouseholdSchema)
    .min(1, 'At least one household is required')
    .max(500, 'Cannot import more than 500 households at once'),
})

// Export inferred types
export type GuestPartyInputSchemaInput = z.infer<typeof guestPartyInputSchema>
export type GuestPartyUpdateInputSchemaInput = z.infer<typeof guestPartyUpdateInputSchema>
export type GiftInputSchemaInput = z.infer<typeof giftInputSchema>
export type CreateHouseholdSchemaInput = z.infer<typeof createHouseholdSchema>
export type CreateHouseholdManualSchemaInput = z.infer<typeof createHouseholdManualSchema>
export type UpdateHouseholdSchemaInput = z.infer<typeof updateHouseholdSchema>
export type DeleteHouseholdSchemaInput = z.infer<typeof deleteHouseholdSchema>
export type SearchHouseholdSchemaInput = z.infer<typeof searchHouseholdSchema>
export type PublicSearchHouseholdSchemaInput = z.infer<typeof publicSearchHouseholdSchema>
export type PublicHouseholdDetailsSchemaInput = z.infer<typeof publicHouseholdDetailsSchema>
export type HouseholdIdSchemaInput = z.infer<typeof householdIdSchema>
export type BulkCreateHouseholdsSchemaInput = z.infer<typeof bulkCreateHouseholdsSchema>
