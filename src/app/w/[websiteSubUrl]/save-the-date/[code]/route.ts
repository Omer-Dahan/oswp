import { NextResponse } from 'next/server'

import { householdInviteCookieName, householdInviteCookiePath } from '~/lib/website/cookies'
import { householdInviteService } from '~/server/application/household-invite'

type HouseholdInviteCodeRouteProps = {
  params: Promise<{
    websiteSubUrl: string
    code: string
  }>
}

const getInviteCookieMaxAge = (expiresAt: Date) =>
  Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))

export async function GET(_request: Request, { params }: HouseholdInviteCodeRouteProps) {
  const { websiteSubUrl, code } = await params
  const inviteData = await householdInviteService.getInviteData(websiteSubUrl, code)

  const path = inviteData
    ? `/w/${websiteSubUrl}`
    : `/w/${websiteSubUrl}/save-the-date?invalid=1`

  const response = new NextResponse(null, {
    status: 307,
    headers: { location: path, 'X-Robots-Tag': 'noindex, nofollow' },
  })

  if (!inviteData) {
    return response
  }

  response.cookies.set(householdInviteCookieName(websiteSubUrl), code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: householdInviteCookiePath(websiteSubUrl),
    maxAge: getInviteCookieMaxAge(inviteData.expiresAt),
  })

  return response
}
