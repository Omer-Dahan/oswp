import { uploadFile } from '~/lib/upload-client'

export type BlobUploadResult = {
  url: string
  pathname: string
  name: string
  size: number
}

/**
 * Upload files via the server-mediated `/api/uploads` endpoint.
 *
 * Uploads run concurrently (Promise.allSettled) for better performance. If
 * any upload fails, the ones that succeeded are left in storage rather than
 * deleted: there is no unauthenticated/unscoped delete endpoint to call them
 * back through (see `/api/uploads` route), and these files aren't persisted
 * to any DB row yet, so they're harmless, orphaned blobs rather than a
 * security exposure.
 */
export async function uploadFiles(files: File[]): Promise<BlobUploadResult[]> {
  if (files.length === 0) return []

  const results = await Promise.allSettled(files.map(uploadFile))

  const fulfilled: BlobUploadResult[] = []
  const failed: string[] = []

  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      fulfilled.push(result.value)
    } else {
      failed.push(files[i]?.name ?? 'unknown')
    }
  }

  if (failed.length > 0) {
    throw new Error(`Failed to upload: ${failed.join(', ')}`)
  }

  return fulfilled
}
