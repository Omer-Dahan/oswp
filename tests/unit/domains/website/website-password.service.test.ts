import { WebsitePasswordService } from '~/server/domains/website/website-password.service'

describe('WebsitePasswordService', () => {
  const service = new WebsitePasswordService('test-secret')

  describe('hashPassword and verifyPassword', () => {
    it('should hash passwords and verify correct input', async () => {
      const hashedPassword = await service.hashPassword('super-secret')

      expect(hashedPassword).not.toBe('super-secret')
      expect(await service.verifyPassword('super-secret', hashedPassword)).toBe(true)
    })

    it('should reject invalid password input', async () => {
      const hashedPassword = await service.hashPassword('super-secret')

      expect(await service.verifyPassword('wrong-password', hashedPassword)).toBe(false)
    })
  })

  describe('access token signing', () => {
    it('should create verifiable access token for website password gate', async () => {
      const hashedPassword = await service.hashPassword('super-secret')
      const token = service.createAccessToken('website-123', hashedPassword)

      expect(service.verifyAccessToken(token, 'website-123', hashedPassword)).toBe(true)
    })

    it('should reject tampered access token', async () => {
      const hashedPassword = await service.hashPassword('super-secret')
      const token = service.createAccessToken('website-123', hashedPassword)

      expect(service.verifyAccessToken(`${token}tampered`, 'website-123', hashedPassword)).toBe(
        false
      )
    })
  })
})
