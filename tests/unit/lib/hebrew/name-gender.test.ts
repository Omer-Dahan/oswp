import { detectNameGender, getAddressForm } from '~/lib/hebrew/name-gender'
import goldens from './name-gender.golden.json'

describe('detectNameGender', () => {
  it.each(goldens.map((g) => [g.name, g.expected, g.category] as const))(
    '%s -> %s (%s)',
    (name, expected) => {
      expect(detectNameGender(name)).toBe(expected)
    }
  )

  it('returns unknown for an empty string', () => {
    expect(detectNameGender('')).toBe('unknown')
  })

  it('looks at only the first token of a full name', () => {
    expect(detectNameGender('דוד כהן')).toBe(detectNameGender('דוד'))
  })
})

describe('getAddressForm', () => {
  it('is plural for a household with more than one guest', () => {
    expect(getAddressForm({ guestCount: 2, primaryGuestFirstName: 'דוד' })).toBe('plural')
  })

  it('is plural when confirmedCount is above 1 even if guestCount is 1', () => {
    expect(
      getAddressForm({ guestCount: 1, confirmedCount: 3, primaryGuestFirstName: 'דוד' })
    ).toBe('plural')
  })

  it('is male for a single male guest', () => {
    expect(getAddressForm({ guestCount: 1, primaryGuestFirstName: 'דוד' })).toBe('male')
  })

  it('is female for a single female guest', () => {
    expect(getAddressForm({ guestCount: 1, primaryGuestFirstName: 'רחל' })).toBe('female')
  })

  it('is neutral for a single guest with an unresolved name', () => {
    expect(getAddressForm({ guestCount: 1, primaryGuestFirstName: 'קנפו' })).toBe('neutral')
  })

  it('is neutral for a single guest with a unisex name', () => {
    expect(getAddressForm({ guestCount: 1, primaryGuestFirstName: 'שמחה' })).toBe('neutral')
  })

  it('is neutral when no primary guest name is known', () => {
    expect(getAddressForm({ guestCount: 1, primaryGuestFirstName: null })).toBe('neutral')
  })
})
