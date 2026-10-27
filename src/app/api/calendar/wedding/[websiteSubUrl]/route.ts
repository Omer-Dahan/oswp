import type { NextRequest } from 'next/server'

import { loadWeddingBySubUrl } from '~/app/w/[websiteSubUrl]/_lib/load-wedding-by-suburl'
import { buildEveningCalendarLinks } from '~/lib/website/calendar'
import { coupleNamesHe } from '~/lib/wedding/couple-name'

/**
 * The wedding evening as a real `.ics` URL.
 *
 * iOS Safari only offers "Add to Calendar" for a URL that actually serves
 * `text/calendar`; a blob download from the page just lands in Files. Android
 * guests use the Google Calendar link instead, so both audiences get a control
 * that does the right thing on their device.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ websiteSubUrl: string }> }
) {
  const { websiteSubUrl } = await params

  try {
    const loadResult = await loadWeddingBySubUrl(websiteSubUrl)
    if (loadResult.status !== 'ready') {
      return new Response('not found', { status: 404 })
    }

    const weddingData = loadResult.weddingData
    const requestedEventIds = new Set(request.nextUrl.searchParams.getAll('event'))
    const events =
      requestedEventIds.size > 0
        ? (weddingData.events ?? []).filter((event) => requestedEventIds.has(event.id))
        : (weddingData.events ?? [])
    const names = coupleNamesHe(weddingData)
    const title = names ? `החתונה של ${names}` : 'החתונה שלנו'
    const links = buildEveningCalendarLinks({
      title,
      events,
    })

    if (!links) return new Response('no dated events', { status: 404 })

    return new Response(links.ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="wedding.ics"',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new Response('calendar unavailable', { status: 500 })
  }
}
