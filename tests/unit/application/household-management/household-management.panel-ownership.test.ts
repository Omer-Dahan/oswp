/**
 * Cross-layer regression tests for the two guest-list save panels
 * overwriting each other's data (audit 2026-11-03, blocker #2 and minor #8).
 *
 * The drawer ("פרטי האורח") owns household fields plus the primary contact's
 * email/phone. The members editor ("ניהול חברים") owns guest names,
 * ageGroup, tags, isTagAlong, isPrimaryContact, and membership itself. Each
 * panel's save must leave the other panel's fields exactly as they are in
 * the database, not as they were in the stale snapshot the panel loaded.
 *
 * Like household-management.update-household-rsvp-preservation.test.ts,
 * HouseholdRepository and GuestRepository are NOT mocked here - they run
 * against a small in-memory fake Prisma `tx`, so assertions check what was
 * actually written (or left alone) rather than which mock functions were
 * called with which arguments.
 */

jest.mock('~/server/authz/permission-checker', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('~/server/domains/invitation/invitation.repository')
jest.mock('~/server/domains/gift/gift.repository')
jest.mock('~/server/domains/website/website.repository')

import { HouseholdManagementService } from '~/server/application/household-management/household-management.service'
import { requirePermission } from '~/server/authz/permission-checker'
import { GiftRepository } from '~/server/domains/gift/gift.repository'
import { GuestRepository } from '~/server/domains/guest/guest.repository'
import { HouseholdRepository } from '~/server/domains/household/household.repository'
import { InvitationRepository } from '~/server/domains/invitation/invitation.repository'
import { WebsiteRepository } from '~/server/domains/website/website.repository'

const mockRequirePermission = requirePermission as jest.Mock

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

type FakeTagAssignment = { guestId: number; guestTagId: string }

// biome-ignore lint/suspicious/noExplicitAny: test fake mirrors Prisma's loosely-typed args
type AnyArgs = any

/**
 * A tiny in-memory stand-in for Prisma, covering only the household/guest/
 * tag calls this flow makes, so HouseholdRepository and GuestRepository can
 * run unmocked and assertions can check the data they actually left behind -
 * including fields neither repository call even mentions (the "survives"
 * assertions below).
 */
const createFakeDb = (seedGuests: FakeGuest[], seedTags: FakeTagAssignment[] = []) => {
  const guestStore: FakeGuest[] = seedGuests.map((g) => ({ ...g }))
  const tagStore: FakeTagAssignment[] = seedTags.map((t) => ({ ...t }))
  let nextGuestId = Math.max(0, ...guestStore.map((g) => g.id)) + 1
  const householdUpdateMock = jest.fn().mockResolvedValue({ id: householdId })

  const fakeDb = {
    household: {
      findFirst: jest.fn().mockResolvedValue({ id: householdId }),
      update: householdUpdateMock,
    },
    guest: {
      findFirst: jest.fn(async ({ where }: AnyArgs) => {
        const guest = guestStore.find((g) => g.id === where.id && g.weddingId === where.weddingId)
        return guest ? { id: guest.id } : null
      }),
      findUnique: jest.fn(async ({ where }: AnyArgs) => {
        const guest = guestStore.find((g) => g.id === where.id)
        if (!guest) return null
        return {
          ...guest,
          invitations: [],
          guestTagAssignments: tagStore
            .filter((t) => t.guestId === guest.id)
            .map((t) => ({ guestTagId: t.guestTagId })),
        }
      }),
      upsert: jest.fn(async ({ where, update, create }: AnyArgs) => {
        const existing = guestStore.find((g) => g.id === where.id)
        if (existing) {
          for (const [key, value] of Object.entries(update)) {
            if (value !== undefined) (existing as AnyArgs)[key] = value
          }
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
        return { ...created }
      }),
      updateMany: jest.fn(async ({ where, data }: AnyArgs) => {
        let count = 0
        for (const guest of guestStore) {
          if (guest.householdId === where.householdId) {
            Object.assign(guest, data)
            count++
          }
        }
        return { count }
      }),
      deleteMany: jest.fn(async ({ where }: AnyArgs) => {
        const before = guestStore.length
        for (let i = guestStore.length - 1; i >= 0; i--) {
          if (where.id.in.includes(guestStore[i]?.id)) guestStore.splice(i, 1)
        }
        return { count: before - guestStore.length }
      }),
    },
    guestTagAssignment: {
      deleteMany: jest.fn(async ({ where }: AnyArgs) => {
        const before = tagStore.length
        for (let i = tagStore.length - 1; i >= 0; i--) {
          if (tagStore[i]?.guestId === where.guestId) tagStore.splice(i, 1)
        }
        return { count: before - tagStore.length }
      }),
      createMany: jest.fn(async ({ data }: { data: FakeTagAssignment[] }) => {
        tagStore.push(...data)
        return { count: data.length }
      }),
    },
    invitation: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      update: jest.fn(async () => null),
    },
    event: {
      findFirst: jest.fn(async () => ({ id: 'event-1' })),
      findMany: jest.fn(async () => []),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(fakeDb)),
  }

  return { fakeDb, guestStore, tagStore, householdUpdateMock }
}

describe('updateHouseholdWithGuests: the drawer and members panels only touch what they own', () => {
  const authz = { userId: 'actor-1', activeOrganization: null }

  const buildService = (fakeDb: ReturnType<typeof createFakeDb>['fakeDb']) => {
    const householdRepo = new HouseholdRepository(fakeDb as never)
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
    mockRequirePermission.mockReset()
    mockRequirePermission.mockReturnValue({ organizationId: 'org-1', role: 'admin' })
  })

  it('drawer-shaped payload (household fields + primary contact email only) leaves a concurrently-renamed second guest, its tags, and its primary-contact flag untouched', async () => {
    const { fakeDb, guestStore, tagStore, householdUpdateMock } = createFakeDb(
      [
        {
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          email: 'old@example.com',
          phone: null,
          householdId,
          weddingId,
          isPrimaryContact: true,
          ageGroup: 'ADULT',
          isTagAlong: false,
        },
        {
          id: 2,
          // Already renamed directly in the DB by a concurrent edit the
          // drawer's stale snapshot never saw.
          firstName: 'Janet',
          lastName: 'Renamed',
          email: null,
          phone: null,
          householdId,
          weddingId,
          isPrimaryContact: false,
          ageGroup: 'ADULT',
          isTagAlong: false,
        },
      ],
      [{ guestId: 2, guestTagId: 'tag-b' }]
    )
    const service = buildService(fakeDb)

    await service.updateHouseholdWithGuests(authz, weddingId, {
      householdId,
      address1: 'New Address 1',
      guestParty: [
        {
          guestId: 1,
          email: 'new@example.com',
          phone: null,
          invites: {},
        },
      ],
      gifts: [],
    })

    // The drawer's own field is written.
    expect(householdUpdateMock.mock.calls[0]?.[0]?.data.address1).toBe('New Address 1')
    const guest1 = guestStore.find((g) => g.id === 1)
    expect(guest1?.email).toBe('new@example.com')

    // Everything the drawer doesn't own survives untouched.
    const guest2 = guestStore.find((g) => g.id === 2)
    expect(guest2?.firstName).toBe('Janet')
    expect(guest2?.lastName).toBe('Renamed')
    expect(tagStore).toEqual([{ guestId: 2, guestTagId: 'tag-b' }])
    expect(guest1?.isPrimaryContact).toBe(true)
    expect(guest2?.isPrimaryContact).toBe(false)
  })

  it('members-shaped payload (names/tags only) leaves the household address and side untouched', async () => {
    const { fakeDb, guestStore, householdUpdateMock } = createFakeDb([
      {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+10000000000',
        householdId,
        weddingId,
        isPrimaryContact: true,
        ageGroup: 'ADULT',
        isTagAlong: false,
      },
    ])
    const service = buildService(fakeDb)

    await service.updateHouseholdWithGuests(authz, weddingId, {
      householdId,
      guestParty: [
        {
          guestId: 1,
          firstName: 'Johnathan',
          lastName: 'Doe',
          isPrimaryContact: true,
          ageGroup: 'ADULT',
          isTagAlong: false,
          tagIds: ['tag-a'],
          invites: {},
        },
      ],
      gifts: [],
    })

    // The members panel's own fields are written.
    const guest1 = guestStore.find((g) => g.id === 1)
    expect(guest1?.firstName).toBe('Johnathan')

    // Household fields this panel doesn't send are left alone - Prisma never
    // even sees an address1/side key, so whatever is already in the real
    // column survives.
    const writtenData = householdUpdateMock.mock.calls[0]?.[0]?.data
    expect(writtenData.address1).toBeUndefined()
    expect(writtenData.side).toBeUndefined()

    // Email/phone are the drawer's, not the members panel's - unaffected.
    expect(guest1?.email).toBe('john@example.com')
    expect(guest1?.phone).toBe('+10000000000')
  })

  it('a brand-new member with no guestId is created with a real id, while a stale fabricated negative id is rejected before it ever reaches the repository', async () => {
    const { fakeDb, guestStore } = createFakeDb([
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
    ])
    const service = buildService(fakeDb)

    const result = await service.updateHouseholdWithGuests(authz, weddingId, {
      householdId,
      guestParty: [
        {
          guestId: 1,
          firstName: 'John',
          lastName: 'Doe',
          isPrimaryContact: true,
          ageGroup: 'ADULT',
          isTagAlong: false,
          tagIds: [],
          invites: {},
        },
        {
          // No guestId - a brand-new member, exactly as guests-view.tsx now
          // sends it (never a fabricated negative placeholder).
          firstName: 'New',
          lastName: 'Member',
          isPrimaryContact: false,
          ageGroup: 'ADULT',
          isTagAlong: false,
          tagIds: [],
          invites: {},
        },
      ],
      gifts: [],
    })

    const newGuest = result.guests[1]
    expect(newGuest?.id).toBeGreaterThan(0)
    expect(guestStore.some((g) => g.id === newGuest?.id && g.firstName === 'New')).toBe(true)

    // Simulates the exact pre-fix bug: the optimistic UI patch fabricated a
    // negative id for the member above, and the NEXT save sent it back as
    // guestId. That id belongs to no one, so the request must be rejected
    // before any repository write - not silently accepted or misrouted to
    // guest 1.
    await expect(
      service.updateHouseholdWithGuests(authz, weddingId, {
        householdId,
        guestParty: [
          {
            guestId: -1,
            firstName: 'New',
            lastName: 'Member',
            isPrimaryContact: false,
            ageGroup: 'ADULT',
            isTagAlong: false,
            tagIds: [],
            invites: {},
          },
        ],
        gifts: [],
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
