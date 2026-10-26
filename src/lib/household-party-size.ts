export type PartySizeHousehold = {
  invitedCount: number | null
}

/**
 * The number of people the couple invited, per the imported sheet. `null`
 * means the sheet never recorded it — unknown, not "nobody" and not
 * "whoever's in the guest rows" (that's a different quantity).
 */
export const getHouseholdPartySize = (household: PartySizeHousehold): number | null =>
  household.invitedCount != null && household.invitedCount > 0 ? household.invitedCount : null
