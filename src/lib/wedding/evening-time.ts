/**
 * Time helpers for the "which events are you coming to?" screen.
 *
 * Pure functions only, kept out of the component so they can be unit tested
 * without the client bundle (icons, next-intl, form context).
 */

export type TimedEventLike = {
  startTime?: string | null
  endTime?: string | null
}

export const toMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

export const toClock = (minutes: number): string => {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

/**
 * The evening as a whole: earliest start to latest end across the events. Ends
 * after midnight count as the next day, so 00:30 is later than 20:30 even
 * though it sorts earlier as a string.
 */
export function fullEveningLabel(events: ReadonlyArray<TimedEventLike>): string {
  const starts = events.map((event) => event.startTime).filter(Boolean) as string[]
  const ends = events.map((event) => event.endTime).filter(Boolean) as string[]
  if (starts.length === 0) return ''
  const earliest = Math.min(...starts.map(toMinutes))
  const latest = ends.length
    ? Math.max(
        ...ends.map((end) => (toMinutes(end) < earliest ? toMinutes(end) + 1440 : toMinutes(end)))
      )
    : earliest
  return latest !== earliest ? `${toClock(earliest)}–${toClock(latest)}` : toClock(earliest)
}

/** "19:30–20:30" when both ends are known, otherwise whatever we have. */
export function timeRangeLabel(event: TimedEventLike): string {
  if (event.startTime && event.endTime) return `${event.startTime}–${event.endTime}`
  return event.startTime ?? event.endTime ?? ''
}
