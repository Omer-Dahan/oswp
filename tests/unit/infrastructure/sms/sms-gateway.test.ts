jest.mock('~/env', () => ({ env: {} }))

import { env } from '~/env'
import { HttpSmsGateway } from '~/server/infrastructure/sms/sms-gateway'

const mockEnv = env as {
  SMSGATE_URL?: string
  SMSGATE_USER?: string
  SMSGATE_PASS?: string
}

describe('HttpSmsGateway', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
    mockEnv.SMSGATE_URL = 'https://api.sms-gate.app'
    mockEnv.SMSGATE_USER = 'user'
    mockEnv.SMSGATE_PASS = 'pass'
  })

  it('uses the cloud endpoint, browser user agent, basic auth and proven body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'message-1' }),
    })

    await expect(new HttpSmsGateway().send('+972541234567', 'שלום')).resolves.toEqual({
      ok: true,
      providerMessageId: 'message-1',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://api.sms-gate.app/3rdparty/v1/messages'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('user:pass').toString('base64')}`,
          'Content-Type': 'application/json',
          'User-Agent': expect.stringContaining('Mozilla/5.0'),
        }),
        body: JSON.stringify({
          textMessage: { text: 'שלום' },
          phoneNumbers: ['+972541234567'],
        }),
      })
    )
  })

  it('uses /message for a local gateway', async () => {
    mockEnv.SMSGATE_URL = 'http://127.0.0.1:8080/base'
    fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({}) })

    await new HttpSmsGateway().send('+972541234567', 'שלום')

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://127.0.0.1:8080/message'),
      expect.any(Object)
    )
  })

  it('returns a clear Hebrew error when configuration is missing', async () => {
    mockEnv.SMSGATE_PASS = undefined

    await expect(new HttpSmsGateway().send('+972541234567', 'שלום')).resolves.toEqual({
      ok: false,
      error: 'שירות ה-SMS אינו מוגדר. חסרים פרטי החיבור לשער ההודעות.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
