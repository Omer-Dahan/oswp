/**
 * Shared upload configuration
 *
 * Single source of truth for file upload constraints used by both
 * client-side dropzone validation and server-side upload handling.
 */

/**
 * Maximum file size in bytes (10 MB).
 *
 * Matches `MAX_UPLOAD_BYTES` enforced server-side in
 * `~/server/infrastructure/storage/validate-upload`.
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/** Maximum number of files per quote */
export const MAX_FILES_PER_QUOTE = 10

/** Maximum number of images per vendor */
export const MAX_IMAGES_PER_VENDOR = 5

/**
 * MIME types allowed for upload.
 *
 * Narrowed to what the server can actually verify by magic bytes (see
 * `~/server/infrastructure/storage/magic-bytes`) — anything else, including
 * SVG or other HTML/text-bearing types, is rejected before it's written.
 */
export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/** Dropzone `accept` map — keys are MIME types, values are file extensions */
export const DROPZONE_ACCEPT: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

/** Human-readable list of accepted file types for display in the UI */
export const ACCEPTED_TYPES_LABEL = 'PDF, JPG, PNG, or WebP files'

/** Vercel Blob storage URL pattern for validating file URLs */
export const BLOB_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//

/** Local storage driver URL pattern — root-relative, served by `/api/uploads/[...path]` */
export const LOCAL_UPLOAD_URL_PATTERN = /^\/api\/uploads\/[A-Za-z0-9._-]+$/

/** S3 storage driver URL pattern */
export const S3_URL_PATTERN = /^https:\/\/[a-z0-9.-]+\.s3\.[a-z0-9-]+\.amazonaws\.com\//

/** Validates a stored file URL against whichever storage driver produced it. */
export function isValidUploadUrl(url: string): boolean {
  return (
    BLOB_URL_PATTERN.test(url) || LOCAL_UPLOAD_URL_PATTERN.test(url) || S3_URL_PATTERN.test(url)
  )
}

/**
 * Sanitize a filename by removing path traversal sequences and
 * replacing characters that are unsafe for storage keys.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/\.\./g, '') // strip path traversal
    .replace(/[/\\]/g, '') // strip path separators
    .replace(/\p{Cc}/gu, '') // strip control characters
    .trim()
}
