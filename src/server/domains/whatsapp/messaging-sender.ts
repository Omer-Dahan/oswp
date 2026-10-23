/**
 * WhatsApp Domain - Paced sender
 *
 * sendTemplate posts one queued message to the Meta Graph API. Parameter
 * mapping (guest/household data -> template variables) is a small pure
 * function so it's unit-testable without touching the network or the DB.
 */

import { decryptSecret } from '~/server/infrastructure/crypto/secrets'
import type { WhatsAppRepository } from '~/server/domains/whatsapp/whatsapp.repository'
import { env } from '~/env'

const GRAPH_API_VERSION = 'v23.0'
const MAX_ATTEMPTS = 3 // 1 initial attempt + 2 retries
const RETRY_BACKOFF_MS = [500, 1500]

export type TemplateVariables = {
  firstName: string
  eventName: string | null
  eventDateLabel: string | null
  rsvpLink: string | null
}

export type TemplateComponent = {
  type: 'body'
  parameters: Array<{ type: 'text'; text: string }>
}

/**
 * Maps guest/household/event data to the template's body parameters, in the
 * fixed order {{1}} first name, {{2}} event name, {{3}} event date, {{4}}
 * RSVP link. Pure: same input always gives the same output, no I/O.
 */
export function buildTemplateComponents(vars: TemplateVariables): TemplateComponent[] {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: vars.firstName },
        { type: 'text', text: vars.eventName ?? '' },
        { type: 'text', text: vars.eventDateLabel ?? '' },
        { type: 'text', text: vars.rsvpLink ?? '' },
      ],
    },
  ]
}

/** Renders a template's {{1}}..{{4}} placeholders with real data, for UI preview only. */
export function renderTemplatePreview(bodyPreview: string | null, vars: TemplateVariables): string {
  if (!bodyPreview) return ''
  return bodyPreview
    .replaceAll('{{1}}', vars.firstName)
    .replaceAll('{{2}}', vars.eventName ?? '')
    .replaceAll('{{3}}', vars.eventDateLabel ?? '')
    .replaceAll('{{4}}', vars.rsvpLink ?? '')
}

const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat('he-IL', { dateStyle: 'long' })

/** Builds the template variables for one household's primary contact. */
export function resolveTemplateVariables(context: {
  firstName: string
  event: { name: string; date: Date | null } | null
  inviteUrl: string | null
}): TemplateVariables {
  return {
    firstName: context.firstName,
    eventName: context.event?.name ?? null,
    eventDateLabel: context.event?.date ? EVENT_DATE_FORMATTER.format(context.event.date) : null,
    rsvpLink: context.inviteUrl,
  }
}

export type SendOutcome =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; retryable: boolean }

type PostDeps = {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

/** POSTs one template message to the Graph API, retrying 429/5xx up to twice; never retries 4xx. */
export async function postTemplateMessage(
  params: {
    phoneNumberId: string
    accessToken: string
    toPhone: string
    templateName: string
    languageCode: string
    components: TemplateComponent[]
  },
  deps: PostDeps = {}
): Promise<SendOutcome> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${params.phoneNumberId}/messages`

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: params.toPhone,
          type: 'template',
          template: {
            name: params.templateName,
            language: { code: params.languageCode },
            components: params.components,
          },
        }),
      })
    } catch {
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_BACKOFF_MS[attempt] ?? 1500)
        continue
      }
      return { ok: false, error: 'לא ניתן להתחבר ל-Meta Graph API', retryable: true }
    }

    const body = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>
      error?: { message?: string; code?: number }
    }

    if (response.ok && body.messages?.[0]?.id) {
      return { ok: true, providerMessageId: body.messages[0].id }
    }

    const isRetryable = response.status === 429 || response.status >= 500
    if (isRetryable && attempt < MAX_ATTEMPTS - 1) {
      await sleep(RETRY_BACKOFF_MS[attempt] ?? 1500)
      continue
    }

    return {
      ok: false,
      error: body.error?.message ?? `Meta API returned HTTP ${response.status}`,
      retryable: isRetryable,
    }
  }

  return { ok: false, error: 'שליחת ההודעה נכשלה', retryable: true }
}

export class MessagingSender {
  constructor(private repo: WhatsAppRepository) {}

  /** Sends one SENDING outbound row (already claimed by the queue runner); returns whether it was sent. */
  async sendTemplate({ outboundId }: { outboundId: string }): Promise<boolean> {
    const context = await this.repo.findSendContext(outboundId)
    if (!context) return false

    const { outbound, account } = context
    if (!account?.phoneNumberId || !account.accessTokenEnc) {
      await this.repo.markFailed(outboundId, 'חשבון הוואטסאפ לא מחובר')
      return false
    }

    const inviteUrl =
      context.household?.inviteCode && context.websiteSubUrl
        ? `${env.NEXT_PUBLIC_APP_URL}/w/${context.websiteSubUrl}/save-the-date/${context.household.inviteCode}`
        : null

    const vars = resolveTemplateVariables({
      firstName: context.guest?.firstName ?? '',
      event: context.event ?? null,
      inviteUrl,
    })

    const outcome = await postTemplateMessage({
      phoneNumberId: account.phoneNumberId,
      accessToken: decryptSecret(account.accessTokenEnc),
      toPhone: outbound.toPhone,
      templateName: outbound.templateName,
      languageCode: 'he',
      components: buildTemplateComponents(vars),
    })

    if (outcome.ok) {
      await this.repo.markSent(outboundId, outcome.providerMessageId)
      return true
    }

    await this.repo.markFailed(outboundId, outcome.error)
    return false
  }
}
