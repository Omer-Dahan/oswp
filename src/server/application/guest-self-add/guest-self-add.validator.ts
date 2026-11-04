/**
 * Guest Self-Add Application Service - Validators
 *
 * Zod schema for the public "add yourself" flow, used when a guest can't
 * find themselves in the couple's list via the normal name search.
 */

import { z } from 'zod'

import { normalizePhoneToE164 } from '~/lib/phone/phone-validator'

// Israeli mobile numbers normalise to +972 followed by 9 digits starting
// with 5 (05X-XXXXXXX with the leading 0 dropped). Fixed lines normalise to
// 8 digits, so this also rejects a landline typed into a "your mobile" field.
const ISRAELI_MOBILE_E164_PATTERN = /^\+9725\d{8}$/

const fullNameSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      const tokens = value.split(/\s+/).filter(Boolean)
      if (tokens.length >= 2) return true
      return tokens.length === 1 && (tokens[0]?.length ?? 0) >= 2
    },
    { message: 'הזינו שם מלא' }
  )

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => normalizePhoneToE164(value, 'IL') ?? value)
  .refine((value) => ISRAELI_MOBILE_E164_PATTERN.test(value), {
    message: 'הזינו מספר טלפון נייד ישראלי תקין',
  })

export const guestSelfAddSchema = z.object({
  subUrl: z.string().min(1, { message: 'Wedding website is required' }),
  fullName: fullNameSchema,
  phone: phoneSchema,
  attendingCount: z
    .number()
    .int({ message: 'מספר המשתתפים חייב להיות מספר שלם' })
    .min(1, { message: 'מספר המשתתפים חייב להיות בין 1 ל-8' })
    .max(8, { message: 'מספר המשתתפים חייב להיות בין 1 ל-8' }),
})

export type GuestSelfAddSchemaInput = z.infer<typeof guestSelfAddSchema>
