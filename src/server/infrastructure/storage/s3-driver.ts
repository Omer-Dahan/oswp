/**
 * AWS S3 storage driver.
 */

import { randomUUID } from 'node:crypto'
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '~/env'
import { EXTENSION_BY_TYPE } from '~/server/infrastructure/storage/magic-bytes'
import type { StorageDriver } from '~/server/infrastructure/storage/types'
import { validateUpload } from '~/server/infrastructure/storage/validate-upload'

function getConfig() {
  const { AWS_S3_BUCKET_NAME, AWS_S3_REGION, AWS_S3_ACCESS_KEY_ID, AWS_S3_SECRET_ACCESS_KEY } = env
  if (!AWS_S3_BUCKET_NAME || !AWS_S3_REGION || !AWS_S3_ACCESS_KEY_ID || !AWS_S3_SECRET_ACCESS_KEY) {
    throw new Error('AWS_S3_* environment variables are not fully configured')
  }
  return {
    bucket: AWS_S3_BUCKET_NAME,
    region: AWS_S3_REGION,
    accessKeyId: AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: AWS_S3_SECRET_ACCESS_KEY,
  }
}

function getClient(): S3Client {
  const { region, accessKeyId, secretAccessKey } = getConfig()
  return new S3Client({ region, credentials: { accessKeyId, secretAccessKey } })
}

function extractKey(pathnameOrUrl: string, bucket: string, region: string): string {
  const prefix = `https://${bucket}.s3.${region}.amazonaws.com/`
  return pathnameOrUrl.startsWith(prefix) ? pathnameOrUrl.slice(prefix.length) : pathnameOrUrl
}

export const s3Driver: StorageDriver = {
  async put({ buffer, pathnameHint }) {
    const { bucket, region } = getConfig()
    const contentType = await validateUpload(buffer)
    const key = pathnameHint ?? `uploads/${randomUUID()}${EXTENSION_BY_TYPE[contentType]}`

    const client = getClient()
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    )

    return {
      url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
      pathname: key,
      size: buffer.length,
      contentType,
    }
  },

  async del(pathnamesOrUrls) {
    if (pathnamesOrUrls.length === 0) return
    const { bucket, region } = getConfig()
    const client = getClient()
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: pathnamesOrUrls.map((value) => ({ Key: extractKey(value, bucket, region) })),
        },
      })
    )
  },
}
