/**
 * Local-disk storage driver for self-hosted deployments with no cloud
 * storage credentials. Files are written outside `public/` and `.next/`
 * under a UUID name derived from the sniffed type, and served back through
 * `/api/uploads/[...path]`.
 */

import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '~/env'
import { EXTENSION_BY_TYPE } from '~/server/infrastructure/storage/magic-bytes'
import type { StorageDriver } from '~/server/infrastructure/storage/types'
import { validateUpload } from '~/server/infrastructure/storage/validate-upload'

export const UPLOADS_DIR = path.resolve(env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads'))

let ensureDirPromise: Promise<void> | null = null

export async function ensureUploadsDir(): Promise<void> {
  ensureDirPromise ??= mkdir(UPLOADS_DIR, { recursive: true, mode: 0o750 }).then(() => undefined)
  await ensureDirPromise
}

/** Resolves a stored filename to an absolute path, rejecting anything that escapes `UPLOADS_DIR`. */
export function resolveUploadPath(filename: string): string | null {
  const resolved = path.resolve(UPLOADS_DIR, filename)
  if (resolved !== UPLOADS_DIR && !resolved.startsWith(UPLOADS_DIR + path.sep)) {
    return null
  }
  return resolved
}

const UPLOAD_URL_PREFIX = '/api/uploads/'

function extractFilename(pathnameOrUrl: string): string {
  const idx = pathnameOrUrl.indexOf(UPLOAD_URL_PREFIX)
  return idx === -1 ? pathnameOrUrl : pathnameOrUrl.slice(idx + UPLOAD_URL_PREFIX.length)
}

export const localDriver: StorageDriver = {
  async put({ buffer }) {
    const contentType = await validateUpload(buffer)
    await ensureUploadsDir()

    const filename = `${randomUUID()}${EXTENSION_BY_TYPE[contentType]}`
    const filePath = resolveUploadPath(filename)
    if (!filePath) {
      throw new Error('Generated upload path escaped the uploads directory')
    }
    await writeFile(filePath, buffer, { mode: 0o640 })

    return {
      url: `${UPLOAD_URL_PREFIX}${filename}`,
      pathname: filename,
      size: buffer.length,
      contentType,
    }
  },

  async del(pathnamesOrUrls) {
    await Promise.all(
      pathnamesOrUrls.map(async (value) => {
        const filePath = resolveUploadPath(extractFilename(value))
        if (!filePath) return
        try {
          await unlink(filePath)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      })
    )
  },
}
