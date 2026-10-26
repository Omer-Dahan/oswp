import { getHouseholdPartySize, type PartySizeHousehold } from '~/lib/household-party-size'

describe('getHouseholdPartySize', () => {
  it('treats an imported invitedCount of 0 as unknown', () => {
    const household: PartySizeHousehold = { invitedCount: 0 }

    expect(getHouseholdPartySize(household)).toBeNull()
  })

  it('treats a null invitedCount as unknown', () => {
    const household: PartySizeHousehold = { invitedCount: null }

    expect(getHouseholdPartySize(household)).toBeNull()
  })

  it('never falls back to a guest row count — unknown stays unknown', () => {
    const household: PartySizeHousehold = { invitedCount: null }

    expect(getHouseholdPartySize(household)).toBeNull()
  })

  it('uses a positive invitedCount as-is', () => {
    const household: PartySizeHousehold = { invitedCount: 5 }

    expect(getHouseholdPartySize(household)).toBe(5)
  })

  it('uses a positive invitedCount of 2 as-is', () => {
    const household: PartySizeHousehold = { invitedCount: 2 }

    expect(getHouseholdPartySize(household)).toBe(2)
  })
})
