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

export type InvitedAttendingSummary = {
  invited: number | null
  attending: number | null
  /** The two figures disagree — the gap marker belongs on the confirmed (attending) number. */
  mismatch: boolean
}

/**
 * The invited/attending pair shown under a guest's name in the list row and
 * card views. Deliberately shows only whichever figures are known, with no
 * fallback to named-guest count - when both are unknown there's nothing to
 * show at all (see getHouseholdPartySize for the fallback used elsewhere).
 */
export const getInvitedAttendingSummary = (household: {
  invitedCount: number | null
  attendingCount: number | null
}): InvitedAttendingSummary => {
  const { invitedCount, attendingCount } = household
  return {
    invited: invitedCount,
    attending: attendingCount,
    mismatch: invitedCount != null && attendingCount != null && invitedCount !== attendingCount,
  }
}
