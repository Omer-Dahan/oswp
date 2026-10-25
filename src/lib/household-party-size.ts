export type PartySizeHousehold = {
  invitedCount: number | null
  guests: Array<{ isTagAlong: boolean }>
}

/**
 * A household's displayed people count never shows 0 — an imported sheet
 * cell of 0 (or a household with no recorded guests) means "unknown", not
 * "nobody". Tag-along guests never count toward the total.
 */
export const getHouseholdPartySize = (household: PartySizeHousehold): number => {
  if (household.invitedCount != null && household.invitedCount > 0) return household.invitedCount
  const nonTagAlongCount = household.guests.filter((guest) => !guest.isTagAlong).length
  return Math.max(1, nonTagAlongCount)
}
