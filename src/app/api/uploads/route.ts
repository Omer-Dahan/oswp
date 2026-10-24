/**
 * Authenticated upload endpoint, driver-agnostic.
 *
 * Replaces the previous Vercel-Blob-specific client-direct-upload flow:
 * the file now always passes through the server, where it's sniffed and
 * validated (`validateUpload`) before the active storage driver writes it.
 * This is required for the local disk driver (there's no public bucket to
 * upload straight to) and gives every driver the same validation.
 *
 * There is intentionally no DELETE handler here: deleting a file requires
 * knowing which wedding owns it, which this endpoint has no way to check.
 * Every deletion path in the app goes through a domain service instead
 * (e.g. vendor.service.ts), which verifies ownership before calling the
 * storage driver directly.
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
