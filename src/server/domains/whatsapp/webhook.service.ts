/**
 * WhatsApp Domain - Inbound Webhook
 *
 * Parses Meta's Cloud API webhook payload and persists messages/statuses.
 * Account resolution and signature comparison live here too, so the route
 * handler (src/app/api/whatsapp/webhook/route.ts) stays a thin adapter.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

import type { WhatsAppOutboundStatus } from '@prisma/client'

import type { WhatsAppRepository } from '~/server/domains/whatsapp/whatsapp.repository'

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

const STATUS_VALUES = new Set(['sent', 'delivered', 'read', 'failed'])

/** The phone_number_id Meta reports for the first change, used to resolve the configured account. */
export function extractPhoneNumberId(payload: unknown): string | null {
  const entry = (payload as MetaWebhookPayload | null)?.entry?.[0]
  return entry?.changes?.[0]?.value?.metadata?.phone_number_id ?? null
}

/** Flattens every entry/change into the message and status rows the domain persists. */
export function parseWebhookPayload(payload: unknown): {
  messages: ParsedInboundMessage[]
  statuses: ParsedStatusUpdate[]
} {
  const entries = (payload as MetaWebhookPayload | null)?.entry ?? []
  const messages: ParsedInboundMessage[] = []
  const statuses: ParsedStatusUpdate[] = []

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value) continue

      const contactsByWaId = new Map<string, MetaContact>()
      for (const contact of value.contacts ?? []) {
        if (contact.wa_id) contactsByWaId.set(contact.wa_id, contact)
      }

      for (const message of value.messages ?? []) {
        if (!message.id || !message.from) continue
        messages.push({
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
        statuses.push({
          providerMessageId: status.id,
          status: status.status as ParsedStatusUpdate['status'],
          errorTitle: status.errors?.[0]?.title ?? null,
        })
      }
    }
  }

  return { messages, statuses }
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

export class WebhookService {
  constructor(private repo: WhatsAppRepository) {}

  async ingestMessages(weddingId: string, messages: ParsedInboundMessage[]): Promise<void> {
    await this.repo.createInboundMessages(weddingId, messages)
  }

  async ingestStatuses(statuses: ParsedStatusUpdate[]): Promise<void> {
    for (const status of statuses) {
      const now = new Date()
      await this.repo.updateOutboundStatusByProviderMessageId(status.providerMessageId, {
        status: STATUS_TO_OUTBOUND[status.status],
        ...(status.status === 'sent' ? { sentAt: now } : {}),
        ...(status.status === 'delivered' ? { deliveredAt: now } : {}),
        ...(status.status === 'read' ? { readAt: now } : {}),
        ...(status.status === 'failed' ? { error: status.errorTitle ?? 'Unknown error' } : {}),
      })
    }
  }
}
