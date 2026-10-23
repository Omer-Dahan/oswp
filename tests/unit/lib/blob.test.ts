import { uploadFiles } from '~/lib/blob'

function createMockFile(name: string, size = 1024): File {
  return new File(['x'.repeat(size)], name, { type: 'application/pdf' })
}

function jsonResponse(ok: boolean, body: unknown): Response {
  return { ok, json: async () => body } as Response
}

describe('uploadFiles', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('should return empty array for empty input', async () => {
    const result = await uploadFiles([])
    expect(result).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should upload files concurrently and return results', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(true, {
        url: '/api/uploads/file.pdf',
        pathname: 'file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      })
    )

    const files = [createMockFile('file1.pdf'), createMockFile('file2.pdf')]
    const results = await uploadFiles(files)

    expect(results).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(results[0]).toMatchObject({ name: 'file1.pdf' })
    expect(results[1]).toMatchObject({ name: 'file2.pdf' })
  })

  it('should clean up uploaded files when one upload fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(true, {
          url: '/api/uploads/file1.pdf',
          pathname: 'file1.pdf',
          size: 1024,
          contentType: 'application/pdf',
        })
      )
      .mockResolvedValueOnce(jsonResponse(false, { error: 'Upload failed' }))
      .mockResolvedValueOnce(jsonResponse(true, { ok: true }))

    const files = [createMockFile('file1.pdf'), createMockFile('file2.pdf')]

    await expect(uploadFiles(files)).rejects.toThrow('Failed to upload: file2.pdf')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/uploads',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('should not crash when cleanup fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(true, {
          url: '/api/uploads/file1.pdf',
          pathname: 'file1.pdf',
          size: 1024,
          contentType: 'application/pdf',
        })
      )
      .mockResolvedValueOnce(jsonResponse(false, { error: 'Upload failed' }))
      .mockRejectedValueOnce(new Error('Cleanup failed'))

    const files = [createMockFile('file1.pdf'), createMockFile('file2.pdf')]

    await expect(uploadFiles(files)).rejects.toThrow('Failed to upload: file2.pdf')
  })

  it('should POST the file as form data to /api/uploads', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(true, {
        url: '/api/uploads/test.pdf',
        pathname: 'test.pdf',
        size: 1024,
        contentType: 'application/pdf',
      })
    )

    const file = createMockFile('test.pdf')
    await uploadFiles([file])

    expect(fetchMock).toHaveBeenCalledWith('/api/uploads', expect.objectContaining({ method: 'POST' }))
    const [, options] = fetchMock.mock.calls[0] as [string, { body: FormData }]
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file')).toBe(file)
  })
})
