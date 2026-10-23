/**
 * Client-side helper for the driver-agnostic upload endpoint.
 *
 * Replaces direct `@vercel/blob/client` calls — uploads always go through
 * `/api/uploads` so the server can sniff and validate bytes before the
 * active storage driver (local disk, Vercel Blob, or S3) writes them.
 */

export type UploadResult = {
  url: string
  pathname: string
  name: string
  size: number
  contentType: string
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/uploads', { method: 'POST', body: formData })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Upload failed')
  }

  const result = (await response.json()) as Omit<UploadResult, 'name'>
  return { ...result, name: file.name }
}

export async function deleteUploadedFiles(urls: string[]): Promise<void> {
  if (urls.length === 0) return
  try {
    await fetch('/api/uploads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    })
  } catch {
    // Best-effort cleanup — orphaned files are preferable to crashing here.
  }
}
