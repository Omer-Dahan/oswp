/**
 * Server-only upload helper. Dispatches to whichever storage driver is
 * selected (`STORAGE_DRIVER`), so callers don't have to know whether files
 * land on local disk, Vercel Blob, or S3.
 */

import { getStorageDriver } from '~/server/infrastructure/storage/driver-factory'

export interface PutServerBlobArgs {
  pathname: string
  body: ArrayBuffer | Buffer | Uint8Array
  contentType: string
}

export interface PutServerBlobResult {
  url: string
  pathname: string
  size: number
  contentType: string
}

function toBuffer(body: ArrayBuffer | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(body)) return body
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  return Buffer.from(body.buffer, body.byteOffset, body.byteLength)
}

export async function putServerBlob(args: PutServerBlobArgs): Promise<PutServerBlobResult> {
  const driver = getStorageDriver()
  return driver.put({
    buffer: toBuffer(args.body),
    declaredContentType: args.contentType,
    pathnameHint: args.pathname,
  })
}
