/**
 * GET/POST /api/whatsapp/webhook
 *
 * The one public route Meta calls directly: GET is the subscription
 * verification handshake, POST delivers inbound messages and delivery
 * statuses. No auth cookie applies here - trust comes only from the verify
 * token (GET) or the HMAC signature (POST).
 */

import { decryptSecret } from '~/server/infrastructure/crypto/secrets'
import {
  extractPhoneNumberId,
  parseWebhookPayload,
  verifyWebhookSignature,
  webhookService,
  whatsAppRepository,
} from '~/server/domains/whatsapp'

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
  try {
    const rawBody = await req.text()

    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return Response.json({ ok: true })
    }

    const phoneNumberId = extractPhoneNumberId(payload)
    if (!phoneNumberId) {
      return Response.json({ ok: true })
    }

    const account = await whatsAppRepository.findAccountByPhoneNumberId(phoneNumberId)
    if (!account?.appSecretEnc) {
      return new Response(null, { status: 401 })
    }

    const signatureHeader = req.headers.get('x-hub-signature-256')
    const appSecret = decryptSecret(account.appSecretEnc)
    if (!verifyWebhookSignature(rawBody, signatureHeader, appSecret)) {
      return new Response(null, { status: 401 })
    }

    const { messages, statuses } = parseWebhookPayload(payload)
    await webhookService.ingestMessages(account.weddingId, messages)
    await webhookService.ingestStatuses(statuses)

    return Response.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp webhook POST failed', error)
    return Response.json({ ok: true })
  }
}
