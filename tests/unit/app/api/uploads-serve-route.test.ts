/**
 * @jest-environment node
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

describe('GET /api/uploads/[...path]', () => {
  let GET: (
    request: Request,
    context: { params: Promise<{ path: string[] }> }
  ) => Promise<Response>
  let uploadsDir: string

  beforeAll(async () => {
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oswp-uploads-'))
    process.env.UPLOADS_DIR = uploadsDir
    jest.resetModules()
    const mod = await import('~/app/api/uploads/[...path]/route')
    GET = mod.GET
  })

  afterAll(async () => {
    delete process.env.UPLOADS_DIR
    await fs.rm(uploadsDir, { recursive: true, force: true })
  })

  it('serves a PNG with the sniffed content type and an inline disposition', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    await fs.writeFile(path.join(uploadsDir, 'abc.png'), png)

    const response = await GET(new Request('http://localhost/api/uploads/abc.png'), {
      params: Promise.resolve({ path: ['abc.png'] }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Content-Disposition')).toBe('inline')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
  })

  it('serves a PDF with an attachment disposition, ignoring the .pdf-lookalike extension trick', async () => {
    await fs.writeFile(path.join(uploadsDir, 'doc.pdf'), Buffer.from('%PDF-1.4\n%%EOF'))

    const response = await GET(new Request('http://localhost/api/uploads/doc.pdf'), {
      params: Promise.resolve({ path: ['doc.pdf'] }),
    })

    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toBe('attachment')
  })

  it('returns 404, not the file, when stored bytes are not an allowed type', async () => {
    await fs.writeFile(path.join(uploadsDir, 'fake.png'), Buffer.from('<html>not actually a png</html>'))

    const response = await GET(new Request('http://localhost/api/uploads/fake.png'), {
      params: Promise.resolve({ path: ['fake.png'] }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 for a path traversal attempt', async () => {
    const response = await GET(new Request('http://localhost/api/uploads/etc/passwd'), {
      params: Promise.resolve({ path: ['..', '..', 'etc', 'passwd'] }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 for a missing file', async () => {
    const response = await GET(new Request('http://localhost/api/uploads/missing.png'), {
      params: Promise.resolve({ path: ['missing.png'] }),
    })

    expect(response.status).toBe(404)
  })
})
