import {
  getGuestWeights,
  getOpenSeats,
  getSeatsNeeded,
  tableHasRoom,
  type WeightableHousehold,
} from '~/server/domains/seating/seating.rules'

describe('seating.rules weighted seats', () => {
  const bigHousehold: WeightableHousehold = {
    invitedCount: 10,
    guests: [{ id: 1, isPrimaryContact: true }],
  }
  const smallHousehold: WeightableHousehold = {
    invitedCount: 7,
    guests: [{ id: 2, isPrimaryContact: true }],
  }

  it('a household of 10 with one guest row needs 10 seats', () => {
    const weights = getGuestWeights([bigHousehold])

    expect(getSeatsNeeded([], [1], weights)).toBe(10)
  })

  it('a table of capacity 16 holding that household reports 6 open seats', () => {
    const weights = getGuestWeights([bigHousehold])

    expect(getOpenSeats({ capacity: 16, guestIds: [1] }, weights)).toBe(6)
  })

  it('rejects another household of 7 when it would overflow the table', () => {
    const weights = getGuestWeights([bigHousehold, smallHousehold])

    expect(tableHasRoom({ capacity: 16, guestIds: [1] }, [2], weights)).toBe(false)
  })

  it('behaves exactly as before when no weights map is passed', () => {
    expect(getSeatsNeeded([], [1, 2, 3])).toBe(3)
    expect(getOpenSeats({ capacity: 4, guestIds: [1, 2] })).toBe(2)
    expect(tableHasRoom({ capacity: 4, guestIds: [1, 2] }, [3])).toBe(true)
  })
})
