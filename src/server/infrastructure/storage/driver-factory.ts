/**
 * Selects the active storage driver from `STORAGE_DRIVER`, defaulting to
 * 'blob' when a Vercel Blob token is configured and 'local' otherwise (the
 * self-hosted case with no cloud credentials).
 */

import { env } from '~/env'
import { blobDriver } from '~/server/infrastructure/storage/blob-driver'
import { localDriver } from '~/server/infrastructure/storage/local-driver'
import type { StorageDriver } from '~/server/infrastructure/storage/types'

export type StorageDriverName = 'local' | 'blob' | 's3'

function resolveDriverName(): StorageDriverName {
  if (env.STORAGE_DRIVER) return env.STORAGE_DRIVER
  if (env.BLOB_READ_WRITE_TOKEN) return 'blob'
  return 'local'
}

let s3DriverPromise: Promise<StorageDriver> | null = null

async function loadS3Driver(): Promise<StorageDriver> {
  // Loaded lazily — @aws-sdk/client-s3 is ESM-heavy and only needed when
  // STORAGE_DRIVER=s3 is actually selected.
  s3DriverPromise ??= import('~/server/infrastructure/storage/s3-driver').then((m) => m.s3Driver)
  return s3DriverPromise
}

export function getStorageDriver(): StorageDriver {
  const name = resolveDriverName()
  if (name === 'blob') return blobDriver
  if (name === 's3') {
    return {
      put: async (input) => (await loadS3Driver()).put(input),
      del: async (pathnamesOrUrls) => (await loadS3Driver()).del(pathnamesOrUrls),
    }
  }
  return localDriver
}
