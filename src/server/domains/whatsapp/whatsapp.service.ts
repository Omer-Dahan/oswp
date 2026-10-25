/**
 * WhatsApp Domain - Service
 */

import { TRPCError } from '@trpc/server'
import { env } from '~/env'
import { householdInviteService } from '~/server/application/household-invite'
import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import type { MessagingSender } from '~/server/domains/whatsapp/messaging-sender'
import {
  renderTemplatePreview,
  resolveTemplateVariables,
} from '~/server/domains/whatsapp/messaging-sender'
import type { WhatsAppRepository } from '~/server/domains/whatsapp/whatsapp.repository'
import {
  allocateWithinDailyCap,
  dailyCapErrorMessage,
  partitionAlreadyMessaged,
} from '~/server/domains/whatsapp/whatsapp.rules'
import type {
  WhatsAppAccountView,
  WhatsAppOutbound,
  WhatsAppOutboundKind,
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
  WhatsAppTestConnectionResult,
} from '~/server/domains/whatsapp/whatsapp.types'
import type {
  ComposePreviewInput,
  ProcessQueueInput,
  QueueBatchInput,
  SaveAccountInput,
} from '~/server/domains/whatsapp/whatsapp.validator'
import { decryptSecret, encryptSecret, maskSecret } from '~/server/infrastructure/crypto/secrets'

const GRAPH_API_VERSION = 'v23.0'
const DEFAULT_PROCESS_BATCH = 25
const SEND_PACE_MS = 1000
const STUCK_SENDING_MS = 5 * 60_000
const MAX_TEMPLATE_SYNC_PAGES = 50

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Highest {{n}} placeholder index in a template body, so the sender knows exactly how many parameters Meta expects. */
function countTemplateParams(bodyText: string | null): number {
  if (!bodyText) return 0
  const matches = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)]
  if (matches.length === 0) return 0
  return Math.max(...matches.map((match) => Number(match[1])))
}

export class WhatsAppService {
  constructor(
    private repo: WhatsAppRepository,
    private sender: MessagingSender
  ) {}

  async getAccount(ctx: AuthzContext, weddingId: string): Promise<WhatsAppAccountView> {
    requirePermission(ctx, { wedding: ['read'] })

    const account = await this.repo.findAccountByWeddingId(weddingId)
    if (!account) {
      return {
        configured: false,
        phoneNumberId: null,
        wabaId: null,
        accessTokenMasked: null,
        appSecretMasked: null,
        displayPhoneNumber: null,
        verifiedName: null,
        status: 'UNCONFIGURED',
        lastCheckedAt: null,
        lastError: null,
      }
    }

    return {
      configured: true,
      phoneNumberId: account.phoneNumberId,
      wabaId: account.wabaId,
      accessTokenMasked: account.accessTokenEnc
        ? maskSecret(decryptSecret(account.accessTokenEnc))
        : null,
      appSecretMasked: account.appSecretEnc
        ? maskSecret(decryptSecret(account.appSecretEnc))
        : null,
      displayPhoneNumber: account.displayPhoneNumber,
      verifiedName: account.verifiedName,
      status: account.status,
      lastCheckedAt: account.lastCheckedAt,
      lastError: account.lastError,
    }
  }

  async saveAccount(
    ctx: AuthzContext,
    weddingId: string,
    input: SaveAccountInput
  ): Promise<WhatsAppAccountView> {
    requirePermission(ctx, { organization: ['update'] })

    const account = await this.repo.upsertAccount(weddingId, {
      phoneNumberId: input.phoneNumberId,
      wabaId: input.wabaId,
      accessTokenEnc: encryptSecret(input.accessToken),
      verifyToken: input.verifyToken,
      appSecretEnc: input.appSecret ? encryptSecret(input.appSecret) : undefined,
    })

    return {
      configured: true,
      phoneNumberId: account.phoneNumberId,
      wabaId: account.wabaId,
      accessTokenMasked: maskSecret(input.accessToken),
      appSecretMasked: account.appSecretEnc
        ? maskSecret(decryptSecret(account.appSecretEnc))
        : null,
      displayPhoneNumber: account.displayPhoneNumber,
      verifiedName: account.verifiedName,
      status: account.status,
      lastCheckedAt: account.lastCheckedAt,
      lastError: account.lastError,
    }
  }

  async testConnection(
    ctx: AuthzContext,
    weddingId: string
  ): Promise<WhatsAppTestConnectionResult> {
    requirePermission(ctx, { organization: ['update'] })

    const account = await this.repo.findAccountByWeddingId(weddingId)
    if (!account?.phoneNumberId || !account.accessTokenEnc) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'חשבון הוואטסאפ עוד לא הוגדר',
      })
    }

    const accessToken = decryptSecret(account.accessTokenEnc)
    const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${account.phoneNumberId}`)
    url.searchParams.set('fields', 'display_phone_number,verified_name,quality_rating')

    let result: WhatsAppTestConnectionResult
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = (await response.json()) as {
        display_phone_number?: string
        verified_name?: string
        error?: { message?: string }
      }

      if (!response.ok) {
        result = {
          status: 'ERROR',
          displayPhoneNumber: null,
          verifiedName: null,
          error: body.error?.message ?? `שגיאה מ-Meta (קוד ${response.status})`,
        }
      } else {
        result = {
          status: 'ACTIVE',
          displayPhoneNumber: body.display_phone_number ?? null,
          verifiedName: body.verified_name ?? null,
          error: null,
        }
      }
    } catch {
      result = {
        status: 'ERROR',
        displayPhoneNumber: null,
        verifiedName: null,
        error: 'אין חיבור ל-Meta',
      }
    }

    await this.repo.updateConnectionResult(weddingId, {
      status: result.status,
      displayPhoneNumber: result.displayPhoneNumber,
      verifiedName: result.verifiedName,
      lastError: result.error,
    })

    return result
  }

  /** Pulls the wedding's approved templates from Meta and caches them locally. */
  async syncTemplates(ctx: AuthzContext, weddingId: string): Promise<WhatsAppTemplate[]> {
    requirePermission(ctx, { organization: ['update'] })

    const account = await this.repo.findAccountByWeddingId(weddingId)
    if (!account?.wabaId || !account.accessTokenEnc) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'חשבון הוואטסאפ עוד לא הוגדר',
      })
    }

    const accessToken = decryptSecret(account.accessTokenEnc)
    const initialUrl = new URL(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${account.wabaId}/message_templates`
    )
    initialUrl.searchParams.set('fields', 'name,language,category,status,components')
    initialUrl.searchParams.set('limit', '100')

    type MetaTemplate = {
      name: string
      language: string
      category: string
      status: string
      components?: Array<{ type: string; text?: string; format?: string }>
    }

    const metaTemplates: MetaTemplate[] = []
    let nextUrl: string | null = initialUrl.toString()

    // Meta paginates `message_templates`; a wedding with more than one page of
    // approved templates would otherwise only ever see the first 100 synced.
    for (let page = 0; nextUrl && page < MAX_TEMPLATE_SYNC_PAGES; page++) {
      const response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
      const body = (await response.json()) as {
        data?: MetaTemplate[]
        paging?: { next?: string }
        error?: { message?: string }
      }

      if (!response.ok) {
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message: body.error?.message ?? `שגיאה מ-Meta (קוד ${response.status})`,
        })
      }

      metaTemplates.push(...(body.data ?? []))
      nextUrl = body.paging?.next ?? null
    }

    const rows = metaTemplates.map((template) => {
      const bodyPreview = template.components?.find((c) => c.type === 'BODY')?.text ?? null
      const hasImageHeader =
        template.components?.some((c) => c.type === 'HEADER' && c.format === 'IMAGE') ?? false
      return {
        weddingId,
        name: template.name,
        language: template.language,
        category: (template.category === 'UTILITY'
          ? 'UTILITY'
          : 'MARKETING') as WhatsAppTemplateCategory,
        bodyPreview,
        paramCount: countTemplateParams(bodyPreview),
        hasImageHeader,
        status: template.status ?? null,
      }
    })

    await this.repo.upsertTemplates(rows)
    // Meta is the source of truth: a template it no longer returns (deleted,
    // renamed) must stop surfacing here too, or compose would keep offering
    // a template Meta will reject at send time.
    await this.repo.deleteStaleTemplates(
      weddingId,
      rows.map((row) => ({ name: row.name, language: row.language }))
    )
    return this.repo.listTemplates(weddingId)
  }

  /**
   * Queues a batch of template messages for an audience (event/tag/explicit households),
   * enforcing the rolling 24h unique-recipient cap and the already-messaged skip.
   */
  async queueBatch(
    ctx: AuthzContext,
    weddingId: string,
    input: QueueBatchInput
  ): Promise<{ queued: number; skipped: number; overCap: number }> {
    requirePermission(ctx, { guest_invitation: ['send'] })

    const candidates = await this.repo.resolveRecipientCandidates(weddingId, {
      eventId: input.eventId,
      tagId: input.tagId,
      householdIds: input.householdIds,
    })

    const alreadyMessagedHouseholdIds = await this.repo.findAlreadyMessagedHouseholdIds(
      weddingId,
      input.kind as WhatsAppOutboundKind,
      input.templateName
    )
    const { toSend, skipped } = partitionAlreadyMessaged(
      candidates,
      alreadyMessagedHouseholdIds,
      input.resend ?? false
    )

    const phonesAlreadyCountedInWindow = await this.repo.countUniqueRecipientsToday(weddingId)
    const { toQueue, overCap } = allocateWithinDailyCap(toSend, phonesAlreadyCountedInWindow)

    if (toQueue.length === 0 && overCap.length > 0) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: dailyCapErrorMessage() })
    }

    // Mint an invite code for any household about to be messaged that
    // doesn't have one yet, so a template embedding the RSVP link never sends
    // it empty.
    const householdIds = Array.from(new Set(toQueue.map((candidate) => candidate.householdId)))
    await Promise.all(
      householdIds.map((householdId) => householdInviteService.ensureInviteCode(householdId))
    )

    await this.repo.createOutboundRows(
      toQueue.map((candidate) => ({
        weddingId,
        householdId: candidate.householdId,
        guestId: candidate.guestId,
        eventId: input.eventId ?? null,
        kind: input.kind as WhatsAppOutboundKind,
        templateName: input.templateName,
        toPhone: candidate.phone,
      }))
    )

    return { queued: toQueue.length, skipped: skipped.length, overCap: overCap.length }
  }

  /** Sends up to `max` queued messages, pacing at one message per second so a call stays under ~30s. */
  async processQueue(
    ctx: AuthzContext,
    weddingId: string,
    input: ProcessQueueInput = {}
  ): Promise<{ processed: number; sent: number; failed: number; remaining: number }> {
    requirePermission(ctx, { guest_invitation: ['send'] })

    await this.repo.requeueStuckSending(weddingId, STUCK_SENDING_MS)

    const max = Math.min(input.max ?? DEFAULT_PROCESS_BATCH, DEFAULT_PROCESS_BATCH)
    let processed = 0
    let sent = 0
    let failed = 0

    for (let i = 0; i < max; i++) {
      const claimed = await this.repo.claimNextQueued(weddingId)
      if (!claimed) break

      processed++
      const ok = await this.sender.sendTemplate({ outboundId: claimed.id })
      if (ok) sent++
      else failed++

      if (i < max - 1) await sleep(SEND_PACE_MS)
    }

    const remaining = await this.repo.countQueued(weddingId)
    return { processed, sent, failed, remaining }
  }

  /** Rows still waiting to be sent, so the UI can resume draining after a page reload. */
  async getQueuedCount(ctx: AuthzContext, weddingId: string): Promise<number> {
    requirePermission(ctx, { wedding: ['read'] })
    return this.repo.countQueued(weddingId)
  }

  async cancelQueue(ctx: AuthzContext, weddingId: string): Promise<{ cancelled: number }> {
    requirePermission(ctx, { guest_invitation: ['send'] })
    const cancelled = await this.repo.cancelQueued(weddingId)
    return { cancelled }
  }

  /** Cached templates (no Meta call); use syncTemplates to refresh. */
  async listTemplates(ctx: AuthzContext, weddingId: string): Promise<WhatsAppTemplate[]> {
    requirePermission(ctx, { wedding: ['read'] })
    return this.repo.listTemplates(weddingId)
  }

  /** Renders the selected template with the first matching household's real data, for the compose preview. */
  async getComposePreview(
    ctx: AuthzContext,
    weddingId: string,
    input: ComposePreviewInput
  ): Promise<{ recipientCount: number; previewText: string | null }> {
    requirePermission(ctx, { wedding: ['read'] })

    const candidates = await this.repo.resolveRecipientCandidates(weddingId, {
      eventId: input.eventId,
      tagId: input.tagId,
      householdIds: input.householdIds,
    })

    if (candidates.length === 0) {
      return { recipientCount: 0, previewText: null }
    }

    const templates = await this.repo.listTemplates(weddingId)
    const template = templates.find((t) => t.name === input.templateName) ?? null

    const first = candidates[0]
    if (!first) {
      return { recipientCount: 0, previewText: null }
    }
    const context = await this.repo.findPreviewContext(weddingId, first, input.eventId)

    const inviteUrl =
      context.household?.inviteCode && context.websiteSubUrl
        ? `${env.NEXT_PUBLIC_APP_URL}/w/${context.websiteSubUrl}/save-the-date/${context.household.inviteCode}`
        : null

    const vars = resolveTemplateVariables({
      firstName: context.guest?.firstName ?? '',
      event: context.event,
      inviteUrl,
    })

    return {
      recipientCount: candidates.length,
      previewText: template ? renderTemplatePreview(template.bodyPreview, vars) : null,
    }
  }

  async listRecentOutbound(
    ctx: AuthzContext,
    weddingId: string,
    limit = 50
  ): Promise<WhatsAppOutbound[]> {
    requirePermission(ctx, { wedding: ['read'] })
    return this.repo.listRecentOutbound(weddingId, limit)
  }
}
