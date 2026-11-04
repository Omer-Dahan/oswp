import { getInvitedAttendingSummary } from '~/lib/household-party-size'

type InvitedAttendingLineProps = {
  household: {
    invitedCount: number | null
    attendingCount: number | null
  }
  className?: string
}

/**
 * "מוזמן 3" / "מוזמן 3 · מגיע 2" line shown directly under a guest's name in
 * both the row and card views (owner's decision, 04.11.2026). Shows only
 * whichever figures are known, and nothing at all when both are empty.
 */
export function InvitedAttendingLine({
  household,
  className,
}: Readonly<InvitedAttendingLineProps>) {
  const { invited, attending, mismatch } = getInvitedAttendingSummary(household)

  if (invited == null && attending == null) return null

  return (
    <p className={className}>
      {invited != null && <span>מוזמן {invited}</span>}
      {invited != null && attending != null && ' · '}
      {attending != null && (
        <span
          title={mismatch ? `אישר ${attending} מתוך ${invited} שהוזמן` : undefined}
          className={mismatch ? 'rounded-full bg-primary/10 px-1.5 py-0.5 text-primary' : undefined}
        >
          מגיע {attending}
        </span>
      )}
    </p>
  )
}
