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
  venue: string | null
  rsvpLink: string | null
}

const LEGACY_VARIABLE_KEYS: Array<keyof TemplateVariables> = [
  'firstName',
  'eventName',
  'eventDateLabel',
  'rsvpLink',
]

export type TemplateComponent =
  | { type: 'header'; parameters: Array<{ type: 'image'; image: { link: string } }> }
  | { type: 'body'; parameters: Array<{ type: 'text'; text: string }> }

export type TemplateHeaderInfo = {
  hasImageHeader: boolean
  headerImageUrl?: string | null
}

export type BuildComponentsResult =
  | { ok: true; components: TemplateComponent[] }
  | { ok: false; error: 'missing_header_image'; retryable: false }

/**
 * Maps guest/household/event data to the template's body parameters, in the
 * order declared by `variableKeys` (each entry a `TemplateVariables` key) —
 * truncated to `paramCount`, since Meta rejects a message whose parameter
 * count doesn't exactly match the approved template. A template with no
 * placeholders (paramCount 0) gets no body component at all. `variableKeys`
 * defaults to the legacy fixed order so templates synced before this change
 * keep sending exactly what they send today.
 *
 * When the template declares an IMAGE header, Meta also rejects the send
 * unless a header image parameter is included, so a valid `https://` URL is
 * prepended before the body component; a missing or non-https URL is a
 * typed failure rather than a Meta 4xx.
 *
 * Pure: same input always gives the same output, no I/O.
 */
export function buildTemplateComponents(
  vars: TemplateVariables,
  paramCount: number,
  header?: TemplateHeaderInfo,
  variableKeys?: string[]
): BuildComponentsResult {
  const components: TemplateComponent[] = []

  if (header?.hasImageHeader) {
    const url = header.headerImageUrl
    if (!url || !url.startsWith('https://')) {
      return { ok: false, error: 'missing_header_image', retryable: false }
    }
    components.push({ type: 'header', parameters: [{ type: 'image', image: { link: url } }] })
  }

  if (paramCount > 0) {
    const keys = variableKeys && variableKeys.length > 0 ? variableKeys : LEGACY_VARIABLE_KEYS
    const allParams: Array<{ type: 'text'; text: string }> = keys.map((key) => ({
      type: 'text',
      text: vars[key as keyof TemplateVariables] ?? '',
    }))
    components.push({
      type: 'body',
      parameters: allParams.slice(0, Math.min(paramCount, allParams.length)),
    })
  }

  return { ok: true, components }
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
  event: { name: string; date: Date | null; venue: string | null } | null
  inviteUrl: string | null
}): TemplateVariables {
  return {
    firstName: context.firstName,
    eventName: context.event?.name ?? null,
    eventDateLabel: context.event?.date ? EVENT_DATE_FORMATTER.format(context.event.date) : null,
    venue: context.event?.venue ?? null,
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

    // Fall back to the old fixed shape only if the template was somehow
    // queued without ever being synced — every normal path has a row here.
    const language = context.template?.language ?? 'he'
    const paramCount = context.template?.paramCount ?? 4

    const built = buildTemplateComponents(
      vars,
      paramCount,
      {
        hasImageHeader: context.template?.hasImageHeader ?? false,
        headerImageUrl: context.template?.headerImageUrl ?? null,
      },
      context.template?.variableKeys
    )

    if (!built.ok) {
      await this.repo.markFailed(
        outboundId,
        'לתבנית הזו חסרה תמונת כותרת — הגדירו תמונה לפני שליחה.'
      )
      return false
    }

    const outcome = await postTemplateMessage({
      phoneNumberId: account.phoneNumberId,
      accessToken: decryptSecret(account.accessTokenEnc),
      toPhone: outbound.toPhone,
      templateName: outbound.templateName,
      languageCode: language,
      components: built.components,
    })

    if (outcome.ok) {
      await this.repo.markSent(outboundId, outcome.providerMessageId)
      return true
    }

    await this.repo.markFailed(outboundId, outcome.error)
    return false
  }
}
