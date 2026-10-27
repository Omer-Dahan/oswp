import { isChuppahOnlySelection, isChuppahEventName } from '~/lib/wedding/rsvp-events'

const chuppah = { id: 'c1', name: 'החופה', collectRsvp: true }
const wedding = { id: 'w1', name: 'החתונה', isPrimary: true, collectRsvp: true }

describe('isChuppahOnlySelection', () => {
  it('is true when the flow is narrowed to the chuppah event', () => {
    expect(isChuppahOnlySelection([wedding, chuppah], 'c1')).toBe(true)
  })

  it('is false when the flow covers both events', () => {
    expect(isChuppahOnlySelection([wedding, chuppah], null)).toBe(false)
  })

  it('is false when the narrowed event is the wedding itself', () => {
    expect(isChuppahOnlySelection([wedding, chuppah], 'w1')).toBe(false)
  })

  it('is false when the only event is the wedding', () => {
    expect(isChuppahOnlySelection([wedding], null)).toBe(false)
  })

  it('is true when the ceremony is the only RSVP-able event', () => {
    expect(isChuppahOnlySelection([chuppah, { id: 'x', name: 'טקס', collectRsvp: false }], null)).toBe(
      true
    )
  })
})

describe('isChuppahEventName', () => {
  it('matches Hebrew and English ceremony names only', () => {
    expect(isChuppahEventName('החופה')).toBe(true)
    expect(isChuppahEventName('Ceremony')).toBe(true)
    expect(isChuppahEventName('החתונה')).toBe(false)
    expect(isChuppahEventName(null)).toBe(false)
  })
})
