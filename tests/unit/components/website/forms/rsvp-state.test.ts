import {
  type AnswerWithType,
  canUseExtraGuests,
  clampCount,
  findExistingAnswer,
  getMaxAttendingBound,
  isGuestAttendingByDefault,
  removeAnswer,
  upsertAnswer,
  upsertRsvpResponses,
} from '~/components/website/forms/rsvp-state'

describe('rsvp-state utilities', () => {
  it('upserts RSVP responses by event+guest pair without duplicates', () => {
    const existing = [
      { eventId: 'evt-1', guestId: 1, rsvp: 'Attending', guestName: 'A One' },
      { eventId: 'evt-1', guestId: 2, rsvp: 'Declined', guestName: 'B Two' },
    ]

    const incoming = [
      { eventId: 'evt-1', guestId: 2, rsvp: 'Attending', guestName: 'B Two' },
      { eventId: 'evt-2', guestId: 1, rsvp: 'Attending', guestName: 'A One' },
    ]

    expect(upsertRsvpResponses(existing, incoming)).toEqual([
      { eventId: 'evt-1', guestId: 1, rsvp: 'Attending', guestName: 'A One' },
      { eventId: 'evt-1', guestId: 2, rsvp: 'Attending', guestName: 'B Two' },
      { eventId: 'evt-2', guestId: 1, rsvp: 'Attending', guestName: 'A One' },
    ])
  })

  it('upserts and removes question answers by question+audience key', () => {
    const answer: AnswerWithType = {
      questionId: 'q-1',
      questionType: 'Text',
      response: 'No nuts',
      guestId: 10,
      householdId: 'house-1',
      guestFirstName: 'Jamie',
      guestLastName: 'Doe',
    }

    const inserted = upsertAnswer([], answer)
    expect(inserted).toEqual([answer])
    expect(findExistingAnswer(inserted, answer)).toEqual(answer)

    const updated = upsertAnswer(inserted, { ...answer, response: 'Vegetarian' })
    expect(updated).toEqual([{ ...answer, response: 'Vegetarian' }])

    const removed = removeAnswer(updated, answer)
    expect(removed).toEqual([])
  })
})

describe('who-is-coming party-size helpers', () => {
  it('clamps the attending total at the invited-count bound and at zero', () => {
    expect(clampCount(10, 0, 4)).toBe(4)
    expect(clampCount(-3, 0, 4)).toBe(0)
    expect(clampCount(2, 0, 4)).toBe(2)
  })

  it('clamps the who-is-coming counter at the 20-guest cap', () => {
    expect(clampCount(25, 0, 20)).toBe(20)
    expect(clampCount(20, 0, 20)).toBe(20)
    expect(clampCount(19, 0, 20)).toBe(19)
  })

  it('caps the bound at 20 regardless of the imported invited count', () => {
    expect(getMaxAttendingBound(2, 3)).toBe(20)
    expect(getMaxAttendingBound(null, 3)).toBe(20)
    expect(getMaxAttendingBound(40, 3)).toBe(20)
  })

  it('allows the extra-guests stepper until the named guests reach the 20 cap', () => {
    expect(canUseExtraGuests(2, 2)).toBe(true)
    expect(canUseExtraGuests(null, 2)).toBe(true)
    expect(canUseExtraGuests(4, 20)).toBe(false)
  })

  it('defaults a guest to attending when there is no prior answer', () => {
    expect(isGuestAttendingByDefault(1, [], [])).toBe(true)
  })

  it('prefills a returning guest from their persisted invitation status', () => {
    const invitations = [{ eventId: 'evt-1', rsvp: 'Declined' }]
    expect(isGuestAttendingByDefault(1, invitations, [])).toBe(false)
  })

  it('prefers this session local edits over the persisted invitation status', () => {
    const invitations = [{ eventId: 'evt-1', rsvp: 'Declined' }]
    const localResponses = [
      { eventId: 'evt-1', guestId: 1, rsvp: 'Attending', guestName: 'A One' },
    ]
    expect(isGuestAttendingByDefault(1, invitations, localResponses)).toBe(true)
  })
})
