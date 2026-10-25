/**
 * Tests for the household re-import matching rule.
 *
 * A household is "already there" when its primary contact's phone matches
 * an existing primary contact's phone, or (only when the incoming row has
 * no phone) the normalised (firstName, lastName) pair matches.
 */

jest.mock('~/server/authz/permission-checker', () => ({
  requirePermission: jest.fn(),
}))

import { HouseholdManagementService } from '~/server/application/household-management/household-management.service'
import { requirePermission } from '~/server/authz/permission-checker'
import {
  isDuplicateHousehold,
  normalizeImportName,
  normalizeImportPhone,
} from '~/server/domains/household/household-import-matcher'

describe('household import matching rule', () => {
  it('treats the same phone number in a different format as a match', () => {
    const existing = {
      phones: new Set([normalizeImportPhone('052-1234567')!]),
      names: new Set<string>(),
    }

    expect(
      isDuplicateHousehold(
        { phone: '+972521234567', firstName: 'Dana', lastName: 'Cohen' },
        existing
      )
    ).toBe(true)
  })

  it('does not match a different phone even when the name is the same', () => {
    const existing = {
      phones: new Set([normalizeImportPhone('050-1111111')!]),
      names: new Set([normalizeImportName('Dana', 'Cohen')]),
    }

    expect(
      isDuplicateHousehold(
        { phone: '+972529999999', firstName: 'Dana', lastName: 'Cohen' },
        existing
      )
    ).toBe(false)
  })

  it('matches on name only when the incoming row has no phone', () => {
    const existing = {
      phones: new Set<string>(),
      names: new Set([normalizeImportName('Dana', 'Cohen')]),
    }

    expect(
      isDuplicateHousehold(
        { phone: undefined, firstName: '  dana ', lastName: ' cohen  ' },
        existing
      )
    ).toBe(true)
  })

  it('does not match on name when a different household has that name but no phone either', () => {
    const existing = {
      phones: new Set<string>(),
      names: new Set([normalizeImportName('Yossi', 'Levi')]),
    }

    expect(
      isDuplicateHousehold({ phone: undefined, firstName: 'Dana', lastName: 'Cohen' }, existing)
    ).toBe(false)
  })
})

describe('HouseholdManagementService.bulkCreateHouseholds() same-batch dedup', () => {
  const mockRequirePermission = requirePermission as jest.Mock

  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockRequirePermission.mockReturnValue({ organizationId: 'org-1', role: 'admin' })
  })

  it('inserts the first occurrence of a repeated phone and skips the duplicate', async () => {
    const householdRepo = {
      findImportKeys: jest.fn().mockResolvedValue({ phones: [], names: [], emails: [] }),
    }
    const service = new HouseholdManagementService(
      householdRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    )

    const createSpy = jest
      .spyOn(service, 'createHouseholdWithGuests')
      .mockResolvedValue({} as never)

    const row = {
      guestParty: [
        {
          firstName: 'Dana',
          lastName: 'Cohen',
          phone: '052-1234567',
          isPrimaryContact: true,
          invites: {},
        },
      ],
    }

    const result = await service.bulkCreateHouseholds(
      { activeOrganization: { organizationId: 'org-1', role: 'admin' } } as never,
      'wedding-1',
      [row, { ...row, guestParty: [{ ...row.guestParty[0], phone: '+972521234567' }] }]
    )

    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ created: 1, skipped: 1, failed: 0 })
  })

  it('does not abort the batch when a duplicate is skipped mid-way', async () => {
    const householdRepo = {
      findImportKeys: jest.fn().mockResolvedValue({ phones: [], names: [], emails: [] }),
    }
    const service = new HouseholdManagementService(
      householdRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    )

    jest.spyOn(service, 'createHouseholdWithGuests').mockResolvedValue({} as never)

    const first = {
      guestParty: [
        {
          firstName: 'A',
          lastName: 'A',
          phone: '052-1111111',
          isPrimaryContact: true,
          invites: {},
        },
      ],
    }
    const duplicate = {
      guestParty: [
        {
          firstName: 'A',
          lastName: 'A',
          phone: '+972521111111',
          isPrimaryContact: true,
          invites: {},
        },
      ],
    }
    const third = {
      guestParty: [
        {
          firstName: 'B',
          lastName: 'B',
          phone: '052-2222222',
          isPrimaryContact: true,
          invites: {},
        },
      ],
    }

    const result = await service.bulkCreateHouseholds(
      { activeOrganization: { organizationId: 'org-1', role: 'admin' } } as never,
      'wedding-1',
      [first, duplicate, third]
    )

    expect(result).toMatchObject({ created: 2, skipped: 1, failed: 0 })
  })
})
