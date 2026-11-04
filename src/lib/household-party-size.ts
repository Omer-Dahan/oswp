export type PartySizeHousehold = {
  invitedCount: number | null
  attendingCount: number | null
  guests: unknown[]
}

/**
 * The largest known representation of the household's party. The imported
 * sheet, the guest's RSVP, and named guest rows can each be incomplete, so
 * none of them is allowed to cap the others.
 */
export const getHouseholdPartySize = (household: PartySizeHousehold): number | null => {
  const partySize = Math.max(
    household.invitedCount ?? 0,
    household.attendingCount ?? 0,
    household.guests.length
  )

  return partySize > 0 ? partySize : null
}
