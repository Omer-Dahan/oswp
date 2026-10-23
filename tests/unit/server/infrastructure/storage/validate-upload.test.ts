/**
 * @jest-environment node
 */

import sharp from 'sharp'
import {
  MAX_UPLOAD_BYTES,
  UploadValidationError,
  validateUpload,
} from '~/server/infrastructure/storage/validate-upload'

describe('validateUpload', () => {
  it('accepts a real PNG', async () => {
    const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } })
      .png()
      .toBuffer()
    await expect(validateUpload(buffer)).resolves.toBe('image/png')
  })

  it('accepts a real JPEG', async () => {
    const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'blue' } })
      .jpeg()
      .toBuffer()
    await expect(validateUpload(buffer)).resolves.toBe('image/jpeg')
  })

  it('accepts a real WebP', async () => {
    const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'green' } })
      .webp()
      .toBuffer()
    await expect(validateUpload(buffer)).resolves.toBe('image/webp')
  })

  it('accepts a PDF', async () => {
    const buffer = Buffer.from('%PDF-1.4\n%%EOF')
    await expect(validateUpload(buffer)).resolves.toBe('application/pdf')
  })

  it('rejects SVG even with an image/* declared type', async () => {
    const buffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    await expect(validateUpload(buffer)).rejects.toThrow(UploadValidationError)
  })

  it('rejects HTML', async () => {
    const buffer = Buffer.from('<html><body>hi</body></html>')
    await expect(validateUpload(buffer)).rejects.toThrow(UploadValidationError)
  })

  it('rejects a Windows executable', async () => {
    const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00])
    await expect(validateUpload(buffer)).rejects.toThrow(UploadValidationError)
  })

  it('rejects files over the size limit', async () => {
    const buffer = Buffer.alloc(MAX_UPLOAD_BYTES + 1)
    await expect(validateUpload(buffer)).rejects.toThrow(UploadValidationError)
  })

  it('rejects an empty file', async () => {
    await expect(validateUpload(Buffer.alloc(0))).rejects.toThrow(UploadValidationError)
  })
})
