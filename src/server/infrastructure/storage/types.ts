/**
 * Storage driver abstraction.
 *
 * All drivers accept already-read bytes (never a client-supplied filename or
 * path) and decide the stored filename/key themselves, so callers can never
 * influence where a file lands on disk or in the bucket.
 */

export interface StorageObject {
  url: string
  pathname: string
  size: number
  contentType: string
}

export interface StoragePutInput {
  buffer: Buffer
  /** Advisory only — drivers must sniff the real type from magic bytes. */
  declaredContentType?: string
  /** Advisory grouping hint (e.g. blob driver key prefix). Ignored by the local driver. */
  pathnameHint?: string
}

export interface StorageDriver {
  put(input: StoragePutInput): Promise<StorageObject>
  /** Accepts either a stored pathname or the full URL previously returned by `put`. */
  del(pathnamesOrUrls: string[]): Promise<void>
}
