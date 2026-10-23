/**
 * Vercel Blob storage driver.
 */

import { randomUUID } from 'node:crypto'
import { del, put } from '@vercel/blob'
import { env } from '~/env'
import type { StorageDriver } from '~/server/infrastructure/storage/types'
import { validateUpload } from '~/server/infrastructure/storage/validate-upload'

export const blobDriver: StorageDriver = {
  async put({ buffer, pathnameHint }) {
    const token = env.BLOB_READ_WRITE_TOKEN
    if (!token) {
      throw new Error('BLOB_READ_WRITE_TOKEN is not configured')
    }

    const contentType = await validateUpload(buffer)
    const pathname = pathnameHint ?? `uploads/${randomUUID()}`

    const result = await put(pathname, buffer, {
      access: 'public',
      token,
      contentType,
      addRandomSuffix: true,
    })

    return {
      url: result.url,
      pathname: result.pathname,
      size: buffer.length,
      contentType,
    }
  },

  async del(pathnamesOrUrls) {
    await del(pathnamesOrUrls)
  },
}
