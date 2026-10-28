import { householdInviteService } from '~/server/application/household-invite'

/** Personalised greeting details for a recognised, invited household. */
export type InvitedHousehold = {
  /** First names of the household's guests, in invite order. */
  guestFirstNames: string[]
  /** Ready-to-render greeting, e.g. "Alice & Bob" or "Alice, Bob & Carol". */
  greeting: string
  /** Greeting built from the household's primary contact full name. */
  primaryContactGreeting: PrimaryContactGreeting | null
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

/** The primary contact's full name, ready to use in a greeting. */
export type PrimaryContactGreeting = {
  name: string
  kind: 'fullName'
}

/**
 * Build a greeting name from a household's primary contact (its first listed
 * guest), falling back to their first name when no last name is set.
 */
export function resolvePrimaryContactGreeting(
  guests: Array<{ firstName: string; lastName: string }>
): PrimaryContactGreeting | null {
  const primaryContact = guests[0]
  if (!primaryContact) return null

  const firstName = primaryContact.firstName.trim()
  if (!firstName) return null

  const lastName = primaryContact.lastName.trim()
  const name = lastName ? `${firstName} ${lastName}` : firstName
  return { name, kind: 'fullName' }
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

  const primaryContactGreeting = resolvePrimaryContactGreeting(
    inviteData.guests.filter((guest) => guest.isTagAlong !== true)
  )

  return {
    guestFirstNames,
    greeting: formatHouseholdGreeting(guestFirstNames),
    primaryContactGreeting,
  }
}
