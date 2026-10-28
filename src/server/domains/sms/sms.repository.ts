import type { PrismaClient, SmsOutbound } from '@prisma/client'

const primaryContactSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  isPrimaryContact: true,
} as const

export type SmsHouseholdRow = {
  id: string
  weddingId: string
  side: string | null
  groupName: string | null
  inviteCode: string | null
  guests: Array<{
    id: number
    firstName: string
    lastName: string
    phone: string | null
    isPrimaryContact: boolean
  }>
  smsOutbound: Array<{
    status: 'QUEUED' | 'SENT' | 'FAILED'
    error: string | null
  }>
}

export class SmsRepository {
  constructor(private db: PrismaClient) {}

  listGroomHouseholds(weddingId: string): Promise<SmsHouseholdRow[]> {
    return this.db.household.findMany({
      where: { weddingId, side: 'חתן' },
      orderBy: [{ groupName: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        weddingId: true,
        side: true,
        groupName: true,
        inviteCode: true,
        guests: {
          where: { isPrimaryContact: true },
          take: 1,
          select: primaryContactSelect,
        },
        smsOutbound: {
          where: { kind: 'INVITE' },
          take: 1,
          select: { status: true, error: true },
        },
      },
    })
  }

  findGroomHousehold(weddingId: string, householdId: string): Promise<SmsHouseholdRow | null> {
    return this.db.household.findFirst({
      where: { id: householdId, weddingId, side: 'חתן' },
      select: {
        id: true,
        weddingId: true,
        side: true,
        groupName: true,
        inviteCode: true,
        guests: {
          where: { isPrimaryContact: true },
          take: 1,
          select: primaryContactSelect,
        },
        smsOutbound: {
          where: { kind: 'INVITE' },
          take: 1,
          select: { status: true, error: true },
        },
      },
    })
  }

  queueInvite(input: {
    weddingId: string
    householdId: string
    guestId: number
    toPhone: string
    body: string
  }): Promise<SmsOutbound> {
    return this.db.smsOutbound.upsert({
      where: {
        weddingId_householdId_kind: {
          weddingId: input.weddingId,
          householdId: input.householdId,
          kind: 'INVITE',
        },
      },
      create: {
        ...input,
        kind: 'INVITE',
        status: 'QUEUED',
      },
      update: {
        guestId: input.guestId,
        toPhone: input.toPhone,
        body: input.body,
        status: 'QUEUED',
        providerMessageId: null,
        error: null,
        queuedAt: new Date(),
        sentAt: null,
      },
    })
  }

  markSent(id: string, providerMessageId?: string): Promise<SmsOutbound> {
    return this.db.smsOutbound.update({
      where: { id },
      data: {
        status: 'SENT',
        providerMessageId,
        error: null,
        sentAt: new Date(),
      },
    })
  }

  markFailed(id: string, error: string): Promise<SmsOutbound> {
    return this.db.smsOutbound.update({
      where: { id },
      data: { status: 'FAILED', error, sentAt: null },
    })
  }
}
