/**
 * Tests for WhatsApp Domain Webhook (signature verification + payload parsing)
 */

import { createHmac } from 'node:crypto'

import {
  extractPhoneNumberId,
  parseWebhookPayload,
  verifyWebhookSignature,
} from '~/server/domains/whatsapp/webhook.service'

const APP_SECRET = 'test-app-secret-123'

function sign(rawBody: string, secret = APP_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`
}

describe('verifyWebhookSignature', () => {
  it('accepts a signature computed over the exact raw body', () => {
    const rawBody = JSON.stringify({ hello: 'world' })
    expect(verifyWebhookSignature(rawBody, sign(rawBody), APP_SECRET)).toBe(true)
  })

  it('rejects a signature whose body was tampered with after signing', () => {
    const rawBody = JSON.stringify({ hello: 'world' })
    const signature = sign(rawBody)
    const tamperedBody = JSON.stringify({ hello: 'world!' })
    expect(verifyWebhookSignature(tamperedBody, signature, APP_SECRET)).toBe(false)
  })

  it('rejects when the signature header is missing', () => {
    const rawBody = JSON.stringify({ hello: 'world' })
    expect(verifyWebhookSignature(rawBody, null, APP_SECRET)).toBe(false)
  })

  it('rejects a well-formed but incorrect signature', () => {
    const rawBody = JSON.stringify({ hello: 'world' })
    expect(verifyWebhookSignature(rawBody, 'sha256=' + 'a'.repeat(64), APP_SECRET)).toBe(false)
  })
})

describe('parseWebhookPayload', () => {
  const fixture = {
    entry: [
      {
        id: 'waba-1',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: '1234567890' },
              contacts: [{ wa_id: '972500000001', profile: { name: 'Dana' } }],
              messages: [
                {
                  id: 'wamid.msg1',
                  from: '972500000001',
                  text: { body: 'מגיעים!' },
                },
              ],
            },
            field: 'messages',
          },
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: '1234567890' },
              contacts: [{ wa_id: '972500000002', profile: { name: 'Yossi' } }],
              messages: [
                {
                  id: 'wamid.msg2',
                  from: '972500000002',
                  button: { text: 'כן, מגיעים' },
                },
              ],
              statuses: [
                {
                  id: 'wamid.out1',
                  status: 'delivered',
                  recipient_id: '972500000003',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  }

  it('extracts the phone_number_id used to resolve the account', () => {
    expect(extractPhoneNumberId(fixture)).toBe('1234567890')
  })

  it('extracts two messages and one status from the fixture', () => {
    const { messages, statuses } = parseWebhookPayload(fixture)

    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({
      waId: '972500000001',
      fromPhone: '972500000001',
      profileName: 'Dana',
      text: 'מגיעים!',
      providerMessageId: 'wamid.msg1',
    })
    expect(messages[1]).toEqual({
      waId: '972500000002',
      fromPhone: '972500000002',
      profileName: 'Yossi',
      text: 'כן, מגיעים',
      providerMessageId: 'wamid.msg2',
    })

    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toEqual({
      providerMessageId: 'wamid.out1',
      status: 'delivered',
      errorTitle: null,
    })
  })

  it('returns empty arrays for a malformed/empty payload', () => {
    expect(parseWebhookPayload({})).toEqual({ messages: [], statuses: [] })
    expect(parseWebhookPayload(null)).toEqual({ messages: [], statuses: [] })
  })
})
