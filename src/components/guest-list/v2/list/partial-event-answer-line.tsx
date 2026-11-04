import { getPartialEventAnswerLine, type RsvpEventInput } from '~/lib/wedding/rsvp-events'

type PartialEventAnswerLineProps = {
  guests: Array<{ invitations: Array<{ eventId: string; rsvp: string }> }>
  events: RsvpEventInput[]
  className?: string
}

/**
 * "מגיע לחופה · החתונה טרם השיבה" - the owner's disambiguating line
 * (04.11.2026), shown directly under the invited/attending line only when
 * the household's answers differ across the wedding's two RSVP-able
 * events. Renders nothing when the answers agree or can't be compared.
 */
export function PartialEventAnswerLine({
  guests,
  events,
  className,
}: Readonly<PartialEventAnswerLineProps>) {
  const line = getPartialEventAnswerLine(guests, events)
  if (line === null) return null

  return <p className={className}>{line}</p>
}
