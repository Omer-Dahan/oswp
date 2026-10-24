import { calculateDaysRemaining } from '~/app/utils/helpers'

describe('calculateDaysRemaining', () => {
  const RealDateTimeFormat = Intl.DateTimeFormat

  afterEach(() => {
    jest.useRealTimers()
    global.Intl.DateTimeFormat = RealDateTimeFormat
  })

  // `weddingDate` is a UTC-midnight `@db.Date` value; "now" is simulated by
  // mocking Date's constructor via jest fake timers so Jerusalem-local
  // "today" can be pinned independently of the test runner's own timezone.
  it('counts whole calendar days using Asia/Jerusalem as "today", not server TZ', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T22:30:00.000Z')) // 2026-06-02 01:30 in Jerusalem (UTC+3 in summer)

    const weddingDate = new Date('2026-06-03T00:00:00.000Z')
    expect(calculateDaysRemaining(weddingDate)).toBe(1)
  })

  it('returns 0 for a wedding date that is today in Jerusalem', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-02T23:00:00.000Z')) // 2026-06-03 02:00 in Jerusalem

    const weddingDate = new Date('2026-06-03T00:00:00.000Z')
    expect(calculateDaysRemaining(weddingDate)).toBe(0)
  })

  it('returns undefined when no date is given', () => {
    expect(calculateDaysRemaining(null)).toBeUndefined()
    expect(calculateDaysRemaining(undefined)).toBeUndefined()
  })
})
