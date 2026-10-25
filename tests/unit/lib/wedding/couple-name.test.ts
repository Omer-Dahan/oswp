import { coupleInitials, coupleNames, coupleNamesHe } from '~/lib/wedding/couple-name'

describe('coupleNames', () => {
  it('joins groom first, then bride', () => {
    expect(coupleNames({ groomFirstName: 'דוד', brideFirstName: 'מורשה' })).toBe('דוד & מורשה')
  })

  it('collapses to the single present name', () => {
    expect(coupleNames({ groomFirstName: 'דוד', brideFirstName: '' })).toBe('דוד')
    expect(coupleNames({ groomFirstName: '', brideFirstName: 'מורשה' })).toBe('מורשה')
  })

  it('returns null when both names are empty', () => {
    expect(coupleNames({ groomFirstName: '', brideFirstName: '' })).toBeNull()
    expect(coupleNames({ groomFirstName: '  ', brideFirstName: null })).toBeNull()
  })

  it('trims whitespace before joining', () => {
    expect(coupleNames({ groomFirstName: ' דוד ', brideFirstName: ' מורשה ' })).toBe('דוד & מורשה')
  })
})

describe('coupleNamesHe', () => {
  it('joins with the Hebrew conjunction form', () => {
    expect(coupleNamesHe({ groomFirstName: 'דוד', brideFirstName: 'מורשה' })).toBe('דוד ומורשה')
  })
})

describe('coupleInitials', () => {
  it('returns groom-first initials', () => {
    expect(coupleInitials({ groomFirstName: 'דוד', brideFirstName: 'מורשה' })).toBe('ד & מ')
  })

  it('returns null for two empties', () => {
    expect(coupleInitials({ groomFirstName: '', brideFirstName: '' })).toBeNull()
  })
})
