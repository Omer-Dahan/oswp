import { householdInviteService } from '~/server/application/household-invite'

/** Personalised greeting details for a recognised, invited household. */
export type InvitedHousehold = {
  /** First names of the household's guests, in invite order. */
  guestFirstNames: string[]
  /** Ready-to-render greeting, e.g. "Alice & Bob" or "Alice, Bob & Carol". */
  greeting: string
}

/**
 * Join first names into a friendly greeting:
 *  - ["Alice"]                  -> "Alice"
 *  - ["Alice", "Bob"]           -> "Alice & Bob"
 *  - ["Alice", "Bob", "Carol"]  -> "Alice, Bob & Carol"
 */
export const formatHouseholdGreeting = (firstNames: string[]): string => {
  if (firstNames.length <= 1) return firstNames[0] ?? ''
  const head = firstNames.slice(0, -1)
  const tail = firstNames[firstNames.length - 1]
  return `${head.join(', ')} & ${tail}`
}

/** The name to greet a household by, and whether it's a family name or a first name. */
export type PrimaryContactGreeting = {
  name: string
  kind: 'family' | 'firstName'
}

/**
 * Build a greeting name from a household's primary contact (its first listed
 * guest): their last name when they have one ("family" — e.g. render as
 * "Cohen family"), otherwise their first name.
 */
export function resolvePrimaryContactGreeting(
  guests: Array<{ firstName: string; lastName: string }>
): PrimaryContactGreeting | null {
  const primaryContact = guests[0]
  if (!primaryContact) return null

  const lastName = primaryContact.lastName.trim()
  if (lastName) return { name: lastName, kind: 'family' }

  const firstName = primaryContact.firstName.trim()
  return firstName ? { name: firstName, kind: 'firstName' } : null
}

/**
 * Resolve the household behind a guest's invite token so their wedding website
 * can greet them by name. Returns null when there is no token, the token is
 * invalid/expired, or it does not belong to this website's wedding.
 */
export async function resolveInvitedHousehold(
  websiteSubUrl: string,
  inviteToken: string | undefined
): Promise<InvitedHousehold | null> {
  if (!inviteToken) return null

  const inviteData = await householdInviteService.getInviteData(websiteSubUrl, inviteToken)
  if (!inviteData) return null

  const guestFirstNames = inviteData.guests
    .map((guest) => guest.firstName.trim())
    .filter((firstName) => firstName.length > 0)

  if (guestFirstNames.length === 0) return null

  return {
    guestFirstNames,
    greeting: formatHouseholdGreeting(guestFirstNames),
  }
}
