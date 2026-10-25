/**
 * Household Domain - Import Matching
 *
 * Shared matching rule for CSV/sheet re-import: a household is "already there"
 * when its primary contact's phone matches an existing primary contact's
 * phone, or (only when the incoming row has no phone) the pair
 * (firstName, lastName) matches case-insensitively after normalising
 * whitespace. Used by both the bulk-create skip logic and the `importKeys`
 * query that lets the dialog mark rows before importing.
 */

import { normalizePhoneToE164 } from '~/lib/phone/phone-validator'

export type HouseholdImportKeys = {
  phones: Set<string>
  names: Set<string>
}

export function normalizeImportPhone(phone: string | null | undefined): string | undefined {
  return normalizePhoneToE164(phone, 'IL')
}

export function normalizeImportName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeImportEmail(email: string | null | undefined): string | undefined {
  const trimmed = email?.trim().toLowerCase()
  return trimmed ? trimmed : undefined
}

export const DUPLICATE_EMAIL_WARNING = 'דוא"ל כפול — נשמר ללא דוא"ל'

export function isDuplicateHousehold(
  primaryContact: { phone?: string | null; firstName: string; lastName: string },
  existing: HouseholdImportKeys
): boolean {
  const phone = normalizeImportPhone(primaryContact.phone)
  if (phone) return existing.phones.has(phone)
  return existing.names.has(normalizeImportName(primaryContact.firstName, primaryContact.lastName))
}
