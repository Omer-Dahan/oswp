import * as dns from 'node:dns/promises'
import { NextResponse } from 'next/server'
import { Agent } from 'undici'

import { auth } from '~/lib/auth'
import { MAX_FILE_SIZE } from '~/lib/upload-config'
import { resolveWorkspaceScope } from '~/server/application/workspace/workspace-scope'
import { vendorRepository } from '~/server/domains/vendor'
import { putServerBlob } from '~/server/infrastructure/storage/blob-server'

const FETCH_TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 5
const USER_AGENT = 'Mozilla/5.0 (compatible; OSWP/1.0)'

type ResolvedAddress = { address: string; family: number }

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { url?: string; vendorId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { url, vendorId } = body
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  if (!vendorId || typeof vendorId !== 'string') {
    return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
  }

  const { activeWeddingId } = await resolveWorkspaceScope({ session, userId: session.user.id })
  const vendorBelongsToCaller =
    !!activeWeddingId && (await vendorRepository.belongsToWedding(vendorId, activeWeddingId))
  if (!vendorBelongsToCaller) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const fetched = await safeFetchImage(parsedUrl)
    if (!fetched) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 422 })
    }

    const { buffer, contentType, finalUrl } = fetched
    const rawName = finalUrl.pathname.split('/').pop() ?? 'image'
    const name = rawName.includes('.') ? rawName : `${rawName}.jpg`

    const result = await putServerBlob({
      pathname: `vendor-images/${vendorId}/${name}`,
      body: buffer,
      contentType,
    })

    return NextResponse.json({
      url: result.url,
      key: result.pathname,
      size: buffer.byteLength,
      name,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 })
  }
}

/**
 * Fetch an image the way a browser would, but refuse to let a vendor-supplied
 * URL make the server talk to itself or the cloud metadata endpoint: every hop
 * (including redirects) is DNS-resolved up front, rejected if it lands on a
 * private/loopback/link-local address, and the connection is pinned to the
 * resolved IP so a DNS answer can't change between the check and the request
 * (rebinding). The body is read in capped chunks instead of being buffered in
 * full, so an oversized response is abandoned instead of exhausting memory.
 */
async function safeFetchImage(
  url: URL
): Promise<{ buffer: Buffer; contentType: string; finalUrl: URL } | null> {
  let currentUrl = url

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    if (!['http:', 'https:'].includes(currentUrl.protocol)) return null

    const addresses = await resolveSafeAddresses(currentUrl.hostname)
    if (!addresses) return null

    const dispatcher = createPinnedDispatcher(addresses)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(currentUrl.href, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual',
        signal: controller.signal,
        dispatcher,
      } as RequestInit & { dispatcher: Agent })

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        if (!location || redirectCount === MAX_REDIRECTS) return null
        const redirectUrl = safeResolveUrl(location, currentUrl.href)
        if (!redirectUrl) return null
        currentUrl = redirectUrl
        continue
      }

      if (!response.ok) return null

      const contentType = response.headers.get('content-type') ?? 'image/jpeg'
      if (!contentType.startsWith('image/')) return null

      const buffer = await readBoundedResponseBody(response)
      if (buffer === null) return null

      return { buffer, contentType, finalUrl: currentUrl }
    } finally {
      clearTimeout(timeoutId)
      await dispatcher.close().catch(() => undefined)
    }
  }

  return null
}

function safeResolveUrl(location: string, base: string): URL | null {
  try {
    const resolved = new URL(location, base)
    return ['http:', 'https:'].includes(resolved.protocol) ? resolved : null
  } catch {
    return null
  }
}

async function resolveSafeAddresses(hostname: string): Promise<ResolvedAddress[] | null> {
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true })
    const addresses = Array.isArray(results) ? results : [results]
    if (addresses.length === 0) return null
    if (addresses.some((result) => isPrivateOrLocalAddress(result.address))) return null
    return addresses
  } catch {
    return null
  }
}

function createPinnedDispatcher(addresses: ResolvedAddress[]): Agent {
  const [firstAddress] = addresses
  if (!firstAddress) throw new Error('No resolved address available')

  return new Agent({
    connect: {
      lookup(_hostname, options, callback) {
        if (options.all) {
          callback(null, addresses)
          return
        }
        callback(null, firstAddress.address, firstAddress.family)
      },
    },
  })
}

async function readBoundedResponseBody(response: Response): Promise<Buffer | null> {
  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer()
    return arrayBuffer.byteLength > MAX_FILE_SIZE ? null : Buffer.from(arrayBuffer)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytesRead = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      bytesRead += value.byteLength
      if (bytesRead > MAX_FILE_SIZE) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  } finally {
    reader.releaseLock()
  }
}

function isPrivateOrLocalAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === 'localhost' || normalized === '0.0.0.0') return true
  return isPrivateIpv4(normalized) || isPrivateIpv6(normalized)
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4) return false

  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) return Number.NaN
    const octet = Number(part)
    return octet >= 0 && octet <= 255 ? octet : Number.NaN
  })
  if (octets.some((octet) => Number.isNaN(octet))) return false

  const [first, second] = octets
  if (first === undefined || second === undefined) return false

  if (first === 10 || first === 127 || first === 0) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  // Covers the cloud metadata endpoint (169.254.169.254) along with the rest
  // of the link-local range.
  if (first === 169 && second === 254) return true

  return false
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  const mappedIpv4 = getIpv4MappedAddress(normalized)
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4)

  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  )
}

function getIpv4MappedAddress(hostname: string): string | null {
  const dottedMatch = hostname.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dottedMatch?.[1]) return dottedMatch[1]

  const hexMatch = hostname.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  const highHex = hexMatch?.[1]
  const lowHex = hexMatch?.[2]
  if (!highHex || !lowHex) return null

  const high = parseInt(highHex, 16)
  const low = parseInt(lowHex, 16)
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null

  return [high >> 8, high & 255, low >> 8, low & 255].join('.')
}
