import path from 'node:path'

import type { NextRequest } from 'next/server'
import sharp from 'sharp'

import { loadWeddingBySubUrl } from '~/app/w/[websiteSubUrl]/_lib/load-wedding-by-suburl'

const DEFAULT_OG_IMAGE_WIDTH = 1200
const DEFAULT_OG_IMAGE_HEIGHT = 630

/** The invitation artwork doubles as the default share card. */
const DEFAULT_OG_ARTWORK_PATH = path.join(process.cwd(), 'public', 'brand', 'invitation-v2.png')

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case "'":
        return '&apos;'
      case '"':
        return '&quot;'
      default:
        return c
    }
  })
}

function createTextOverlaySvg(headline: string, accent: string): string {
  const escapedHeadline = escapeXml(headline)
  const escapedAccent = escapeXml(accent)

  return `<svg width="${DEFAULT_OG_IMAGE_WIDTH}" height="${DEFAULT_OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DEFAULT_OG_IMAGE_WIDTH} ${DEFAULT_OG_IMAGE_HEIGHT}">
    <defs>
      <filter id="textShadow">
        <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.5"/>
      </filter>
    </defs>
    <rect width="${DEFAULT_OG_IMAGE_WIDTH}" height="${DEFAULT_OG_IMAGE_HEIGHT}" fill="rgba(0,0,0,0.4)"/>
    <text
      x="${DEFAULT_OG_IMAGE_WIDTH / 2}"
      y="280"
      font-family="Georgia, serif"
      font-size="72"
      font-weight="bold"
      fill="white"
      text-anchor="middle"
      filter="url(#textShadow)"
    >${escapedHeadline}</text>
    <text
      x="${DEFAULT_OG_IMAGE_WIDTH / 2}"
      y="380"
      font-family="Georgia, serif"
      font-size="72"
      font-weight="bold"
      fill="white"
      text-anchor="middle"
      filter="url(#textShadow)"
    >${escapedAccent}</text>
  </svg>`
}

async function generateWeddingOgImage(
  headerImageUrl: string | null,
  headline?: string,
  accent?: string
): Promise<Buffer> {
  let baseImage: Buffer | null = null
  let usedHeaderImage = false

  if (headerImageUrl) {
    try {
      const response = await fetch(headerImageUrl, { signal: AbortSignal.timeout(5000) })
      if (response.ok) {
        const buffer = await response.arrayBuffer()
        baseImage = await sharp(buffer)
          .resize(DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT, {
            fit: 'cover',
            position: 'center',
          })
          .toBuffer()
        usedHeaderImage = true
      }
    } catch {
      // If image fetch fails, use default
    }
  }

  if (!baseImage) {
    // Share card defaults to the invitation artwork itself — letterboxed on the
    // parchment tone — so a WhatsApp/Facebook preview looks like the invitation
    // it links to instead of an empty grey card.
    baseImage = await sharp(DEFAULT_OG_ARTWORK_PATH)
      .resize(DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT, {
        fit: 'contain',
        background: { r: 246, g: 242, b: 233 },
      })
      .png()
      .toBuffer()
  }

  // Overlay text only on a header photo: the artwork already carries the names
  // and date, and the SVG overlay cannot render Hebrew (no font in sharp).
  if (usedHeaderImage && (headline || accent)) {
    const textSvg = createTextOverlaySvg(headline || '', accent || '')
    const textBuffer = Buffer.from(textSvg)
    // Convert SVG to PNG first
    const textPng = await sharp(textBuffer, { density: 150 }).png().toBuffer()

    const composited = await sharp(baseImage)
      .composite([
        {
          input: textPng,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer()
    return composited
  }

  return await sharp(baseImage).png().toBuffer()
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ websiteSubUrl: string }> }
) {
  try {
    const { websiteSubUrl } = await params

    // The share card must never depend on the page load succeeding: a guest
    // pasting the link into WhatsApp has to see the invitation artwork even if
    // the wedding lookup fails.
    try {
      const loadResult = await loadWeddingBySubUrl(websiteSubUrl)

      let headerImageUrl: string | null = null
      let headline: string | undefined
      let accent: string | undefined

      if (loadResult.status === 'ready') {
        headerImageUrl = loadResult.weddingData.website.headerImageUrl
        headline = loadResult.weddingData.website.headline
        accent = loadResult.weddingData.website.headlineAccent
      }

      const buffer = await generateWeddingOgImage(headerImageUrl, headline, accent)

      return new Response(new Blob([new Uint8Array(buffer)], { type: 'image/png' }), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'CDN-Cache-Control': 'max-age=86400',
        },
      })
    } catch (error) {
      console.warn('[og] wedding lookup failed, serving the artwork card', error)
      const buffer = await generateWeddingOgImage(null)
      return new Response(new Blob([new Uint8Array(buffer)], { type: 'image/png' }), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300',
        },
      })
    }
  } catch (error) {
    console.error('[og] failed to build the share image', error)
    // Return a basic image on error
    const errorImageBuffer = await sharp({
      create: {
        width: DEFAULT_OG_IMAGE_WIDTH,
        height: DEFAULT_OG_IMAGE_HEIGHT,
        channels: 3,
        background: { r: 200, g: 200, b: 200 },
      },
    })
      .png()
      .toBuffer()

    return new Response(new Blob([new Uint8Array(errorImageBuffer)], { type: 'image/png' }), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
      },
    })
  }
}
