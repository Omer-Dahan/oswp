/**
 * Cross-layer regression test: editing a household's details (address, side,
 * notes, a member's name/tags/age-group, ...) must never rewrite RSVPs.
 *
 * Unlike household-management.service.test.ts, GuestRepository and
 * InvitationRepository are NOT mocked here - they run against a small
 * in-memory fake Prisma `tx`, so assertions check the actual surviving
 * invitation rows rather than which mock functions were called.
 */

jest.mock('~/server/authz/permission-checker', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('~/server/domains/household/household.repository')
jest.mock('~/server/domains/gift/gift.repository')
jest.mock('~/server/domains/website/website.repository')

import { HouseholdManagementService } from '~/server/application/household-management/household-management.service'
import { requirePermission } from '~/server/authz/permission-checker'
import { GiftRepository } from '~/server/domains/gift/gift.repository'
import { GuestRepository } from '~/server/domains/guest/guest.repository'
import {
  HouseholdRepository,
  mockBelongsToWedding as mockHouseholdBelongsToWedding,
  mockUpdate as mockHouseholdUpdate,
  mockHousehold,
  resetMocks as resetHouseholdMocks,
} from '~/server/domains/household/household.repository'
import { InvitationRepository } from '~/server/domains/invitation/invitation.repository'
import { WebsiteRepository } from '~/server/domains/website/website.repository'

const mockRequirePermission = requirePermission as jest.Mock
const mockHouseholdBelongsToWeddingFn = mockHouseholdBelongsToWedding as jest.Mock

const weddingId = 'wedding-1'
const householdId = 'household-1'

type FakeGuest = {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  householdId: string
  weddingId: string
  isPrimaryContact: boolean
  ageGroup: string | null
  isTagAlong: boolean
}

type FakeInvitation = { guestId: number; eventId: string; rsvp: string; weddingId: string }

// A tiny in-memory stand-in for Prisma, covering only the guest/invitation
// calls this flow makes, so GuestRepository and InvitationRepository can run
// unmocked and we can assert on the data they actually left behind.
const createFakeDb = (seedGuests: FakeGuest[], seedInvitations: FakeInvitation[]) => {
  const guestStore: FakeGuest[] = seedGuests.map((g) => ({ ...g }))
  const invitationStore: FakeInvitation[] = seedInvitations.map((i) => ({ ...i }))
  let nextGuestId = Math.max(0, ...guestStore.map((g) => g.id)) + 1

  const fakeDb = {
    guest: {
      findFirst: jest.fn(async ({ where }: { where: { id: number; weddingId: string } }) => {
        const guest = guestStore.find((g) => g.id === where.id && g.weddingId === where.weddingId)
        return guest ? { id: guest.id } : null
      }),
      upsert: jest.fn(
        async ({
          where,
          update,
          create,
        }: {
          where: { id: number }
          // biome-ignore lint/suspicious/noExplicitAny: test fake mirrors Prisma's loosely-typed args
          update: any
          // biome-ignore lint/suspicious/noExplicitAny: test fake mirrors Prisma's loosely-typed args
          create: any
        }) => {
          const existing = guestStore.find((g) => g.id === where.id)
          if (existing) {
            Object.assign(existing, {
              firstName: update.firstName,
              lastName: update.lastName,
              email: update.email,
              phone: update.phone,
              isPrimaryContact: update.isPrimaryContact,
              ageGroup: update.ageGroup,
              isTagAlong: update.isTagAlong,
            })
            return { ...existing }
          }

          const created: FakeGuest = {
            id: nextGuestId++,
            firstName: create.firstName,
            lastName: create.lastName,
            email: create.email,
            phone: create.phone,
            householdId: create.householdId,
            weddingId: create.weddingId,
            isPrimaryContact: create.isPrimaryContact,
            ageGroup: create.ageGroup,
            isTagAlong: create.isTagAlong,
          }
          guestStore.push(created)
          const invitationsToCreate = create.invitations?.createMany?.data ?? []
          invitationStore.push(
            // biome-ignore lint/suspicious/noExplicitAny: test fake mirrors Prisma's loosely-typed args
            ...invitationsToCreate.map((inv: any) => ({ ...inv, guestId: created.id }))
          )
          return { ...created }
        }
      ),
      updateMany: jest.fn(async () => ({ count: 0 })),
      findUnique: jest.fn(async ({ where }: { where: { id: number } }) => {
        const guest = guestStore.find((g) => g.id === where.id)
        if (!guest) return null
        return {
          ...guest,
          invitations: invitationStore.filter((i) => i.guestId === guest.id),
          guestTagAssignments: [],
        }
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    guestTagAssignment: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    invitation: {
      deleteMany: jest.fn(
        async ({ where }: { where: { guestId: number; eventId?: { notIn: string[] } } }) => {
          const before = invitationStore.length
          for (let i = invitationStore.length - 1; i >= 0; i--) {
            const inv = invitationStore[i]
            if (inv.guestId !== where.guestId) continue
            const allowed = where.eventId?.notIn
            if (allowed === undefined || !allowed.includes(inv.eventId)) {
              invitationStore.splice(i, 1)
            }
          }
          return { count: before - invitationStore.length }
        }
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { guestId_eventId: { guestId: number; eventId: string } }
          data: { rsvp?: string }
        }) => {
          const inv = invitationStore.find(
            (i) =>
              i.guestId === where.guestId_eventId.guestId &&
              i.eventId === where.guestId_eventId.eventId
          )
          if (inv && data.rsvp !== undefined) inv.rsvp = data.rsvp
          return inv ? { ...inv } : null
        }
      ),
    },
    event: {
      findFirst: jest.fn(async () => ({ id: 'event-1' })),
      findMany: jest.fn(async () => []),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(fakeDb)),
  }

  return { fakeDb, guestStore, invitationStore }
}

describe('updateHouseholdWithGuests: RSVPs survive a household-details-only edit', () => {
  const authz = { userId: 'actor-1', activeOrganization: null }

  const buildService = (fakeDb: ReturnType<typeof createFakeDb>['fakeDb']) => {
    const householdRepo = new HouseholdRepository({} as never)
    const guestRepo = new GuestRepository(fakeDb as never)
    const invitationRepo = new InvitationRepository(fakeDb as never)
    const giftRepo = new GiftRepository({} as never)
    const websiteRepo = new WebsiteRepository({} as never)

    return new HouseholdManagementService(
      householdRepo,
      guestRepo,
      invitationRepo,
      giftRepo,
      websiteRepo,
      fakeDb as never
    )
  }

  beforeEach(() => {
    resetHouseholdMocks()
    mockRequirePermission.mockReset()
    mockRequirePermission.mockReturnValue({ organizationId: 'org-1', role: 'admin' })
    mockHouseholdBelongsToWeddingFn.mockResolvedValue(true)
    mockHouseholdUpdate.mockResolvedValue(mockHousehold)
  })

  it('sends no invites for an existing guest -> no update and no delete, RSVP stays Attending', async () => {
    const { fakeDb, invitationStore } = createFakeDb(
      [
        {
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          email: null,
          phone: null,
          householdId,
          weddingId,
          isPrimaryContact: true,
          ageGroup: 'ADULT',
          isTagAlong: false,
        },
      ],
      [{ guestId: 1, eventId: 'event-1', rsvp: 'Attending', weddingId }]
    )
    const service = buildService(fakeDb)

    await service.updateHouseholdWithGuests(authz, weddingId, {
      householdId,
      side: 'כלה',
      guestParty: [
        {
          guestId: 1,
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: {},
        },
      ],
      gifts: [],
    })

    expect(fakeDb.invitation.update).not.toHaveBeenCalled()
    expect(fakeDb.invitation.deleteMany).not.toHaveBeenCalled()
    expect(invitationStore).toEqual([
      { guestId: 1, eventId: 'event-1', rsvp: 'Attending', weddingId },
    ])
  })

  it('sends no invites for an existing tag-along -> does not wipe their invitations either', async () => {
    const { fakeDb, invitationStore } = createFakeDb(
      [
        {
          id: 1,
          firstName: 'Tag',
          lastName: 'Along',
          email: null,
          phone: null,
          householdId,
          weddingId,
          isPrimaryContact: false,
          ageGroup: 'ADULT',
          isTagAlong: true,
        },
      ],
      [{ guestId: 1, eventId: 'event-1', rsvp: 'Attending', weddingId }]
    )
    const service = buildService(fakeDb)

    await service.updateHouseholdWithGuests(authz, weddingId, {
      householdId,
      notes: 'updated notes',
      guestParty: [
        {
          guestId: 1,
          firstName: 'Tag',
          lastName: 'Along',
          isTagAlong: true,
          invites: {},
        },
      ],
      gifts: [],
    })

    expect(fakeDb.invitation.deleteMany).not.toHaveBeenCalled()
    expect(invitationStore).toEqual([
      { guestId: 1, eventId: 'event-1', rsvp: 'Attending', weddingId },
    ])
  })

  it('a brand-new guest (no guestId) still receives the default "Not Invited" rows', async () => {
    const { fakeDb, invitationStore, guestStore } = createFakeDb([], [])
    fakeDb.event.findMany = jest.fn(async () => [{ id: 'event-1' }, { id: 'event-2' }])
    const service = buildService(fakeDb)

    await service.updateHouseholdWithGuests(authz, weddingId, {
      householdId,
      guestParty: [
        {
          firstName: 'New',
          lastName: 'Guest',
          isPrimaryContact: true,
          invites: {},
        },
      ],
      gifts: [],
    })

    expect(guestStore).toHaveLength(1)
    const newGuestId = guestStore[0]?.id
    expect(invitationStore).toEqual(
      expect.arrayContaining([
        { guestId: newGuestId, eventId: 'event-1', rsvp: 'Not Invited', weddingId },
        { guestId: newGuestId, eventId: 'event-2', rsvp: 'Not Invited', weddingId },
      ])
    )
    expect(invitationStore).toHaveLength(2)
  })

  it('an explicit RSVP change sent for an existing guest still writes', async () => {
    const { fakeDb, invitationStore } = createFakeDb(
      [
        {
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          email: null,
          phone: null,
          householdId,
          weddingId,
          isPrimaryContact: true,
          ageGroup: 'ADULT',
          isTagAlong: false,
        },
      ],
      [{ guestId: 1, eventId: 'event-1', rsvp: 'Invited', weddingId }]
    )
    const service = buildService(fakeDb)

    await service.updateHouseholdWithGuests(authz, weddingId, {
      householdId,
      guestParty: [
        {
          guestId: 1,
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          invites: { 'event-1': 'Declined' },
        },
      ],
      gifts: [],
    })

    expect(invitationStore).toEqual([
      { guestId: 1, eventId: 'event-1', rsvp: 'Declined', weddingId },
    ])
  })
})
