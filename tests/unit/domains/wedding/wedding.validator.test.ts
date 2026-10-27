import { updateRsvpStepsSchema } from '~/server/domains/wedding/wedding.validator'

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
