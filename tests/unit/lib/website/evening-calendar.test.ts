import { buildEveningCalendarLinks } from '~/lib/website/calendar'

const day = new Date(Date.UTC(2026, 10, 24))
const chuppah = {
  name: 'החופה',
  date: day,
  startTime: '19:30',
  endTime: '20:30',
  venue: 'אגדתא',
  venueAddress: null,
  venueWazeUrl: null,
}
const wedding = {
  name: 'החתונה',
  date: day,
  startTime: '18:30',
  endTime: '00:30',
  venue: 'אגדתא',
  venueAddress: null,
  venueWazeUrl: null,
}

describe('buildEveningCalendarLinks', () => {
  it('produces ONE entry covering the whole evening instead of one per event', () => {
    const links = buildEveningCalendarLinks({ title: 'החתונה של דוד ומורשה', events: [chuppah, wedding] })
    expect(links).not.toBeNull()
    const ics = links!.ics
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    // 18:30 IST == 16:30Z, and 00:30 the next day IST == 22:30Z
    expect(ics).toContain('DTSTART:20261124T163000Z')
    expect(ics).toContain('DTEND:20261124T223000Z')
    expect(ics).toContain('LOCATION:אגדתא')
  })

  it('names both times so the guest sees the chuppah inside the evening', () => {
    const links = buildEveningCalendarLinks({ title: 'החתונה של דוד ומורשה', events: [chuppah, wedding] })
    expect(links!.timeLine).toContain('החופה')
    expect(links!.timeLine).toContain('19:30')
    expect(links!.timeLine).toContain('החתונה')
    expect(links!.timeLine).toContain('18:30')
  })

  it('returns null when no event has a date', () => {
    expect(buildEveningCalendarLinks({ title: 'x', events: [{ ...wedding, date: null }] })).toBeNull()
  })
})
