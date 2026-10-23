/**
 * Serves files written by the local storage driver.
 *
 * The path is resolved and compared against the uploads directory prefix to
 * reject traversal, and the response Content-Type comes only from sniffing
 * the stored bytes — never from the request or the filename extension — so a
 * file can't be served as something it isn't.
 */

import { readFile, stat } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { resolveUploadPath } from '~/server/infrastructure/storage/local-driver'
import { sniffType } from '~/server/infrastructure/storage/magic-bytes'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path: segments } = await params

  if (!segments || segments.length !== 1) {
    return new NextResponse(null, { status: 404 })
  }

  const filePath = resolveUploadPath(segments[0] as string)
  if (!filePath) {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const stats = await stat(filePath)
    if (!stats.isFile()) {
      return new NextResponse(null, { status: 404 })
    }
  } catch {
    return new NextResponse(null, { status: 404 })
  }

  const buffer = await readFile(filePath)
  const contentType = sniffType(buffer)
  if (!contentType) {
    return new NextResponse(null, { status: 404 })
  }

  const disposition = contentType === 'application/pdf' ? 'attachment' : 'inline'

  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': disposition,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
