import { guestSelfAddSchema } from '~/server/application/guest-self-add/guest-self-add.validator'

const baseInput = {
  subUrl: 'our-wedding',
  fullName: 'דנה כהן',
  phone: '0501234567',
  attendingCount: 2,
}

describe('guestSelfAddSchema', () => {
  it('accepts a valid submission and normalises the phone to E.164', () => {
    const result = guestSelfAddSchema.safeParse(baseInput)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.phone).toBe('+972501234567')
    }
  })

  it('accepts a single-token name of at least 2 characters', () => {
    const result = guestSelfAddSchema.safeParse({ ...baseInput, fullName: 'דנה' })
    expect(result.success).toBe(true)
  })

  it.each([['א'], [''], ['  ']])('rejects a single-token name shorter than 2 chars (%s)', (fullName) => {
    const result = guestSelfAddSchema.safeParse({ ...baseInput, fullName })
    expect(result.success).toBe(false)
  })

  it('rejects a phone number that is not a real Israeli mobile', () => {
    const result = guestSelfAddSchema.safeParse({ ...baseInput, phone: '021234567' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('הזינו מספר טלפון נייד ישראלי תקין')
    }
  })

  it('rejects a phone number with too few digits', () => {
    const result = guestSelfAddSchema.safeParse({ ...baseInput, phone: '123' })
    expect(result.success).toBe(false)
  })

  it('rejects an attendingCount of 0', () => {
    const result = guestSelfAddSchema.safeParse({ ...baseInput, attendingCount: 0 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('מספר המשתתפים חייב להיות בין 1 ל-8')
    }
  })

  it('rejects an attendingCount of 9', () => {
    const result = guestSelfAddSchema.safeParse({ ...baseInput, attendingCount: 9 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('מספר המשתתפים חייב להיות בין 1 ל-8')
    }
  })

  it('accepts the boundary values 1 and 8', () => {
    expect(guestSelfAddSchema.safeParse({ ...baseInput, attendingCount: 1 }).success).toBe(true)
    expect(guestSelfAddSchema.safeParse({ ...baseInput, attendingCount: 8 }).success).toBe(true)
  })
})
