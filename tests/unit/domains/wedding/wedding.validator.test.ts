import {
  updateRsvpCopySchema,
  updateRsvpStepsSchema,
} from '~/server/domains/wedding/wedding.validator'

describe('updateRsvpStepsSchema', () => {
  it('accepts an ordered subset of supported RSVP steps', () => {
    expect(
      updateRsvpStepsSchema.parse({
        rsvpSteps: ['wishes-message', 'children-count'],
      })
    ).toEqual({ rsvpSteps: ['wishes-message', 'children-count'] })
  })

  it.each([
    ['an unknown key', ['children-count', 'unknown-step']],
    ['duplicate keys', ['dietary-notes', 'dietary-notes']],
    [
      'more than three entries',
      ['children-count', 'dietary-notes', 'wishes-message', 'children-count'],
    ],
    ['a non-array value', 'children-count'],
  ])('rejects %s', (_label, rsvpSteps) => {
    expect(updateRsvpStepsSchema.safeParse({ rsvpSteps }).success).toBe(false)
  })
})

describe('updateRsvpCopySchema', () => {
  it('trims values and drops blank and default copy', () => {
    expect(
      updateRsvpCopySchema.parse({
        rsvpCopy: {
          whoIsComingTitle: '  מי מגיע אלינו?  ',
          childrenCountTitle: '   ',
          dietaryNotesTitle: 'הגבלות או בעיות תזונה',
        },
      })
    ).toEqual({ rsvpCopy: { whoIsComingTitle: 'מי מגיע אלינו?' } })
  })

  it('rejects an unknown key', () => {
    expect(
      updateRsvpCopySchema.safeParse({ rsvpCopy: { internalAriaLabel: 'לא מורשה' } }).success
    ).toBe(false)
  })

  it('rejects values longer than 600 characters', () => {
    expect(
      updateRsvpCopySchema.safeParse({ rsvpCopy: { whoIsComingTitle: 'א'.repeat(601) } }).success
    ).toBe(false)
  })
})
