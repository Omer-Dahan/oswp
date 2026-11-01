/**
 * Tests for the single-household-create duplicate matcher.
 */

import { isPrimaryContactMatch } from '~/server/domains/household/household-import-matcher'

describe('isPrimaryContactMatch', () => {
  it('matches an identical name', () => {
    expect(
      isPrimaryContactMatch(
        { firstName: 'דני', lastName: 'כהן' },
        { firstName: 'דני', lastName: 'כהן' }
      )
    ).toBe(true)
  })

  it('matches names differing only in extra spaces and case', () => {
    expect(
      isPrimaryContactMatch(
        { firstName: '  Dani  ', lastName: 'Cohen' },
        { firstName: 'dani', lastName: '  COHEN' }
      )
    ).toBe(true)
  })

  it('matches the same phone written once locally and once internationally', () => {
    expect(
      isPrimaryContactMatch(
        { firstName: 'Dani', lastName: 'Cohen', phone: '050-1234567' },
        { firstName: 'Someone', lastName: 'Else', phone: '+972501234567' }
      )
    ).toBe(true)
  })

  it('does not match unrelated names with no phone overlap', () => {
    expect(
      isPrimaryContactMatch(
        { firstName: 'Dani', lastName: 'Cohen', phone: '050-1234567' },
        { firstName: 'Yossi', lastName: 'Levi', phone: '052-7654321' }
      )
    ).toBe(false)
  })
})
