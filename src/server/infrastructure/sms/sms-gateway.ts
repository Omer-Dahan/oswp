import { env } from '~/env'

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const CONFIG_ERROR = 'שירות ה-SMS אינו מוגדר. חסרים פרטי החיבור לשער ההודעות.'

export type SmsGatewayResult = {
  ok: boolean
  providerMessageId?: string
  error?: string
}

export type SmsGateway = {
  send(phone: string, text: string): Promise<SmsGatewayResult>
}

export type SmsGatewayCredentials = {
  url: string
  username: string
  password: string
}

function gatewayEndpoint(baseUrl: string): URL {
  const url = new URL(baseUrl)
  url.pathname = url.hostname === 'api.sms-gate.app' ? '/3rdparty/v1/messages' : '/message'
  url.search = ''
  return url
}

class ConfiguredSmsGateway implements SmsGateway {
  constructor(private credentials: SmsGatewayCredentials) {}

  async send(phone: string, text: string): Promise<SmsGatewayResult> {
    try {
      const response = await fetch(gatewayEndpoint(this.credentials.url), {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.credentials.username}:${this.credentials.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'User-Agent': BROWSER_USER_AGENT,
        },
        body: JSON.stringify({
          textMessage: { text },
          phoneNumbers: [phone],
        }),
        signal: AbortSignal.timeout(20_000),
      })

      const payload = (await response.json().catch(() => null)) as {
        id?: string
        messageId?: string
        error?: string
        message?: string
      } | null
      if (!response.ok) {
        return {
          ok: false,
          error: payload?.error ?? payload?.message ?? `שער ה-SMS החזיר שגיאה ${response.status}`,
        }
      }

      return {
        ok: true,
        providerMessageId: payload?.id ?? payload?.messageId,
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'שליחת ה-SMS נכשלה',
      }
    }
  }
}

export function createSmsGateway(credentials: SmsGatewayCredentials): SmsGateway {
  return new ConfiguredSmsGateway(credentials)
}

export class HttpSmsGateway implements SmsGateway {
  async send(phone: string, text: string): Promise<SmsGatewayResult> {
    if (!env.SMSGATE_URL || !env.SMSGATE_USER || !env.SMSGATE_PASS) {
      return { ok: false, error: CONFIG_ERROR }
    }
    return createSmsGateway({
      url: env.SMSGATE_URL,
      username: env.SMSGATE_USER,
      password: env.SMSGATE_PASS,
    }).send(phone, text)
  }
}
