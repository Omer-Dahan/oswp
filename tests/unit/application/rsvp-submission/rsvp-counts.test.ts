import { deriveRsvpCounts } from '~/server/application/rsvp-submission/rsvp-counts'

describe('deriveRsvpCounts', () => {
  it('persists one attendee when an attending submission omits its counts', () => {
    expect(
      deriveRsvpCounts({
        responses: [{ guestId: 11, rsvp: 'Attending' }],
      })
    ).toEqual({ attendingCount: 1, childrenCount: 0, namedAttendeeIds: [11] })
  })

  it('counts distinct named attendees across event responses', () => {
    expect(
      deriveRsvpCounts({
        responses: [
          { guestId: 11, rsvp: 'Attending' },
          { guestId: 11, rsvp: 'Attending' },
          { guestId: 12, rsvp: 'Attending' },
        ],
      })
    ).toEqual({ attendingCount: 2, childrenCount: 0, namedAttendeeIds: [11, 12] })
  })

  it('stores no counts for a declined household', () => {
    expect(
      deriveRsvpCounts({
        responses: [{ guestId: 11, rsvp: 'Declined' }],
        attendingCount: 0,
        childrenCount: 0,
      })
    ).toEqual({ attendingCount: null, childrenCount: null, namedAttendeeIds: [] })
  })

  it('keeps explicit counts when the household has attendees', () => {
    expect(
      deriveRsvpCounts({
        responses: [{ guestId: 11, rsvp: 'Attending' }],
        attendingCount: 3,
        childrenCount: 1,
      })
    ).toEqual({ attendingCount: 3, childrenCount: 1, namedAttendeeIds: [11] })
  })
})
