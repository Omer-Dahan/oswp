/**
 * Tests for putServerBlob helper.
 *
 * putServerBlob dispatches to the active storage driver (here: the Vercel
 * Blob driver, selected because BLOB_READ_WRITE_TOKEN is set) which sniffs
 * the real bytes before uploading — the declared `contentType` argument is
 * advisory only.
 */

jest.mock('~/env', () => ({ env: { BLOB_READ_WRITE_TOKEN: 'test-token' } }))
jest.mock('@vercel/blob', () => ({ put: jest.fn(), del: jest.fn() }))

import { put } from '@vercel/blob'
import { putServerBlob } from '~/server/infrastructure/storage/blob-server'

const putMock = put as jest.MockedFunction<typeof put>

const PDF_BYTES = Buffer.from('%PDF-1.4\n%%EOF')

describe('putServerBlob', () => {
  beforeEach(() => {
    putMock.mockReset()
    putMock.mockResolvedValue({
      url: 'https://blob.example.com/foo-abc123.pdf',
      downloadUrl: 'https://blob.example.com/foo-abc123.pdf?download=1',
      pathname: 'foo-abc123.pdf',
      contentType: 'application/pdf',
      contentDisposition: 'inline',
    } as never)
  })

  it('uploads a real PDF body and maps the result from the sniffed type', async () => {
    const result = await putServerBlob({
      pathname: 'greetings/hello.pdf',
      body: PDF_BYTES,
      contentType: 'application/pdf',
    })

    expect(putMock).toHaveBeenCalledTimes(1)
    expect(putMock).toHaveBeenCalledWith('greetings/hello.pdf', PDF_BYTES, {
      access: 'public',
      token: 'test-token',
      contentType: 'application/pdf',
      addRandomSuffix: true,
    })
    expect(result).toEqual({
      url: 'https://blob.example.com/foo-abc123.pdf',
      pathname: 'foo-abc123.pdf',
      size: PDF_BYTES.length,
      contentType: 'application/pdf',
    })
  })

  it('uses Buffer.length for Buffer bodies', async () => {
    const result = await putServerBlob({
      pathname: 'x.pdf',
      body: PDF_BYTES,
      contentType: 'application/pdf',
    })

    expect(result.size).toBe(PDF_BYTES.length)
  })

  it('uses byteLength for ArrayBuffer bodies', async () => {
    const ab = Uint8Array.from(PDF_BYTES).buffer

    const result = await putServerBlob({
      pathname: 'x.pdf',
      body: ab,
      contentType: 'application/pdf',
    })

    expect(result.size).toBe(PDF_BYTES.length)
  })

  it('rejects a body whose bytes do not match an allowed type', async () => {
    await expect(
      putServerBlob({
        pathname: 'doc.pdf',
        body: Buffer.from('not actually a pdf'),
        contentType: 'application/pdf',
      })
    ).rejects.toThrow()
    expect(putMock).not.toHaveBeenCalled()
  })
})

describe('putServerBlob without token', () => {
  it('throws a clear error if BLOB_READ_WRITE_TOKEN is not configured', async () => {
    jest.resetModules()
    await jest.isolateModulesAsync(async () => {
      jest.doMock(
        '~/env',
        () => ({ env: { BLOB_READ_WRITE_TOKEN: undefined, STORAGE_DRIVER: 'blob' } }),
        { virtual: false }
      )
      jest.doMock('@vercel/blob', () => ({ put: jest.fn(), del: jest.fn() }))

      const mod = await import('~/server/infrastructure/storage/blob-server')

      await expect(
        mod.putServerBlob({
          pathname: 'x.pdf',
          body: PDF_BYTES,
          contentType: 'application/pdf',
        })
      ).rejects.toThrow('BLOB_READ_WRITE_TOKEN is not configured')
    })
  })
})
