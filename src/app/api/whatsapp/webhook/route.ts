/**
 * GET/POST /api/whatsapp/webhook
 *
 * The one public route Meta calls directly: GET is the subscription
 * verification handshake, POST delivers inbound messages and delivery
 * statuses. No auth cookie applies here - trust comes only from the verify
 * token (GET) or the HMAC signature (POST).
 */

import {
  parseWebhookPayload,
  verifyWebhookSignature,
  type WhatsAppAccount,
  webhookService,
  whatsAppRepository,
} from '~/server/domains/whatsapp'
import { decryptSecret } from '~/server/infrastructure/crypto/secrets'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !token) {
    return new Response(null, { status: 403 })
  }

  const account = await whatsAppRepository.findAccountByVerifyToken(token)
  if (!account) {
    return new Response(null, { status: 403 })
  }

  return new Response(challenge ?? '', {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  })
}

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text()

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return Response.json({ ok: true })
  }

  const groups = parseWebhookPayload(payload)
  if (groups.length === 0) {
    return Response.json({ ok: true })
  }

  // Meta signs the whole body with one app's secret. A batch normally covers
  // a single account, but each change is checked against its own account
  // (rather than assuming entry[0]) since a WABA can report several numbers
  // in one call.
  const signatureHeader = req.headers.get('x-hub-signature-256')
  let verifiedAccount: WhatsAppAccount | null = null
  try {
    for (const group of groups) {
      const account = await whatsAppRepository.findAccountByPhoneNumberId(group.phoneNumberId)
      if (!account?.appSecretEnc) continue
      const appSecret = decryptSecret(account.appSecretEnc)
      if (verifyWebhookSignature(rawBody, signatureHeader, appSecret)) {
        verifiedAccount = account
        break
      }
    }
  } catch (error) {
    console.error('WhatsApp webhook signature verification failed', error)
    return new Response(null, { status: 500 })
  }

  if (!verifiedAccount) {
    return new Response(null, { status: 401 })
  }

  try {
    for (const group of groups) {
      const account =
        group.phoneNumberId === verifiedAccount.phoneNumberId
          ? verifiedAccount
          : await whatsAppRepository.findAccountByPhoneNumberId(group.phoneNumberId)
      // A number not tied to any configured account can't be routed to a
      // wedding — skip it rather than guessing.
      if (!account) continue

      if (group.messages.length > 0) {
        await webhookService.ingestMessages(account.weddingId, group.messages)
      }
      if (group.statuses.length > 0) {
        await webhookService.ingestStatuses(group.statuses)
      }
    }
  } catch (error) {
    // Unlike a malformed payload (handled above with 200s, since retrying
    // won't fix it), a failure here is likely transient — return 500 so Meta
    // retries the delivery instead of silently dropping it.
    console.error('WhatsApp webhook ingestion failed', error)
    return new Response(null, { status: 500 })
  }

  return Response.json({ ok: true })
}
