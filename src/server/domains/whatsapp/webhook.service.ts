/**
 * WhatsApp Domain - Inbound Webhook
 *
 * Parses Meta's Cloud API webhook payload and persists messages/statuses.
 * Account resolution and signature comparison live here too, so the route
 * handler (src/app/api/whatsapp/webhook/route.ts) stays a thin adapter.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

import { normalisePhone } from '~/server/domains/whatsapp/phone-mapping'
import { parseRsvpReply } from '~/server/domains/whatsapp/rsvp-parser'
import type {
  HouseholdMatch,
  WhatsAppRepository,
} from '~/server/domains/whatsapp/whatsapp.repository'
import type { WhatsAppOutboundStatus } from '~/server/domains/whatsapp/whatsapp.types'

type MetaContact = { wa_id?: string; profile?: { name?: string } }
type MetaMessage = {
  id?: string
  from?: string
  text?: { body?: string }
  button?: { text?: string }
  interactive?: { button_reply?: { title?: string } }
}
type MetaStatus = {
  id?: string
  status?: string
  errors?: Array<{ title?: string }>
}
type MetaValue = {
  metadata?: { phone_number_id?: string }
  contacts?: MetaContact[]
  messages?: MetaMessage[]
  statuses?: MetaStatus[]
}
type MetaChange = { value?: MetaValue }
type MetaEntry = { changes?: MetaChange[] }
type MetaWebhookPayload = { entry?: MetaEntry[] }

export type ParsedInboundMessage = {
  waId: string
  fromPhone: string
  profileName: string | null
  text: string | null
  providerMessageId: string
}

export type ParsedStatusUpdate = {
  providerMessageId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  errorTitle: string | null
}

export type ParsedWebhookGroup = {
  phoneNumberId: string
  messages: ParsedInboundMessage[]
  statuses: ParsedStatusUpdate[]
}

const STATUS_VALUES = new Set(['sent', 'delivered', 'read', 'failed'])

/** Every distinct phone_number_id Meta reports across the whole payload, for the account-resolution pass. */
export function extractPhoneNumberIds(payload: unknown): string[] {
  const entries = (payload as MetaWebhookPayload | null)?.entry ?? []
  const ids = new Set<string>()
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const id = change.value?.metadata?.phone_number_id
      if (id) ids.add(id)
    }
  }
  return [...ids]
}

/**
 * Flattens every entry/change into message and status rows, grouped by the
 * change's own metadata.phone_number_id rather than assuming the whole batch
 * belongs to a single account — a WABA with several numbers can report
 * changes for more than one of them in the same call, and attributing all of
 * them to entry[0]'s wedding would silently cross-contaminate households.
 */
export function parseWebhookPayload(payload: unknown): ParsedWebhookGroup[] {
  const entries = (payload as MetaWebhookPayload | null)?.entry ?? []
  const groups = new Map<string, ParsedWebhookGroup>()

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const phoneNumberId = value?.metadata?.phone_number_id
      if (!value || !phoneNumberId) continue

      const group = groups.get(phoneNumberId) ?? { phoneNumberId, messages: [], statuses: [] }

      const contactsByWaId = new Map<string, MetaContact>()
      for (const contact of value.contacts ?? []) {
        if (contact.wa_id) contactsByWaId.set(contact.wa_id, contact)
      }

      for (const message of value.messages ?? []) {
        if (!message.id || !message.from) continue
        group.messages.push({
          waId: message.from,
          fromPhone: message.from,
          profileName: contactsByWaId.get(message.from)?.profile?.name ?? null,
          text:
            message.text?.body ??
            message.button?.text ??
            message.interactive?.button_reply?.title ??
            null,
          providerMessageId: message.id,
        })
      }

      for (const status of value.statuses ?? []) {
        if (!status.id || !status.status || !STATUS_VALUES.has(status.status)) continue
        group.statuses.push({
          providerMessageId: status.id,
          status: status.status as ParsedStatusUpdate['status'],
          errorTitle: status.errors?.[0]?.title ?? null,
        })
      }

      groups.set(phoneNumberId, group)
    }
  }

  return [...groups.values()]
}

/** Compares `X-Hub-Signature-256` (sha256=<hex>) against an HMAC over the exact raw body bytes. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false

  const provided = signatureHeader.slice('sha256='.length)
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')

  const providedBuf = Buffer.from(provided, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  if (providedBuf.length === 0 || providedBuf.length !== expectedBuf.length) return false

  return timingSafeEqual(providedBuf, expectedBuf)
}

const STATUS_TO_OUTBOUND: Record<ParsedStatusUpdate['status'], WhatsAppOutboundStatus> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
}

// Progression of a delivery receipt. Statuses can arrive out of order (Meta
// doesn't guarantee delivery order of webhook calls), so a status update is
// only applied when it moves a row forward — otherwise a late "delivered"
// retry could stomp a "read" that already landed.
const OUTBOUND_STATUS_RANK: Record<WhatsAppOutboundStatus, number> = {
  QUEUED: 0,
  SENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
}
const ALL_OUTBOUND_STATUSES = Object.keys(OUTBOUND_STATUS_RANK) as WhatsAppOutboundStatus[]

export class WebhookService {
  constructor(private repo: WhatsAppRepository) {}

  async ingestMessages(weddingId: string, messages: ParsedInboundMessage[]): Promise<void> {
    await this.repo.createInboundMessages(weddingId, messages)
    await this.resolveInboundReplies(weddingId)
  }

  /**
   * Maps every unresolved inbound row to a household and, when the parsed
   * reply is unambiguous, applies it to the household's invitations. Never
   * throws: one bad row is logged and skipped so the rest still resolve.
   *
   * The phone->household map is built once for the whole wedding rather than
   * re-queried per row, since a single webhook delivery can carry many rows.
   */
  async resolveInboundReplies(weddingId: string): Promise<void> {
    const rows = await this.repo.findUnresolvedInbound(weddingId)
    if (rows.length === 0) return

    const phoneMap = await this.repo.findPhoneHouseholdMap(weddingId)
    for (const row of rows) {
      try {
        await this.resolveOneInboundReply(row.id, row.fromPhone, row.text, phoneMap)
      } catch (error) {
        console.error('WhatsApp inbound reply resolution failed', error)
      }
    }
  }

  private async resolveOneInboundReply(
    inboundId: string,
    fromPhone: string,
    text: string | null,
    phoneMap: Map<string, HouseholdMatch>
  ): Promise<void> {
    const { intent, headcount, confidence } = parseRsvpReply(text)
    const key = normalisePhone(fromPhone)
    const match = key ? phoneMap.get(key) : undefined

    if (!match) {
      await this.repo.recordInboundParseResult(inboundId, {
        guestId: null,
        householdId: null,
        parsed: { intent, headcount, confidence, reason: 'unmatched-phone' },
      })
      return
    }

    // A stated headcount that doesn't match how many people are actually in
    // the household is a sign the guest meant something else (e.g. "we'll be
    // 4" for a household of 2) — route it to the review screen instead of
    // auto-applying a possibly-wrong RSVP.
    const headcountMismatch =
      intent === 'attending' && headcount !== null && headcount !== match.householdSize

    if (
      confidence === 'high' &&
      !headcountMismatch &&
      (intent === 'attending' || intent === 'declined')
    ) {
      await this.repo.applyHouseholdRsvp(inboundId, {
        guestId: match.guestId,
        householdId: match.householdId,
        rsvp: intent === 'attending' ? 'Attending' : 'Declined',
        parsed: { intent, headcount, confidence },
      })
      return
    }

    await this.repo.recordInboundParseResult(inboundId, {
      guestId: match.guestId,
      householdId: match.householdId,
      parsed: {
        intent,
        headcount,
        confidence,
        ...(headcountMismatch ? { reason: 'headcount-mismatch' } : {}),
      },
    })
  }

  async ingestStatuses(statuses: ParsedStatusUpdate[]): Promise<void> {
    for (const status of statuses) {
      const now = new Date()
      const newStatus = STATUS_TO_OUTBOUND[status.status]
      const allowedFromStatuses = ALL_OUTBOUND_STATUSES.filter(
        (s) => OUTBOUND_STATUS_RANK[s] < OUTBOUND_STATUS_RANK[newStatus]
      )
      await this.repo.updateOutboundStatusByProviderMessageId(
        status.providerMessageId,
        {
          status: newStatus,
          ...(status.status === 'sent' ? { sentAt: now } : {}),
          ...(status.status === 'delivered' ? { deliveredAt: now } : {}),
          ...(status.status === 'read' ? { readAt: now } : {}),
          ...(status.status === 'failed' ? { error: status.errorTitle ?? 'Unknown error' } : {}),
        },
        allowedFromStatuses
      )
    }
  }
}
