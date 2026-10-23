import { deleteUploadedFiles, uploadFile } from '~/lib/upload-client'

export type BlobUploadResult = {
  url: string
  pathname: string
  name: string
  size: number
}

/**
 * Upload files via the server-mediated `/api/uploads` endpoint.
 *
 * Uploads run concurrently (Promise.allSettled) for better performance.
 * If any uploads fail, already-uploaded files are cleaned up to avoid orphans.
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
    if (fulfilled.length > 0) {
      await deleteUploadedFiles(fulfilled.map((r) => r.url))
    }
    throw new Error(`Failed to upload: ${failed.join(', ')}`)
  }

  return fulfilled
}
