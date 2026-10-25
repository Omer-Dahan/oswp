/**
 * Tests for per-template body variable ordering in buildTemplateComponents.
 */

import { buildTemplateComponents, type TemplateVariables } from '~/server/domains/whatsapp/messaging-sender'

const vars: TemplateVariables = {
  firstName: 'דנה',
  eventName: 'חתונה',
  eventDateLabel: '1 בינואר 2027',
  venue: 'גן האירועים',
  rsvpLink: 'https://example.com/rsvp',
}

describe('buildTemplateComponents variable key ordering', () => {
  it('fills body parameters in the order given by variableKeys', () => {
    const result = buildTemplateComponents(vars, 3, undefined, [
      'firstName',
      'eventDateLabel',
      'venue',
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected success')

    expect(result.components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'דנה' },
          { type: 'text', text: '1 בינואר 2027' },
          { type: 'text', text: 'גן האירועים' },
        ],
      },
    ])
  })

  it('falls back to the legacy fixed order when variableKeys is omitted or empty', () => {
    const withoutKeys = buildTemplateComponents(vars, 4)
    const withEmptyKeys = buildTemplateComponents(vars, 4, undefined, [])

    const expected = {
      ok: true,
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: vars.firstName },
            { type: 'text', text: vars.eventName },
            { type: 'text', text: vars.eventDateLabel },
            { type: 'text', text: vars.rsvpLink },
          ],
        },
      ],
    }

    expect(withoutKeys).toEqual(expected)
    expect(withEmptyKeys).toEqual(expected)
  })

  it('renders a missing venue as an empty string without throwing', () => {
    const varsNoVenue: TemplateVariables = { ...vars, venue: null }

    const result = buildTemplateComponents(varsNoVenue, 3, undefined, [
      'firstName',
      'eventDateLabel',
      'venue',
    ])

    expect(result).toEqual({
      ok: true,
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: varsNoVenue.firstName },
            { type: 'text', text: varsNoVenue.eventDateLabel },
            { type: 'text', text: '' },
          ],
        },
      ],
    })
  })

  it('still prepends the IMAGE header component before the body when variableKeys is set', () => {
    const result = buildTemplateComponents(
      vars,
      3,
      { hasImageHeader: true, headerImageUrl: 'https://cdn.example.com/invite.jpg' },
      ['firstName', 'eventDateLabel', 'venue']
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected success')

    expect(result.components[0]).toEqual({
      type: 'header',
      parameters: [{ type: 'image', image: { link: 'https://cdn.example.com/invite.jpg' } }],
    })
    expect(result.components[1]).toEqual({
      type: 'body',
      parameters: [
        { type: 'text', text: vars.firstName },
        { type: 'text', text: vars.eventDateLabel },
        { type: 'text', text: vars.venue },
      ],
    })
  })
})
