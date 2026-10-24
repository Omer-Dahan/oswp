import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

const PASSWORD_KEY_LENGTH = 64
const DEFAULT_SIGNING_SECRET = process.env.BETTER_AUTH_SECRET ?? 'website-password-secret'

export class WebsitePasswordService {
  constructor(private signingSecret: string = DEFAULT_SIGNING_SECRET) {}

  async hashPassword(rawPassword: string): Promise<string> {
    const salt = randomBytes(16).toString('hex')
    const derivedKey = (await scryptAsync(rawPassword, salt, PASSWORD_KEY_LENGTH)) as Buffer
    return `${salt}:${derivedKey.toString('hex')}`
  }

  async verifyPassword(rawPassword: string, storedPasswordHash: string | null): Promise<boolean> {
    if (!storedPasswordHash) return false

    const [salt, storedDerivedKey] = storedPasswordHash.split(':')
    if (!salt || !storedDerivedKey) return false

    const inputDerivedKey = (await scryptAsync(rawPassword, salt, PASSWORD_KEY_LENGTH)) as Buffer
    const storedDerivedKeyBuffer = Buffer.from(storedDerivedKey, 'hex')

    if (inputDerivedKey.length !== storedDerivedKeyBuffer.length) {
      return false
    }

    return timingSafeEqual(inputDerivedKey, storedDerivedKeyBuffer)
  }

  createAccessToken(websiteId: string, passwordHash: string): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${websiteId}:${passwordHash}`)
      .digest('hex')
  }

  verifyAccessToken(
    token: string | undefined,
    websiteId: string,
    passwordHash: string | null
  ): boolean {
    if (!token || !passwordHash) return false

    const expectedToken = this.createAccessToken(websiteId, passwordHash)
    const inputBuffer = Buffer.from(token)
    const expectedBuffer = Buffer.from(expectedToken)

    if (inputBuffer.length !== expectedBuffer.length) {
      return false
    }

    return timingSafeEqual(inputBuffer, expectedBuffer)
  }
}
