/**
 * WhatsApp Domain - Repository
 */

import type {
  Prisma,
  PrismaClient,
  WhatsAppAccountStatus,
  WhatsAppOutbound,
  WhatsAppOutboundKind,
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
} from '@prisma/client'

import type { WhatsAppAccount } from '~/server/domains/whatsapp/whatsapp.types'

const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000

export type SendContext = {
  outbound: WhatsAppOutbound
  account: WhatsAppAccount | null
  household: { inviteCode: string | null } | null
  websiteSubUrl: string | null
  guest: { firstName: string } | null
  event: { name: string; date: Date | null } | null
}

export type RecipientCandidate = {
  householdId: string
  guestId: number
  phone: string
}

export class WhatsAppRepository {
  constructor(private db: PrismaClient) {}

  async findAccountByWeddingId(weddingId: string): Promise<WhatsAppAccount | null> {
    return this.db.whatsAppAccount.findUnique({ where: { weddingId } })
  }

  async upsertAccount(
    weddingId: string,
    data: {
      phoneNumberId: string
      wabaId: string
      accessTokenEnc: string
      verifyToken: string
    }
  ): Promise<WhatsAppAccount> {
    return this.db.whatsAppAccount.upsert({
      where: { weddingId },
      create: {
        weddingId,
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        accessTokenEnc: data.accessTokenEnc,
        verifyToken: data.verifyToken,
        status: 'UNCONFIGURED',
      },
      update: {
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        accessTokenEnc: data.accessTokenEnc,
        verifyToken: data.verifyToken,
        status: 'UNCONFIGURED',
        displayPhoneNumber: null,
        verifiedName: null,
        lastError: null,
      },
    })
  }

  async updateConnectionResult(
    weddingId: string,
    data: {
      status: WhatsAppAccountStatus
      displayPhoneNumber: string | null
      verifiedName: string | null
      lastError: string | null
    }
  ): Promise<WhatsAppAccount> {
    return this.db.whatsAppAccount.update({
      where: { weddingId },
      data: {
        status: data.status,
        displayPhoneNumber: data.displayPhoneNumber,
        verifiedName: data.verifiedName,
        lastError: data.lastError,
        lastCheckedAt: new Date(),
      },
    })
  }

  /** Everything the paced sender needs to render and post one outbound row. */
  async findSendContext(outboundId: string): Promise<SendContext | null> {
    const outbound = await this.db.whatsAppOutbound.findUnique({ where: { id: outboundId } })
    if (!outbound) return null

    const [account, household, website, guest, event] = await Promise.all([
      this.db.whatsAppAccount.findUnique({ where: { weddingId: outbound.weddingId } }),
      outbound.householdId
        ? this.db.household.findUnique({
            where: { id: outbound.householdId },
            select: { inviteCode: true },
          })
        : Promise.resolve(null),
      this.db.website.findUnique({
        where: { weddingId: outbound.weddingId },
        select: { subUrl: true },
      }),
      outbound.guestId
        ? this.db.guest.findUnique({ where: { id: outbound.guestId }, select: { firstName: true } })
        : Promise.resolve(null),
      outbound.eventId
        ? this.db.event.findUnique({
            where: { id: outbound.eventId },
            select: { name: true, date: true },
          })
        : Promise.resolve(null),
    ])

    return {
      outbound,
      account,
      household,
      websiteSubUrl: website?.subUrl ?? null,
      guest,
      event,
    }
  }

  async markSent(id: string, providerMessageId: string): Promise<void> {
    await this.db.whatsAppOutbound.update({
      where: { id },
      data: { status: 'SENT', providerMessageId, sentAt: new Date(), error: null },
    })
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db.whatsAppOutbound.update({
      where: { id },
      data: { status: 'FAILED', error },
    })
  }

  /** Claims the oldest QUEUED row for this wedding by moving it to SENDING; null if the queue is empty. */
  async claimNextQueued(weddingId: string): Promise<WhatsAppOutbound | null> {
    return this.db.$transaction(async (tx) => {
      const next = await tx.whatsAppOutbound.findFirst({
        where: { weddingId, status: 'QUEUED' },
        orderBy: { queuedAt: 'asc' },
      })
      if (!next) return null
      return tx.whatsAppOutbound.update({
        where: { id: next.id },
        data: { status: 'SENDING' },
      })
    })
  }

  async countQueued(weddingId: string): Promise<number> {
    return this.db.whatsAppOutbound.count({ where: { weddingId, status: 'QUEUED' } })
  }

  /** Marks every still-QUEUED row for this wedding as FAILED (cancelled before it was ever sent). */
  async cancelQueued(weddingId: string): Promise<number> {
    const result = await this.db.whatsAppOutbound.updateMany({
      where: { weddingId, status: 'QUEUED' },
      data: { status: 'FAILED', error: 'בוטל על ידי המשתמש' },
    })
    return result.count
  }

  /** Distinct phones already counted toward the rolling 24h unique-recipient cap. */
  async countUniqueRecipientsToday(weddingId: string): Promise<Set<string>> {
    const since = new Date(Date.now() - ROLLING_WINDOW_MS)
    const rows = await this.db.whatsAppOutbound.findMany({
      where: { weddingId, queuedAt: { gte: since }, status: { not: 'FAILED' } },
      select: { toPhone: true },
      distinct: ['toPhone'],
    })
    return new Set(rows.map((r) => r.toPhone))
  }

  /** Households already messaged with this kind+template (any status but FAILED), for the resend skip. */
  async findAlreadyMessagedHouseholdIds(
    weddingId: string,
    kind: WhatsAppOutboundKind,
    templateName: string
  ): Promise<Set<string>> {
    const rows = await this.db.whatsAppOutbound.findMany({
      where: { weddingId, kind, templateName, status: { not: 'FAILED' }, householdId: { not: null } },
      select: { householdId: true },
      distinct: ['householdId'],
    })
    return new Set(rows.map((r) => r.householdId as string))
  }

  /** Resolves the primary-contact recipients for a queue batch, scoped to the given audience filters. */
  async resolveRecipientCandidates(
    weddingId: string,
    filter: { eventId?: string; tagId?: string; householdIds?: string[] }
  ): Promise<RecipientCandidate[]> {
    const where: Prisma.GuestWhereInput = {
      weddingId,
      isPrimaryContact: true,
      phone: { not: null },
    }
    if (filter.householdIds) where.householdId = { in: filter.householdIds }
    if (filter.tagId) where.guestTagAssignments = { some: { guestTagId: filter.tagId } }
    if (filter.eventId) where.invitations = { some: { eventId: filter.eventId } }

    const guests = await this.db.guest.findMany({
      where,
      select: { id: true, phone: true, householdId: true },
    })

    return guests
      .filter((g): g is typeof g & { phone: string } => g.phone !== null)
      .map((g) => ({ householdId: g.householdId, guestId: g.id, phone: g.phone }))
  }

  async createOutboundRows(
    rows: Array<{
      weddingId: string
      householdId: string | null
      guestId: number | null
      eventId: string | null
      kind: WhatsAppOutboundKind
      templateName: string
      toPhone: string
    }>
  ): Promise<void> {
    if (rows.length === 0) return
    await this.db.whatsAppOutbound.createMany({ data: rows })
  }

  async listRecentOutbound(weddingId: string, limit: number): Promise<WhatsAppOutbound[]> {
    return this.db.whatsAppOutbound.findMany({
      where: { weddingId },
      orderBy: { queuedAt: 'desc' },
      take: limit,
    })
  }

  async upsertTemplates(
    rows: Array<{
      weddingId: string
      name: string
      language: string
      category: WhatsAppTemplateCategory
      bodyPreview: string | null
      status: string | null
    }>
  ): Promise<void> {
    for (const row of rows) {
      await this.db.whatsAppTemplate.upsert({
        where: {
          weddingId_provider_name_language: {
            weddingId: row.weddingId,
            provider: 'WHATSAPP_CLOUD',
            name: row.name,
            language: row.language,
          },
        },
        create: {
          weddingId: row.weddingId,
          name: row.name,
          language: row.language,
          category: row.category,
          bodyPreview: row.bodyPreview,
          status: row.status,
          lastSyncedAt: new Date(),
        },
        update: {
          category: row.category,
          bodyPreview: row.bodyPreview,
          status: row.status,
          lastSyncedAt: new Date(),
        },
      })
    }
  }

  async listTemplates(weddingId: string): Promise<WhatsAppTemplate[]> {
    return this.db.whatsAppTemplate.findMany({ where: { weddingId }, orderBy: { name: 'asc' } })
  }
}
