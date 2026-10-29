import type { Prisma, PrismaClient, SmsOutbound, SmsOutboundKind, SmsSender } from '@prisma/client'

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
    kind: SmsOutboundKind
    status: 'QUEUED' | 'SENT' | 'FAILED'
    error: string | null
    sentAt: Date | null
    reminderCount: number
  }>
}

export type SmsSenderRow = SmsSender

export class SmsRepository {
  constructor(private db: PrismaClient) {}

  listHouseholds(weddingId: string): Promise<SmsHouseholdRow[]> {
    return this.db.household.findMany({
      where: { weddingId, side: { in: ['חתן', 'כלה'] } },
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
          where: { kind: { in: ['INVITE', 'REMINDER'] } },
          select: { kind: true, status: true, error: true, sentAt: true, reminderCount: true },
        },
      },
    })
  }

  findHousehold(weddingId: string, householdId: string): Promise<SmsHouseholdRow | null> {
    return this.db.household.findFirst({
      where: { id: householdId, weddingId, side: { in: ['חתן', 'כלה'] } },
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
          where: { kind: { in: ['INVITE', 'REMINDER'] } },
          select: { kind: true, status: true, error: true, sentAt: true, reminderCount: true },
        },
      },
    })
  }

  listSenders(weddingId: string): Promise<SmsSenderRow[]> {
    return this.db.smsSender.findMany({
      where: { weddingId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
  }

  findSender(weddingId: string, senderId: string): Promise<SmsSenderRow | null> {
    return this.db.smsSender.findFirst({ where: { id: senderId, weddingId } })
  }

  findActiveSenderForSide(weddingId: string, side: string): Promise<SmsSenderRow | null> {
    return this.db.smsSender.findFirst({
      where: { weddingId, side, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
  }

  findDefaultSender(weddingId: string): Promise<SmsSenderRow | null> {
    return this.db.smsSender.findFirst({
      where: { weddingId, isDefault: true, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  createSender(data: Prisma.SmsSenderUncheckedCreateInput): Promise<SmsSenderRow> {
    return this.db.smsSender.create({ data })
  }

  updateSender(
    weddingId: string,
    senderId: string,
    data: Prisma.SmsSenderUncheckedUpdateInput
  ): Promise<SmsSenderRow> {
    return this.db.smsSender.update({
      where: { id: senderId, weddingId },
      data,
    })
  }

  async setDefaultSender(weddingId: string, senderId: string): Promise<SmsSenderRow> {
    return this.db.$transaction(async (tx) => {
      await tx.smsSender.updateMany({ where: { weddingId }, data: { isDefault: false } })
      return tx.smsSender.update({
        where: { id: senderId, weddingId },
        data: { isDefault: true, isActive: true },
      })
    })
  }

  async getInviteTemplate(weddingId: string): Promise<string | null> {
    const wedding = await this.db.wedding.findUniqueOrThrow({
      where: { id: weddingId },
      select: { smsInviteTemplate: true },
    })
    return wedding.smsInviteTemplate
  }

  async setInviteTemplate(weddingId: string, template: string | null): Promise<string | null> {
    const wedding = await this.db.wedding.update({
      where: { id: weddingId },
      data: { smsInviteTemplate: template },
      select: { smsInviteTemplate: true },
    })
    return wedding.smsInviteTemplate
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

  queueReminder(input: {
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
          kind: 'REMINDER',
        },
      },
      create: {
        ...input,
        kind: 'REMINDER',
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
      },
    })
  }

  markReminderSent(id: string, providerMessageId?: string): Promise<SmsOutbound> {
    return this.db.smsOutbound.update({
      where: { id },
      data: {
        status: 'SENT',
        providerMessageId,
        error: null,
        reminderCount: { increment: 1 },
        sentAt: new Date(),
      },
    })
  }

  markReminderFailed(id: string, error: string): Promise<SmsOutbound> {
    return this.db.smsOutbound.update({
      where: { id },
      data: { status: 'FAILED', error },
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
