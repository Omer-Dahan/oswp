import { getScopedRsvpSteps } from '~/lib/rsvp/steps'

describe('getScopedRsvpSteps', () => {
  it('deduplicates the union and preserves the wedding order', () => {
    expect(
      getScopedRsvpSteps({
        weddingSteps: ['dietary-notes', 'children-count'],
        events: [
          { id: 'event-1', rsvpSteps: ['children-count'] },
          { id: 'event-2', rsvpSteps: ['children-count', 'dietary-notes'] },
        ],
        invitedEventIds: new Set(['event-1', 'event-2']),
      })
    ).toEqual(['dietary-notes', 'children-count'])
  })

  it('lets an empty event configuration remove a globally listed step', () => {
    expect(
      getScopedRsvpSteps({
        weddingSteps: ['children-count', 'dietary-notes'],
        events: [{ id: 'event-1', rsvpSteps: [] }],
        invitedEventIds: new Set(['event-1']),
      })
    ).toEqual([])
  })

  it('uses only the preselected event', () => {
    expect(
      getScopedRsvpSteps({
        weddingSteps: ['children-count', 'wishes-message'],
        events: [
          { id: 'event-1', rsvpSteps: ['children-count'] },
          { id: 'event-2', rsvpSteps: ['wishes-message'] },
        ],
        preselectedEventId: 'event-2',
        invitedEventIds: new Set(['event-1', 'event-2']),
      })
    ).toEqual(['wishes-message'])
  })
})
