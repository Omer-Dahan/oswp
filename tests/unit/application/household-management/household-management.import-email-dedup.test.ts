/**
 * Tests for HouseholdManagementService.bulkCreateHouseholds() email dedup.
 *
 * A duplicate email (within the same import batch, or already present in the
 * wedding) must never fail a row: the guest is still created, just without an
 * email, and a Hebrew warning is surfaced instead.
 */

jest.mock('~/server/authz/permission-checker', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('~/server/domains/household/household.repository')
jest.mock('~/server/domains/guest/guest.repository')
jest.mock('~/server/domains/invitation/invitation.repository')
jest.mock('~/server/domains/gift/gift.repository')
jest.mock('~/server/domains/website/website.repository')

import { HouseholdManagementService } from '~/server/application/household-management/household-management.service'
import { requirePermission } from '~/server/authz/permission-checker'
import { GiftRepository, resetMocks as resetGiftMocks } from '~/server/domains/gift/gift.repository'
import {
  GuestRepository,
  mockBelongsToWedding as mockGuestBelongsToWedding,
  mockCreate as mockGuestCreate,
  mockFindByIdWithInvitations as mockGuestFindByIdWithInvitations,
  resetMocks as resetGuestMocks,
} from '~/server/domains/guest/guest.repository'
import {
  HouseholdRepository,
  mockCreateWithGifts,
  mockFindImportKeys,
  resetMocks as resetHouseholdMocks,
} from '~/server/domains/household/household.repository'
import { DUPLICATE_EMAIL_WARNING } from '~/server/domains/household/household-import-matcher'
import {
  InvitationRepository,
  mockEventBelongsToWedding,
  resetMocks as resetInvitationMocks,
} from '~/server/domains/invitation/invitation.repository'
import { WebsiteRepository } from '~/server/domains/website/website.repository'

const mockRequirePermission = requirePermission as jest.Mock
const mockGuestBelongsToWeddingFn = mockGuestBelongsToWedding as jest.Mock
const mockEventBelongsToWeddingFn = mockEventBelongsToWedding as jest.Mock

const mockCreatedHousehold = {
  id: 'household-1',
  weddingId: 'wedding-123',
  address1: null,
  address2: null,
  city: null,
  state: null,
  country: null,
  zipCode: null,
  likelihoodOfAttending: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  guests: [],
  gifts: [],
}

const createMockDb = () => {
  const tx = {
    __tx: true,
    event: { findMany: jest.fn().mockResolvedValue([{ id: 'event-123' }]) },
  }
  return {
    tx,
    $transaction: jest
      .fn()
      .mockImplementation(async (callback: (txArg: typeof tx) => unknown) => callback(tx)),
  }
}

const household = (firstName: string, email?: string) => ({
  guestParty: [
    {
      firstName,
      lastName: 'Guest',
      email,
      isPrimaryContact: true,
      invites: { 'event-123': 'Invited' },
    },
  ],
})

describe('HouseholdManagementService.bulkCreateHouseholds() email dedup', () => {
  let service: HouseholdManagementService
  let mockDb: ReturnType<typeof createMockDb>

  const actorContext = { userId: 'actor-1', activeOrganization: null }

  beforeEach(() => {
    resetHouseholdMocks()
    resetGuestMocks()
    resetInvitationMocks()
    resetGiftMocks()

    mockDb = createMockDb()

    mockRequirePermission.mockReset()
    mockRequirePermission.mockReturnValue({ organizationId: 'org-1', role: 'admin' })
    mockGuestBelongsToWeddingFn.mockResolvedValue(true)
    mockEventBelongsToWeddingFn.mockResolvedValue(true)

    mockCreateWithGifts.mockResolvedValue(mockCreatedHousehold)

    let nextGuestId = 1
    mockGuestCreate.mockImplementation((data) =>
      Promise.resolve({
        id: nextGuestId++,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        isPrimaryContact: data.isPrimaryContact ?? false,
        isTagAlong: data.isTagAlong ?? false,
        ageGroup: data.ageGroup ?? null,
        householdId: 'household-1',
        weddingId: 'wedding-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    )
    mockGuestFindByIdWithInvitations.mockImplementation((id) =>
      Promise.resolve({
        id,
        firstName: 'x',
        lastName: 'y',
        email: null,
        phone: null,
        isPrimaryContact: true,
        isTagAlong: false,
        ageGroup: null,
        householdId: 'household-1',
        weddingId: 'wedding-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        invitations: [],
        guestTagAssignments: [],
      })
    )

    const mockHouseholdRepo = new HouseholdRepository({} as never)
    const mockGuestRepo = new GuestRepository({} as never)
    const mockInvitationRepo = new InvitationRepository({} as never)
    const mockGiftRepo = new GiftRepository({} as never)
    const mockWebsiteRepo = new WebsiteRepository({} as never)

    service = new HouseholdManagementService(
      mockHouseholdRepo,
      mockGuestRepo,
      mockInvitationRepo,
      mockGiftRepo,
      mockWebsiteRepo,
      mockDb as never
    )
  })

  it('creates all eight guests when two of eight rows share an email, warning instead of failing', async () => {
    const households = [
      household('G1'),
      household('G2'),
      household('G3', 'dup@example.com'),
      household('G4'),
      household('G5'),
      household('G6'),
      household('G7', 'Dup@Example.com '),
      household('G8'),
    ]

    const result = await service.bulkCreateHouseholds(actorContext, 'wedding-123', households)

    expect(result.created).toBe(8)
    expect(result.failed).toBe(0)
    expect(result.warnings).toEqual([DUPLICATE_EMAIL_WARNING])

    // G3 kept its email (first to claim it), G7 lost its email and got the warning.
    expect(mockGuestCreate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ email: 'dup@example.com' })
    )
    expect(mockGuestCreate).toHaveBeenNthCalledWith(7, expect.objectContaining({ email: null }))

    // Every household is still created on its own - no merging.
    expect(mockCreateWithGifts).toHaveBeenCalledTimes(8)
  })

  it('drops the email and warns when it already belongs to an existing guest in the wedding', async () => {
    mockFindImportKeys.mockResolvedValue({
      phones: [],
      names: [],
      emails: ['existing@example.com'],
    })

    const result = await service.bulkCreateHouseholds(actorContext, 'wedding-123', [
      household('G1', 'existing@example.com'),
    ])

    expect(result.created).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.warnings).toEqual([DUPLICATE_EMAIL_WARNING])
    expect(mockGuestCreate).toHaveBeenCalledWith(expect.objectContaining({ email: null }))
  })
})
