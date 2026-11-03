/**
 * Cross-layer regression test for the 2026-11-03 "edit shows success but
 * nothing saves" bug.
 *
 * Unlike household-management.service.test.ts, this does NOT mock
 * `~/server/domains/household/household.repository` - it runs the real
 * HouseholdRepository.update against a stubbed Prisma `tx.household.update`,
 * so the test exercises the actual zod parsing -> service -> repository ->
 * Prisma-data mapping rather than re-asserting a mocked repository call.
 */

jest.mock('~/server/authz/permission-checker', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('~/server/domains/guest/guest.repository')
jest.mock('~/server/domains/invitation/invitation.repository')
jest.mock('~/server/domains/gift/gift.repository')
jest.mock('~/server/domains/website/website.repository')

import { HouseholdManagementService } from '~/server/application/household-management/household-management.service'
import { requirePermission } from '~/server/authz/permission-checker'
import { updateHouseholdSchema } from '~/server/domains/household/household.validator'
import { GiftRepository } from '~/server/domains/gift/gift.repository'
import {
  GuestRepository,
  mockBelongsToWedding as mockGuestBelongsToWedding,
  mockClearPrimaryContactsByHousehold,
  mockFindByIdWithInvitations as mockGuestFindByIdWithInvitations,
  mockUpdateTags as mockGuestUpdateTags,
  mockUpsert as mockGuestUpsert,
  mockGuestWithInvitations,
  resetMocks as resetGuestMocks,
} from '~/server/domains/guest/guest.repository'
import { HouseholdRepository } from '~/server/domains/household/household.repository'
import { InvitationRepository } from '~/server/domains/invitation/invitation.repository'
import { WebsiteRepository } from '~/server/domains/website/website.repository'

const mockRequirePermission = requirePermission as jest.Mock
const mockGuestBelongsToWeddingFn = mockGuestBelongsToWedding as jest.Mock

const authz = { userId: 'actor-1', activeOrganization: null }
const weddingId = 'wedding-1'
const householdId = 'household-1'

describe('updateHouseholdWithGuests: zod schema -> real HouseholdRepository', () => {
  let householdUpdateMock: jest.Mock
  let service: HouseholdManagementService

  beforeEach(() => {
    resetGuestMocks()
    mockRequirePermission.mockReset()
    mockRequirePermission.mockReturnValue({ organizationId: 'org-1', role: 'admin' })
    mockGuestBelongsToWeddingFn.mockResolvedValue(true)
    mockGuestUpsert.mockResolvedValue(mockGuestWithInvitations)
    mockGuestFindByIdWithInvitations.mockResolvedValue(mockGuestWithInvitations)

    householdUpdateMock = jest.fn().mockResolvedValue({ id: householdId })
    const tx = {
      household: { update: householdUpdateMock },
      event: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const fakeDb = {
      household: { findFirst: jest.fn().mockResolvedValue({ id: householdId }) },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    }

    // Real HouseholdRepository, bound to the fake Prisma client above - this
    // is also the class the service constructs internally (unmocked) inside
    // $transaction, bound to `tx`.
    const householdRepo = new HouseholdRepository(fakeDb as never)
    const guestRepo = new GuestRepository({} as never)
    const invitationRepo = new InvitationRepository({} as never)
    const giftRepo = new GiftRepository({} as never)
    const websiteRepo = new WebsiteRepository({} as never)

    service = new HouseholdManagementService(
      householdRepo,
      guestRepo,
      invitationRepo,
      giftRepo,
      websiteRepo,
      fakeDb as never
    )
  })

  const parse = (raw: unknown) => {
    const result = updateHouseholdSchema.safeParse(raw)
    if (!result.success) throw new Error(result.error.message)
    return result.data
  }

  it('writes a newly-set side to Prisma, leaving other fields untouched', async () => {
    const input = parse({
      householdId,
      side: 'כלה',
      guestParty: [{ guestId: 1, firstName: 'John', lastName: 'Doe', isPrimaryContact: true, invites: {} }],
      gifts: [],
    })

    await service.updateHouseholdWithGuests(authz, weddingId, input)

    expect(householdUpdateMock).toHaveBeenCalledTimes(1)
    const data = householdUpdateMock.mock.calls[0]?.[0]?.data
    expect(data.side).toBe('כלה')
    expect(data.city).toBeUndefined()
    expect(data.groupName).toBeUndefined()
  })

  it('clears an existing side when the edit sends null, instead of leaving the old value', async () => {
    const input = parse({
      householdId,
      side: null,
      guestParty: [{ guestId: 1, firstName: 'John', lastName: 'Doe', isPrimaryContact: true, invites: {} }],
      gifts: [],
    })

    await service.updateHouseholdWithGuests(authz, weddingId, input)

    const data = householdUpdateMock.mock.calls[0]?.[0]?.data
    expect(data.side).toBeNull()
  })

  it('clears city when the edit sends null, without collapsing it into "skip"', async () => {
    const input = parse({
      householdId,
      city: null,
      guestParty: [{ guestId: 1, firstName: 'John', lastName: 'Doe', isPrimaryContact: true, invites: {} }],
      gifts: [],
    })

    await service.updateHouseholdWithGuests(authz, weddingId, input)

    const data = householdUpdateMock.mock.calls[0]?.[0]?.data
    expect(data.city).toBeNull()
    expect(data.side).toBeUndefined()
  })
})
