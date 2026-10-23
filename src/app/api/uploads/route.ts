/**
 * Authenticated upload endpoint, driver-agnostic.
 *
 * Replaces the previous Vercel-Blob-specific client-direct-upload flow:
 * the file now always passes through the server, where it's sniffed and
 * validated (`validateUpload`) before the active storage driver writes it.
 * This is required for the local disk driver (there's no public bucket to
 * upload straight to) and gives every driver the same validation.
 */

import { NextResponse } from 'next/server'
import { auth } from '~/lib/auth'
import { getStorageDriver, UploadValidationError } from '~/server/infrastructure/storage'

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await getStorageDriver().put({ buffer, declaredContentType: file.type })
    return NextResponse.json({ ...result, name: file.name })
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { urls?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.urls) || !body.urls.every((u): u is string => typeof u === 'string')) {
    return NextResponse.json({ error: 'urls must be an array of strings' }, { status: 400 })
  }

  try {
    await getStorageDriver().del(body.urls)
  } catch {
    // Best-effort cleanup — orphaned files are preferable to crashing here.
  }

  return NextResponse.json({ ok: true })
}
