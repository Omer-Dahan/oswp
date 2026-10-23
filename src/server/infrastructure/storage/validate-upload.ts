/**
 * Shared server-side upload validation, applied before any driver writes a
 * byte to disk or sends one over the network.
 */

import sharp from 'sharp'
import { env } from '~/env'
import { sniffType, type SniffedType } from '~/server/infrastructure/storage/magic-bytes'

export const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024

/** Decompression-bomb guard: reject images whose decoded pixel count is too high. */
const MAX_IMAGE_PIXELS = 40_000_000

export class UploadValidationError extends Error {}

export async function validateUpload(buffer: Buffer): Promise<SniffedType> {
  if (buffer.length === 0) {
    throw new UploadValidationError('Empty file')
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError('File exceeds the maximum allowed size')
  }

  const type = sniffType(buffer)
  if (!type) {
    throw new UploadValidationError('Unsupported file type')
  }

  if (type !== 'application/pdf') {
    let metadata: sharp.Metadata
    try {
      metadata = await sharp(buffer).metadata()
    } catch {
      throw new UploadValidationError('Image data could not be decoded')
    }
    const { width, height } = metadata
    if (!width || !height) {
      throw new UploadValidationError('Image data could not be decoded')
    }
    if (width * height > MAX_IMAGE_PIXELS) {
      throw new UploadValidationError('Image resolution exceeds the maximum allowed')
    }
  }

  return type
}
