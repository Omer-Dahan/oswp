/**
 * @jest-environment node
 */

import { api } from '~/trpc/server'

jest.mock('~/trpc/server', () => ({
  api: { report: { getGuestExportForDownload: jest.fn() } },
}))

const mockGetGuestExport = api.report.getGuestExportForDownload as jest.Mock

import { GET } from '~/app/api/reports/guest-export/route'

describe('GET /api/reports/guest-export', () => {
  beforeEach(() => {
    mockGetGuestExport.mockReset()
  })

  it('returns 400 when eventId is missing', async () => {
    const response = await GET(new Request('http://localhost/api/reports/guest-export'))

    expect(response.status).toBe(400)
  })

  it('returns an xlsx attachment named without a side segment when no side was requested', async () => {
    mockGetGuestExport.mockResolvedValue({ rows: [], eventName: 'החתונה' })

    const response = await GET(
      new Request('http://localhost/api/reports/guest-export?eventId=event-1')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    const disposition = response.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain('attachment')
    expect(disposition).not.toContain(encodeURIComponent('-חתן-'))
    expect(mockGetGuestExport).toHaveBeenCalledWith({
      eventId: 'event-1',
      side: undefined,
      group: undefined,
    })
  })

  it('includes the side in the attachment filename when a side was requested', async () => {
    mockGetGuestExport.mockResolvedValue({ rows: [], eventName: 'החתונה' })

    const response = await GET(
      new Request('http://localhost/api/reports/guest-export?eventId=event-1&side=חתן')
    )

    const disposition = response.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain(encodeURIComponent('-חתן-'))
    expect(mockGetGuestExport).toHaveBeenCalledWith({
      eventId: 'event-1',
      side: 'חתן',
      group: undefined,
    })
  })
})
