/**
 * Tests for HouseholdManagementService.deleteAllHouseholds() authorization.
 *
 * Bulk-wiping the guest list is a destructive, irreversible action: only the
 * owner role may do it. This exercises the real permission-checker and
 * auth-permissions role grants (not mocked) so the FORBIDDEN path is genuine.
 */

jest.mock('~/server/domains/household/household.repository')
jest.mock('~/server/domains/guest/guest.repository')
jest.mock('~/server/domains/invitation/invitation.repository')
jest.mock('~/server/domains/gift/gift.repository')
jest.mock('~/server/domains/website/website.repository')

import { HouseholdManagementService } from '~/server/application/household-management/household-management.service'
import type { AuthzContext } from '~/server/authz/authorization.types'
import { GiftRepository } from '~/server/domains/gift/gift.repository'
import { GuestRepository } from '~/server/domains/guest/guest.repository'
import {
  HouseholdRepository,
  mockDeleteAllForWedding,
  resetMocks as resetHouseholdMocks,
} from '~/server/domains/household/household.repository'
import { InvitationRepository } from '~/server/domains/invitation/invitation.repository'
import { WebsiteRepository } from '~/server/domains/website/website.repository'

const contextFor = (role: string): AuthzContext => ({
  userId: 'actor-1',
  activeOrganization: { organizationId: 'org-1', role },
})

describe('HouseholdManagementService.deleteAllHouseholds() authorization', () => {
  let service: HouseholdManagementService

  beforeEach(() => {
    resetHouseholdMocks()
    mockDeleteAllForWedding.mockResolvedValue(3)

    service = new HouseholdManagementService(
      new HouseholdRepository({} as never),
      new GuestRepository({} as never),
      new InvitationRepository({} as never),
      new GiftRepository({} as never),
      new WebsiteRepository({} as never),
      {} as never
    )
  })

  it.each(['admin', 'family', 'member'])('throws FORBIDDEN for role %s', async (role) => {
    await expect(
      service.deleteAllHouseholds(contextFor(role), 'wedding-123')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    expect(mockDeleteAllForWedding).not.toHaveBeenCalled()
  })

  it('succeeds for owner', async () => {
    const result = await service.deleteAllHouseholds(contextFor('owner'), 'wedding-123')

    expect(result).toEqual({ deleted: 3 })
    expect(mockDeleteAllForWedding).toHaveBeenCalledWith('wedding-123')
  })
})
