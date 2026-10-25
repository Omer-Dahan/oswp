import { getHouseholdPartySize, type PartySizeHousehold } from '~/lib/household-party-size'

describe('getHouseholdPartySize', () => {
  it('treats an imported invitedCount of 0 as unknown and falls back to the guest list', () => {
    const household: PartySizeHousehold = {
      invitedCount: 0,
      guests: [{ isTagAlong: false }, { isTagAlong: false }],
    }

    expect(getHouseholdPartySize(household)).toBe(2)
  })

  it('treats a null invitedCount as unknown and falls back to the guest list', () => {
    const household: PartySizeHousehold = {
      invitedCount: null,
      guests: [{ isTagAlong: false }],
    }

    expect(getHouseholdPartySize(household)).toBe(1)
  })

  it('floors at 1 for a household with no recorded guests', () => {
    const household: PartySizeHousehold = { invitedCount: null, guests: [] }

    expect(getHouseholdPartySize(household)).toBe(1)
  })

  it('ignores tag-along guests when counting named guests', () => {
    const household: PartySizeHousehold = {
      invitedCount: null,
      guests: [{ isTagAlong: false }, { isTagAlong: true }],
    }

    expect(getHouseholdPartySize(household)).toBe(1)
  })

  it('uses a positive invitedCount as-is', () => {
    const household: PartySizeHousehold = { invitedCount: 5, guests: [] }

    expect(getHouseholdPartySize(household)).toBe(5)
  })
})
