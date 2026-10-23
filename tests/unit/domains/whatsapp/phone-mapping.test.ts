/**
 * Tests for WhatsApp Domain Phone Normalisation
 */

import { normalisePhone } from '~/server/domains/whatsapp/phone-mapping'

describe('normalisePhone', () => {
  it('resolves the five common Israeli phone spellings to the same key', () => {
    const key = normalisePhone('0541234567')
    expect(key).toBe('541234567')

    expect(normalisePhone('+972-54-123-4567')).toBe(key)
    expect(normalisePhone('972541234567')).toBe(key)
    expect(normalisePhone('054-1234567')).toBe(key)
    expect(normalisePhone('054 123 4567')).toBe(key)
    expect(normalisePhone('00972541234567')).toBe(key)
  })

  it('returns null when there are fewer than 9 significant digits', () => {
    expect(normalisePhone('1234')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(normalisePhone('')).toBeNull()
  })
})
