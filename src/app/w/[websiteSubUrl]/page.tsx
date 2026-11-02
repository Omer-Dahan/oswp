import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { resolveInvitedHousehold } from '~/app/w/[websiteSubUrl]/_lib/invited-household'
import { loadVisitorWedding } from '~/app/w/[websiteSubUrl]/_lib/load-visitor-wedding'
import { grantWebsiteAccess } from '~/app/w/[websiteSubUrl]/_lib/website-access'
import PasswordPage from '~/components/website/password-page'
import WeddingWebsite from '~/components/website/wedding'

type RootRouteHandlerProps = {
  params: Promise<{
    websiteSubUrl: string
  }>
  searchParams?: Promise<{
    invite?: string
  }>
}

const OG_IMAGE_VERSION = '3'

export async function generateMetadata({ params }: RootRouteHandlerProps): Promise<Metadata> {
  const { websiteSubUrl } = await params
  const { loadResult } = await loadVisitorWedding(websiteSubUrl)

  // Nested `icon.tsx` route conventions are silently dropped whenever an
  // ancestor layout (the root layout, here) sets `metadata.icons` explicitly —
  // Next.js then stops auto-merging file-based icons for the whole subtree.
  // Re-declaring `icons` at this segment reclaims it and points back at our
  // per-website favicon route.
  const iconUrl = `/w/${websiteSubUrl}/icon`

  if (loadResult.status !== 'ready') {
    return {
      title: 'Wedding Website',
      icons: [{ rel: 'icon', url: iconUrl, type: 'image/png', sizes: '32x32' }],
    }
  }

  const {
    brideFirstName,
    brideLastName,
    groomFirstName,
    groomLastName,
    website: { introText },
  } = loadResult.weddingData

  const brideName = brideFirstName && brideLastName ? `${brideFirstName} ${brideLastName}` : ''
  const groomName = groomFirstName && groomLastName ? `${groomFirstName} ${groomLastName}` : ''
  // The share card is read by guests, not by the couple: Hebrew only, the way
  // the invitation itself reads. English here surfaced in every WhatsApp preview.
  const title =
    brideName && groomName ? `החתונה של ${groomName} ו${brideName}` : 'הזמנה לחתונה'
  const description =
    introText || (groomName && brideName ? `נשמח לראותכם בחתונה של ${groomName} ו${brideName}` : '')

  const ogImageUrl = `/api/og/wedding/${websiteSubUrl}?v=${OG_IMAGE_VERSION}`

  return {
    title,
    description,
    icons: [{ rel: 'icon', url: iconUrl, type: 'image/png', sizes: '32x32' }],
    openGraph: {
      title,
      description,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default async function RootRouteHandler({ params, searchParams }: RootRouteHandlerProps) {
  const { websiteSubUrl } = await params
  const { loadResult } = await loadVisitorWedding(websiteSubUrl)

  // The household is recognised ONLY from the explicit invite parameter that
  // the personal link forwards here. Never from the cookie: the general link
  // (/w/guests) is shared with many guests, and reading the cookie made it
  // greet whoever opened a personal link last on that device (owner report,
  // 2026-11-02).
  const resolvedSearchParams = (await searchParams) ?? {}
  const inviteCode =
    typeof resolvedSearchParams.invite === 'string' && resolvedSearchParams.invite.trim()
      ? resolvedSearchParams.invite.trim()
      : undefined

  const verifyWebsitePassword = async (passwordInput: string) => {
    'use server'
    return grantWebsiteAccess(websiteSubUrl, passwordInput)
  }

  if (loadResult.status === 'not-found') return notFound()

  if (loadResult.status === 'password-required') {
    return (
      <main>
        <PasswordPage verifyWebsitePassword={verifyWebsitePassword} />
      </main>
    )
  }

  // The guest cleared the gate — greet them by name if we recognise their invite.
  const invitedHousehold = await resolveInvitedHousehold(websiteSubUrl, inviteCode)

  return (
    <main>
      <WeddingWebsite
        websiteSubUrl={websiteSubUrl}
        weddingData={loadResult.weddingData}
        invitedHousehold={invitedHousehold}
        inviteCode={inviteCode}
      />
    </main>
  )
}
