/**
 * WhatsApp Domain - Repository
 */

import type {
  Prisma,
  PrismaClient,
  WhatsAppAccountStatus,
  WhatsAppInbound,
  WhatsAppOutbound,
  WhatsAppOutboundKind,
  WhatsAppOutboundStatus,
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
} from '@prisma/client'

import { InvitationRepository } from '~/server/domains/invitation/invitation.repository'
import { normalisePhone } from '~/server/domains/whatsapp/phone-mapping'
import type { WhatsAppAccount } from '~/server/domains/whatsapp/whatsapp.types'

const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000

export type HouseholdMatch = { guestId: number; householdId: string; householdSize: number }

export type PendingInboundRow = WhatsAppInbound & {
  guest: { firstName: string; lastName: string } | null
  household: {
    guests: Array<{ firstName: string; lastName: string; isPrimaryContact: boolean }>
  } | null
}

export type SendContext = {
  outbound: WhatsAppOutbound
  account: WhatsAppAccount | null
  household: { inviteCode: string | null } | null
  websiteSubUrl: string | null
  guest: { firstName: string } | null
  event: { name: string; date: Date | null } | null
  template: {
    language: string
    paramCount: number
    hasImageHeader: boolean
    headerImageUrl: string | null
  } | null
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
      /** Undefined keeps the previously stored app secret untouched. */
      appSecretEnc?: string
    }
  ): Promise<WhatsAppAccount> {
    return this.db.whatsAppAccount.upsert({
      where: { weddingId },
      create: {
        weddingId,
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        accessTokenEnc: data.accessTokenEnc,
        appSecretEnc: data.appSecretEnc ?? null,
        verifyToken: data.verifyToken,
        status: 'UNCONFIGURED',
      },
      update: {
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        accessTokenEnc: data.accessTokenEnc,
        ...(data.appSecretEnc !== undefined ? { appSecretEnc: data.appSecretEnc } : {}),
        verifyToken: data.verifyToken,
        status: 'UNCONFIGURED',
        displayPhoneNumber: null,
        verifiedName: null,
        lastError: null,
      },
    })
  }

  /** Looks up the configured account whose verify token matches (Meta's GET verification handshake). */
  async findAccountByVerifyToken(verifyToken: string): Promise<WhatsAppAccount | null> {
    return this.db.whatsAppAccount.findFirst({ where: { verifyToken } })
  }

  /** Looks up the configured account by its Meta phone_number_id (inbound webhook routing). */
  async findAccountByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppAccount | null> {
    return this.db.whatsAppAccount.findFirst({ where: { phoneNumberId } })
  }

  /** Persists inbound messages; duplicates (same providerMessageId) are skipped for idempotency under Meta retries. */
  async createInboundMessages(
    weddingId: string,
    messages: Array<{
      waId: string
      fromPhone: string
      profileName: string | null
      text: string | null
      providerMessageId: string
    }>
  ): Promise<void> {
    if (messages.length === 0) return
    await this.db.whatsAppInbound.createMany({
      data: messages.map((m) => ({ weddingId, ...m })),
      skipDuplicates: true,
    })
  }

  /** Inbound rows still waiting for phone resolution and RSVP application. */
  async findUnresolvedInbound(weddingId: string): Promise<WhatsAppInbound[]> {
    return this.db.whatsAppInbound.findMany({
      where: { weddingId, handledAt: null, householdId: null },
    })
  }

  /** Every unhandled inbound row for the review screen, newest first, with the names needed to render it. */
  async findPendingInbound(weddingId: string, limit = 50): Promise<PendingInboundRow[]> {
    return this.db.whatsAppInbound.findMany({
      where: { weddingId, handledAt: null },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      include: {
        guest: { select: { firstName: true, lastName: true } },
        household: {
          select: {
            guests: { select: { firstName: true, lastName: true, isPrimaryContact: true } },
          },
        },
      },
    })
  }

  /** A single inbound row, scoped to the wedding, for the review screen's apply/dismiss actions. */
  async findInboundById(weddingId: string, inboundId: string): Promise<WhatsAppInbound | null> {
    return this.db.whatsAppInbound.findFirst({ where: { id: inboundId, weddingId } })
  }

  /** Dismisses an inbound row from the review queue without touching any invitation. */
  async markInboundHandled(weddingId: string, inboundId: string): Promise<void> {
    await this.db.whatsAppInbound.updateMany({
      where: { id: inboundId, weddingId },
      data: { handledAt: new Date() },
    })
  }

  /** Assigns a household to an inbound row whose phone didn't match one automatically. */
  async setInboundHousehold(
    weddingId: string,
    inboundId: string,
    householdId: string
  ): Promise<void> {
    await this.db.whatsAppInbound.updateMany({
      where: { id: inboundId, weddingId },
      data: { householdId },
    })
  }

  /** Loads a guest's current phone and household, wedding-scoped, for the manual-link confirmation check. */
  async findGuestForLink(
    weddingId: string,
    guestId: number
  ): Promise<{ id: number; phone: string | null; householdId: string } | null> {
    return this.db.guest.findFirst({
      where: { id: guestId, weddingId },
      select: { id: true, phone: true, householdId: true },
    })
  }

  /**
   * Manually links an unmatched inbound row to a guest's household, from the
   * review screen. `overwritePhone` must only be true when the caller has
   * already confirmed replacing an existing different phone (see
   * whatsapp.rules.decideLinkPhoneToGuest); otherwise guest.phone is written
   * only when it was empty. The row stays unhandled - only its guest/household
   * pointers and parse reason change - since the RSVP decision is still pending.
   * Returns null when the inbound row or guest isn't found in this wedding.
   */
  async linkInboundToHousehold(
    weddingId: string,
    inboundId: string,
    guestId: number,
    overwritePhone: boolean
  ): Promise<{ ok: true } | null> {
    return this.db.$transaction(async (tx) => {
      const [inbound, guest] = await Promise.all([
        tx.whatsAppInbound.findFirst({ where: { id: inboundId, weddingId } }),
        tx.guest.findFirst({ where: { id: guestId, weddingId } }),
      ])
      if (!inbound || !guest) return null

      if (!guest.phone || overwritePhone) {
        await tx.guest.update({ where: { id: guestId }, data: { phone: inbound.fromPhone } })
      }

      const parsed = { ...(inbound.parsed as Prisma.JsonObject | null), reason: 'manual-link' }
      await tx.whatsAppInbound.update({
        where: { id: inboundId },
        data: { guestId, householdId: guest.householdId, parsed },
      })

      return { ok: true }
    })
  }

  /**
   * Builds the phone->household map for a whole wedding in one pass, so the
   * webhook's inbound-reply resolution can look up every row in memory
   * instead of re-querying per message. Keyed by the same last-9-digits
   * normalisation used to match a raw inbound phone, preferring the
   * household's primary contact when several guests share a phone.
   */
  async findPhoneHouseholdMap(weddingId: string): Promise<Map<string, HouseholdMatch>> {
    const guests = await this.db.guest.findMany({
      where: { weddingId, phone: { not: null } },
      select: { id: true, phone: true, householdId: true, isPrimaryContact: true },
    })

    const byKey = new Map<string, Array<(typeof guests)[number]>>()
    for (const guest of guests) {
      const key = normalisePhone(guest.phone ?? '')
      if (!key) continue
      const list = byKey.get(key) ?? []
      list.push(guest)
      byKey.set(key, list)
    }

    const householdIds = [...new Set(guests.map((guest) => guest.householdId))]
    const householdSizes = await this.db.guest.groupBy({
      by: ['householdId'],
      where: { householdId: { in: householdIds } },
      _count: { _all: true },
    })
    const sizeByHouseholdId = new Map(
      householdSizes.map((row) => [row.householdId, row._count._all])
    )

    const result = new Map<string, HouseholdMatch>()
    for (const [key, candidates] of byKey) {
      const match = candidates.find((guest) => guest.isPrimaryContact) ?? candidates[0]
      if (!match) continue
      result.set(key, {
        guestId: match.id,
        householdId: match.householdId,
        householdSize: sizeByHouseholdId.get(match.householdId) ?? 1,
      })
    }
    return result
  }

  /** Records the parsed intent for an inbound row that could not be auto-applied (no match, or not high confidence). */
  async recordInboundParseResult(
    id: string,
    data: { guestId: number | null; householdId: string | null; parsed: Prisma.InputJsonValue }
  ): Promise<void> {
    await this.db.whatsAppInbound.update({
      where: { id },
      data: { guestId: data.guestId, householdId: data.householdId, parsed: data.parsed },
    })
  }

  /**
   * High-confidence attending/declined replies: moves every still-'Invited'
   * invitation of the household's guests to the new RSVP status and marks
   * the inbound row handled, atomically.
   */
  async applyHouseholdRsvp(
    inboundId: string,
    params: {
      guestId: number
      householdId: string
      rsvp: 'Attending' | 'Declined'
      parsed: Prisma.InputJsonValue
    }
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const householdGuests = await tx.guest.findMany({
        where: { householdId: params.householdId },
        select: { id: true },
      })
      const guestIds = householdGuests.map((guest) => guest.id)

      const invitationRepository = new InvitationRepository(tx)
      await invitationRepository.updateManyByGuestIds(guestIds, {
        rsvp: params.rsvp,
        submittedAt: new Date(),
        submittedBy: params.guestId,
      })

      await tx.whatsAppInbound.update({
        where: { id: inboundId },
        data: {
          guestId: params.guestId,
          householdId: params.householdId,
          parsed: params.parsed,
          handledAt: new Date(),
        },
      })
    })
  }

  /**
   * Applies a delivery-status update to the outbound row with this
   * providerMessageId, if any — but only when the row's current status is
   * one of `allowedFromStatuses`, so a status update that arrives out of
   * order (e.g. a delayed "delivered" after "read" already landed) can't
   * downgrade the row.
   */
  async updateOutboundStatusByProviderMessageId(
    providerMessageId: string,
    data: {
      status: WhatsAppOutboundStatus
      sentAt?: Date
      deliveredAt?: Date
      readAt?: Date
      error?: string
    },
    allowedFromStatuses: WhatsAppOutboundStatus[]
  ): Promise<void> {
    await this.db.whatsAppOutbound.updateMany({
      where: { providerMessageId, status: { in: allowedFromStatuses } },
      data,
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

    const [account, household, website, guest, event, template] = await Promise.all([
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
      this.db.whatsAppTemplate.findFirst({
        where: { weddingId: outbound.weddingId, name: outbound.templateName },
        orderBy: { lastSyncedAt: 'desc' },
        select: { language: true, paramCount: true, hasImageHeader: true, headerImageUrl: true },
      }),
    ])

    return {
      outbound,
      account,
      household,
      websiteSubUrl: website?.subUrl ?? null,
      guest,
      event,
      template,
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

  /**
   * Claims the oldest QUEUED row for this wedding by moving it to SENDING;
   * null if the queue is empty. The claim itself is a conditional
   * `updateMany` (not a read-then-write) so two concurrent queue runners
   * can't both claim the same row: only the update whose WHERE still matches
   * `status: 'QUEUED'` at commit time affects a row.
   */
  async claimNextQueued(weddingId: string): Promise<WhatsAppOutbound | null> {
    const next = await this.db.whatsAppOutbound.findFirst({
      where: { weddingId, status: 'QUEUED' },
      orderBy: { queuedAt: 'asc' },
      select: { id: true },
    })
    if (!next) return null

    const claimed = await this.db.whatsAppOutbound.updateMany({
      where: { id: next.id, status: 'QUEUED' },
      data: { status: 'SENDING' },
    })
    if (claimed.count !== 1) return null

    return this.db.whatsAppOutbound.findUnique({ where: { id: next.id } })
  }

  /**
   * Moves rows stuck in SENDING back to QUEUED. A row stays SENDING only for
   * the duration of one Graph API call; anything older than `olderThanMs` was
   * orphaned by a crashed/killed sender (e.g. the client tab that was driving
   * the drain closed mid-request) and would otherwise sit there forever.
   */
  async requeueStuckSending(weddingId: string, olderThanMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs)
    const result = await this.db.whatsAppOutbound.updateMany({
      where: { weddingId, status: 'SENDING', updatedAt: { lt: cutoff } },
      data: { status: 'QUEUED' },
    })
    return result.count
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

  /**
   * Households actually messaged with this kind+template, for the resend
   * skip. Only counts rows that reached the provider (SENT/DELIVERED/READ) —
   * QUEUED/SENDING rows haven't gone out yet, and counting them here made a
   * retry after a stuck queue (see claimNextQueued) queue zero rows.
   */
  async findAlreadyMessagedHouseholdIds(
    weddingId: string,
    kind: WhatsAppOutboundKind,
    templateName: string
  ): Promise<Set<string>> {
    const rows = await this.db.whatsAppOutbound.findMany({
      where: {
        weddingId,
        kind,
        templateName,
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
        householdId: { not: null },
      },
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
    // Every guest has an Invitation row per event (default 'Not Invited'), so
    // without excluding that status this matched everyone in the wedding
    // regardless of whether they were actually invited to this event.
    if (filter.eventId) {
      where.invitations = { some: { eventId: filter.eventId, rsvp: { not: 'Not Invited' } } }
    }

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
      paramCount: number
      hasImageHeader: boolean
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
          paramCount: row.paramCount,
          hasImageHeader: row.hasImageHeader,
          status: row.status,
          lastSyncedAt: new Date(),
        },
        update: {
          category: row.category,
          bodyPreview: row.bodyPreview,
          paramCount: row.paramCount,
          hasImageHeader: row.hasImageHeader,
          status: row.status,
          lastSyncedAt: new Date(),
        },
      })
    }
  }

  async listTemplates(weddingId: string): Promise<WhatsAppTemplate[]> {
    return this.db.whatsAppTemplate.findMany({ where: { weddingId }, orderBy: { name: 'asc' } })
  }

  /** Removes cached templates for this wedding that Meta no longer returned from a sync. */
  async deleteStaleTemplates(
    weddingId: string,
    keep: Array<{ name: string; language: string }>
  ): Promise<void> {
    if (keep.length === 0) {
      await this.db.whatsAppTemplate.deleteMany({
        where: { weddingId, provider: 'WHATSAPP_CLOUD' },
      })
      return
    }

    await this.db.whatsAppTemplate.deleteMany({
      where: {
        weddingId,
        provider: 'WHATSAPP_CLOUD',
        NOT: { OR: keep.map((template) => ({ name: template.name, language: template.language })) },
      },
    })
  }

  /** Everything the compose preview needs to render one candidate's template variables. */
  async findPreviewContext(
    weddingId: string,
    candidate: RecipientCandidate,
    eventId?: string
  ): Promise<{
    guest: { firstName: string } | null
    household: { inviteCode: string | null } | null
    websiteSubUrl: string | null
    event: { name: string; date: Date | null } | null
  }> {
    const [guest, household, website, event] = await Promise.all([
      this.db.guest.findUnique({ where: { id: candidate.guestId }, select: { firstName: true } }),
      this.db.household.findUnique({
        where: { id: candidate.householdId },
        select: { inviteCode: true },
      }),
      this.db.website.findUnique({ where: { weddingId }, select: { subUrl: true } }),
      eventId
        ? this.db.event.findUnique({ where: { id: eventId }, select: { name: true, date: true } })
        : Promise.resolve(null),
    ])

    return { guest, household, websiteSubUrl: website?.subUrl ?? null, event }
  }
}
