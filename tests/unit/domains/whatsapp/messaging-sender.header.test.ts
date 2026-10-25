/**
 * Tests for the WhatsApp IMAGE header injection in buildTemplateComponents.
 */

import { buildTemplateComponents, type TemplateVariables } from '~/server/domains/whatsapp/messaging-sender'

const vars: TemplateVariables = {
  firstName: 'דנה',
  eventName: 'חתונה',
  eventDateLabel: '1 בינואר 2027',
  venue: null,
  rsvpLink: 'https://example.com/rsvp',
}

describe('buildTemplateComponents header handling', () => {
  it('prepends a header component before the body for an IMAGE-header template with a valid https URL', () => {
    const result = buildTemplateComponents(vars, 2, {
      hasImageHeader: true,
      headerImageUrl: 'https://cdn.example.com/invite.jpg',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected success')

    expect(result.components).toEqual([
      {
        type: 'header',
        parameters: [{ type: 'image', image: { link: 'https://cdn.example.com/invite.jpg' } }],
      },
      {
        type: 'body',
        parameters: [
          { type: 'text', text: vars.firstName },
          { type: 'text', text: vars.eventName },
        ],
      },
    ])
  })

  it('reports a typed failure and produces no components when the header image URL is missing', () => {
    const resultMissing = buildTemplateComponents(vars, 2, { hasImageHeader: true, headerImageUrl: null })
    expect(resultMissing).toEqual({ ok: false, error: 'missing_header_image', retryable: false })

    const resultUndefined = buildTemplateComponents(vars, 2, { hasImageHeader: true })
    expect(resultUndefined).toEqual({ ok: false, error: 'missing_header_image', retryable: false })
  })

  it('rejects an http:// header image URL', () => {
    const result = buildTemplateComponents(vars, 2, {
      hasImageHeader: true,
      headerImageUrl: 'http://cdn.example.com/invite.jpg',
    })

    expect(result).toEqual({ ok: false, error: 'missing_header_image', retryable: false })
  })

  it('behaves exactly as before for a text-only template with no IMAGE header', () => {
    const result = buildTemplateComponents(vars, 4)

    expect(result).toEqual({
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
    })
  })
})
