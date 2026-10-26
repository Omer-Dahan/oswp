import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { householdInviteCookieName } from '~/lib/website/cookies'
import { householdInviteService } from '~/server/application/household-invite'
import { rsvpSubmissionService } from '~/server/application/rsvp-submission'

type HouseholdRsvpRouteProps = {
  params: Promise<{
    websiteSubUrl: string
  }>
}

const redirectTo = (path: string) =>
  new NextResponse(null, {
    status: 303,
    headers: { location: path, 'X-Robots-Tag': 'noindex, nofollow' },
  })

/**
 * One-click RSVP for a household recognised from its save-the-date invite
 * cookie: sets `Attending` on the chosen event for every guest the household
 * was invited to it with (`intent=attend`), or `Declined` on every invitation
 * the household holds (`intent=decline`). Reuses `rsvpSubmissionService`, the
 * same write path the multi-step RSVP form submits through, so the status
 * update, idempotency (an update keyed on `guestId`+`eventId`, not an insert)
 * and `submittedAt` stamping all match the form exactly.
 */
export async function POST(request: Request, { params }: HouseholdRsvpRouteProps) {
  const { websiteSubUrl } = await params
  const formData = await request.formData()
  const intent = formData.get('intent')
  const eventId = formData.get('eventId')

  const cookieStore = await cookies()
  const code = cookieStore.get(householdInviteCookieName(websiteSubUrl))?.value

  const household = await householdInviteService.getRecognizedRsvpHousehold(websiteSubUrl, code)
  if (!household) {
    return redirectTo(`/w/${websiteSubUrl}/save-the-date?invalid=1`)
  }

  if (intent === 'decline') {
    const rsvpResponses = household.guests.flatMap((guest) =>
      guest.invitations.map((invitation) => ({
        eventId: invitation.eventId,
        guestId: guest.id,
        rsvp: 'Declined' as const,
      }))
    )

    if (rsvpResponses.length > 0) {
      await rsvpSubmissionService.submitRsvp({ rsvpResponses, answersToQuestions: [] })
    }

    return redirectTo(`/w/${websiteSubUrl}/save-the-date?rsvp=declined`)
  }

  if (intent === 'attend' && typeof eventId === 'string' && eventId.length > 0) {
    const rsvpResponses = household.guests.flatMap((guest) =>
      guest.invitations
        .filter((invitation) => invitation.eventId === eventId)
        .map((invitation) => ({
          eventId: invitation.eventId,
          guestId: guest.id,
          rsvp: 'Attending' as const,
        }))
    )

    if (rsvpResponses.length > 0) {
      await rsvpSubmissionService.submitRsvp({ rsvpResponses, answersToQuestions: [] })
    }

    return redirectTo(`/w/${websiteSubUrl}/save-the-date?rsvp=attending&event=${eventId}`)
  }

  return new NextResponse(null, { status: 400 })
}
