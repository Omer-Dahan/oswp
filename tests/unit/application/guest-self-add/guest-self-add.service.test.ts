/**
 * Tests for the Guest Self-Add Application Service
 */

import { GuestSelfAddService } from '~/server/application/guest-self-add/guest-self-add.service'
import { guestSelfAddSchema } from '~/server/application/guest-self-add/guest-self-add.validator'

type FakeHousehold = {
  id: string
  weddingId: string
  side: string | null
  groupName: string | null
  attendingCount: number | null
  invitedCount: number | null
  notes: string | null
}

type FakeGuest = {
  id: number
  weddingId: string
  householdId: string
  firstName: string
  lastName: string
  phone: string | null
  isPrimaryContact: boolean
  ageGroup: string
}

type FakeInvitation = {
  weddingId: string
  guestId: number
  eventId: string
  rsvp: string
  submittedBy: number
  submittedAt: Date
}

const EVENTS = [
  { id: 'event-wedding', name: 'חתונה', isPrimary: true, collectRsvp: true },
  { id: 'event-chuppah', name: 'חופה', isPrimary: false, collectRsvp: true },
]

function createFakeDb(options: { isRsvpEnabled?: boolean } = {}) {
  const households: FakeHousehold[] = []
  const guests: FakeGuest[] = []
  const invitations: FakeInvitation[] = []
  let householdSeq = 0
  let guestSeq = 0

  // biome-ignore lint/suspicious/noExplicitAny: test fake, shapes mirror the Prisma calls the service makes
  const txClient: any = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    guest: {
      findMany: jest.fn(async ({ where }: { where: { weddingId: string } }) =>
        guests.filter((g) => g.weddingId === where.weddingId && g.phone !== null)
      ),
      create: jest.fn(async ({ data }: { data: Omit<FakeGuest, 'id'> }) => {
        const guest: FakeGuest = { id: ++guestSeq, ...data }
        guests.push(guest)
        return guest
      }),
    },
    household: {
      create: jest.fn(async ({ data }: { data: Omit<FakeHousehold, 'id'> }) => {
        const household: FakeHousehold = { id: `household-${++householdSeq}`, ...data }
        households.push(household)
        return household
      }),
    },
    event: {
      findMany: jest.fn(async () => EVENTS),
    },
    invitation: {
      createMany: jest.fn(async ({ data }: { data: FakeInvitation[] }) => {
        invitations.push(...data)
        return { count: data.length }
      }),
    },
  }

  // A real Postgres advisory lock serialises concurrent transactions
  // contending on the same key; this queue reproduces that effect so the
  // concurrency test below exercises the service's actual dedup logic
  // instead of asserting on a contrived mock.
  let chain: Promise<unknown> = Promise.resolve()

  return {
    households,
    guests,
    invitations,
    website: {
      findFirst: jest.fn().mockResolvedValue({
        weddingId: 'wedding-1',
        isRsvpEnabled: options.isRsvpEnabled ?? true,
      }),
    },
    rateLimitBucket: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const run = chain.then(() => fn(txClient))
      chain = run.then(
        () => undefined,
        () => undefined
      )
      return run
    }),
  }
}

const validInput = guestSelfAddSchema.parse({
  subUrl: 'our-wedding',
  fullName: 'דנה כהן',
  phone: '0501234567',
  attendingCount: 2,
})

describe('GuestSelfAddService', () => {
  describe('happy path', () => {
    it('creates one household with the right group, null side, and both invitations attending', async () => {
      const fakeDb = createFakeDb()
      // biome-ignore lint/suspicious/noExplicitAny: test fake stands in for PrismaClient
      const service = new GuestSelfAddService(fakeDb as any)

      const result = await service.addSelf(validInput, '203.0.113.5')

      expect(result).toEqual({ kind: 'received' })
      expect(Object.keys(result)).toEqual(['kind'])

      expect(fakeDb.households).toHaveLength(1)
      expect(fakeDb.households[0]).toMatchObject({
        weddingId: 'wedding-1',
        side: null,
        groupName: 'נוספו עצמאית',
        attendingCount: 2,
        invitedCount: 2,
      })
      expect(fakeDb.households[0]?.notes).toMatch(/^נוסף עצמאית מהקישור הכללי \d{2}\.\d{2}\.\d{4}$/)

      expect(fakeDb.guests).toHaveLength(1)
      expect(fakeDb.guests[0]).toMatchObject({
        firstName: 'דנה',
        lastName: 'כהן',
        phone: '+972501234567',
        isPrimaryContact: true,
      })

      expect(fakeDb.invitations).toHaveLength(2)
      for (const invitation of fakeDb.invitations) {
        expect(invitation.rsvp).toBe('Attending')
        expect(invitation.submittedBy).toBe(fakeDb.guests[0]?.id)
      }
      expect(fakeDb.invitations.map((i) => i.eventId).sort()).toEqual(
        ['event-chuppah', 'event-wedding'].sort()
      )
    })
  })

  describe('duplicate phone', () => {
    it('returns the neutral response and writes nothing new', async () => {
      const fakeDb = createFakeDb()
      // biome-ignore lint/suspicious/noExplicitAny: test fake stands in for PrismaClient
      const service = new GuestSelfAddService(fakeDb as any)

      const first = await service.addSelf(validInput, '203.0.113.5')
      expect(first).toEqual({ kind: 'received' })

      const second = await service.addSelf(validInput, '203.0.113.6')

      expect(second).toEqual({ kind: 'received' })
      expect(Object.keys(second)).toEqual(['kind'])
      expect(fakeDb.households).toHaveLength(1)
      expect(fakeDb.guests).toHaveLength(1)
    })
  })

  describe('rsvp disabled for the wedding', () => {
    it('rejects the submission without creating anything', async () => {
      const fakeDb = createFakeDb({ isRsvpEnabled: false })
      // biome-ignore lint/suspicious/noExplicitAny: test fake stands in for PrismaClient
      const service = new GuestSelfAddService(fakeDb as any)

      await expect(service.addSelf(validInput, '203.0.113.5')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
      expect(fakeDb.households).toHaveLength(0)
    })
  })

  describe('concurrency', () => {
    it('two concurrent submissions of the same phone yield one household', async () => {
      const fakeDb = createFakeDb()
      // biome-ignore lint/suspicious/noExplicitAny: test fake stands in for PrismaClient
      const service = new GuestSelfAddService(fakeDb as any)

      const [first, second] = await Promise.all([
        service.addSelf(validInput, '203.0.113.5'),
        service.addSelf(validInput, '203.0.113.6'),
      ])

      expect(first).toEqual({ kind: 'received' })
      expect(second).toEqual({ kind: 'received' })
      expect(fakeDb.households).toHaveLength(1)
      expect(fakeDb.guests).toHaveLength(1)
    })
  })

  describe('invalid phone', () => {
    it('returns the neutral response without creating rows', async () => {
      const fakeDb = createFakeDb()
      // biome-ignore lint/suspicious/noExplicitAny: test fake stands in for PrismaClient
      const service = new GuestSelfAddService(fakeDb as any)
      const invalidPhoneInput = guestSelfAddSchema.parse({ ...validInput, phone: '123' })

      const result = await service.addSelf(invalidPhoneInput, '203.0.113.5')

      expect(result).toEqual({ kind: 'received' })
      expect(Object.keys(result)).toEqual(['kind'])
      expect(fakeDb.households).toHaveLength(0)
      expect(fakeDb.guests).toHaveLength(0)
      expect(fakeDb.invitations).toHaveLength(0)
      expect(fakeDb.$transaction).toHaveBeenCalledTimes(1)
    })
  })
})
