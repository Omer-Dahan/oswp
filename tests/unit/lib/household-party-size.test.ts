import { getHouseholdPartySize, type PartySizeHousehold } from '~/lib/household-party-size'

describe('getHouseholdPartySize', () => {
  it('treats an imported invitedCount of 0 as unknown', () => {
    const household: PartySizeHousehold = { invitedCount: 0, attendingCount: null, guests: [] }

    expect(getHouseholdPartySize(household)).toBeNull()
  })

  it('treats a null invitedCount as unknown', () => {
    const household: PartySizeHousehold = { invitedCount: null, attendingCount: null, guests: [] }

    expect(getHouseholdPartySize(household)).toBeNull()
  })

  it('falls back to named guest rows when sheet and RSVP counts are unknown', () => {
    const household: PartySizeHousehold = { invitedCount: null, attendingCount: null, guests: [{}] }

    expect(getHouseholdPartySize(household)).toBe(1)
  })

  it('uses a positive invitedCount as-is', () => {
    const household: PartySizeHousehold = { invitedCount: 5, attendingCount: 3, guests: [{}, {}] }

    expect(getHouseholdPartySize(household)).toBe(5)
  })

  it('does not clamp a confirmed count to the imported invited count', () => {
    const household: PartySizeHousehold = { invitedCount: 1, attendingCount: 4, guests: [{}] }

    expect(getHouseholdPartySize(household)).toBe(4)
  })
})
