const mockGetInviteData = jest.fn()

jest.mock('~/server/application/household-invite', () => ({
  householdInviteService: {
    getInviteData: (...args: unknown[]) => mockGetInviteData(...args),
  },
}))

import {
  formatHouseholdGreeting,
  resolvePrimaryContactGreeting,
  resolveInvitedHousehold,
} from '~/app/w/[websiteSubUrl]/_lib/invited-household'

describe('formatHouseholdGreeting', () => {
  it('returns the single name unchanged', () => {
    expect(formatHouseholdGreeting(['Alice'])).toBe('Alice')
  })

  it('joins two names with an ampersand', () => {
    expect(formatHouseholdGreeting(['Alice', 'Bob'])).toBe('Alice & Bob')
  })

  it('comma-separates three or more names with a trailing ampersand', () => {
    expect(formatHouseholdGreeting(['Alice', 'Bob', 'Carol'])).toBe('Alice, Bob & Carol')
  })

  it('returns an empty string when there are no names', () => {
    expect(formatHouseholdGreeting([])).toBe('')
  })
})

describe('resolveInvitedHousehold', () => {
  beforeEach(() => {
    mockGetInviteData.mockReset()
  })

  it('returns null without calling the service when there is no invite token', async () => {
    await expect(resolveInvitedHousehold('johnandjane', undefined)).resolves.toBeNull()
    expect(mockGetInviteData).not.toHaveBeenCalled()
  })

  it('returns null when the token does not resolve to a household', async () => {
    mockGetInviteData.mockResolvedValue(null)
    await expect(resolveInvitedHousehold('johnandjane', 'bad-token')).resolves.toBeNull()
  })

  it('builds the greeting from the household guest first names', async () => {
    mockGetInviteData.mockResolvedValue({
      guests: [
        { id: 1, firstName: 'Alice', lastName: 'Stone', isTagAlong: false },
        { id: 2, firstName: 'Bob', lastName: 'Stone', isTagAlong: false },
      ],
    })

    await expect(resolveInvitedHousehold('johnandjane', 'good-token')).resolves.toEqual({
      guestFirstNames: ['Alice', 'Bob'],
      greeting: 'Alice & Bob',
      primaryContactGreeting: { kind: 'fullName', name: 'Alice Stone' },
    })
    expect(mockGetInviteData).toHaveBeenCalledWith('johnandjane', 'good-token')
  })

  it('ignores blank first names and returns null when none remain', async () => {
    mockGetInviteData.mockResolvedValue({
      guests: [{ id: 1, firstName: '   ', lastName: 'Stone', isTagAlong: false }],
    })

    await expect(resolveInvitedHousehold('johnandjane', 'good-token')).resolves.toBeNull()
  })
})

describe('resolvePrimaryContactGreeting', () => {
  it('uses the primary contact full name', () => {
    expect(resolvePrimaryContactGreeting([{ firstName: ' עומר ', lastName: ' דהן ' }])).toEqual({
      name: 'עומר דהן',
      kind: 'fullName',
    })
  })

  it('falls back to the first name', () => {
    expect(resolvePrimaryContactGreeting([{ firstName: 'עומר', lastName: ' ' }])).toEqual({
      name: 'עומר',
      kind: 'fullName',
    })
  })

  it('returns null when there is no contact name', () => {
    expect(resolvePrimaryContactGreeting([])).toBeNull()
    expect(resolvePrimaryContactGreeting([{ firstName: ' ', lastName: 'דהן' }])).toBeNull()
  })
})
