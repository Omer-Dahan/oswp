/**
 * @jest-environment node
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

describe('resolveUploadPath', () => {
  let resolveUploadPath: (
    filename: string
  ) => string | null
  let uploadsDir: string

  beforeAll(async () => {
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oswp-uploads-'))
    process.env.UPLOADS_DIR = uploadsDir
    jest.resetModules()
    const mod = await import('~/server/infrastructure/storage/local-driver')
    resolveUploadPath = mod.resolveUploadPath
  })

  afterAll(async () => {
    delete process.env.UPLOADS_DIR
    await fs.rm(uploadsDir, { recursive: true, force: true })
  })

  it('resolves a plain filename inside the uploads dir', () => {
    expect(resolveUploadPath('abc123.png')).toBe(path.join(uploadsDir, 'abc123.png'))
  })

  it.each([
    '../etc/passwd',
    '../../etc/passwd',
    '../../../../etc/shadow',
    '/etc/passwd',
    '..',
  ])('rejects the path traversal attempt %s', (attempt) => {
    expect(resolveUploadPath(attempt)).toBeNull()
  })
})
