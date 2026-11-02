import { NextResponse } from 'next/server'

import { householdInviteCookieName, householdInviteCookiePath } from '~/lib/website/cookies'
import { householdInviteService } from '~/server/application/household-invite'

type HouseholdInviteCodeRouteProps = {
  params: Promise<{
    websiteSubUrl: string
    code: string
  }>
}


export async function GET(_request: Request, { params }: HouseholdInviteCodeRouteProps) {
  const { websiteSubUrl, code } = await params
  const inviteData = await householdInviteService.getInviteData(websiteSubUrl, code)

  // The code travels in the URL, not in the cookie: the root page resolves the
  // household from this parameter only, so the general link (/w/guests) can
  // never inherit whoever opened a personal link last on the device.
  const path = inviteData
    ? `/w/${websiteSubUrl}?invite=${encodeURIComponent(code)}`
    : `/w/${websiteSubUrl}/save-the-date?invalid=1`

  const response = new NextResponse(null, {
    status: 307,
    headers: { location: path, 'X-Robots-Tag': 'noindex, nofollow' },
  })

  if (!inviteData) {
    return response
  }

  // Session cookie on purpose (owner decision, 2026-11-02): no maxAge, so the
  // recognition dies with the browser session instead of lingering until the
  // invitation expires. It still backs the one-click RSVP POST, which has no
  // code in its form.
  response.cookies.set(householdInviteCookieName(websiteSubUrl), code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: householdInviteCookiePath(websiteSubUrl),
  })

  return response
}
