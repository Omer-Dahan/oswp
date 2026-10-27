import { GET } from '~/app/api/calendar/wedding/[websiteSubUrl]/route'

const mockLoadWeddingBySubUrl = jest.fn()

class TestResponse {
  status: number

  constructor(
    private readonly body: string,
    init?: { status?: number }
  ) {
    this.status = init?.status ?? 200
  }

  async text() {
    return this.body
  }
}

globalThis.Response = TestResponse as never

jest.mock('~/app/w/[websiteSubUrl]/_lib/load-wedding-by-suburl', () => ({
  loadWeddingBySubUrl: (...args: unknown[]) => mockLoadWeddingBySubUrl(...args),
}))

describe('GET /api/calendar/wedding/[websiteSubUrl]', () => {
  it('exports only the event selected by a chuppah-only confirmation', async () => {
    mockLoadWeddingBySubUrl.mockResolvedValue({
      status: 'ready',
      weddingData: {
        groomFirstName: 'דוד',
        groomLastName: '',
        brideFirstName: 'מורשה',
        brideLastName: '',
        events: [
          {
            id: 'chuppah',
            name: 'החופה',
            date: new Date('2026-11-24T00:00:00.000Z'),
            startTime: '19:30',
            endTime: '20:30',
            venue: 'אגדתא',
          },
          {
            id: 'meal',
            name: 'החתונה',
            date: new Date('2026-11-24T00:00:00.000Z'),
            startTime: '18:30',
            endTime: '00:30',
            venue: 'אגדתא',
          },
        ],
      },
    })

    const response = await GET(
      { nextUrl: new URL('https://example.test/api/calendar/wedding/the-wedding?event=chuppah') } as never,
      { params: Promise.resolve({ websiteSubUrl: 'the-wedding' }) }
    )
    const ics = await response.text()

    expect(response.status).toBe(200)
    expect(ics).toContain('DTSTART:20261124T173000Z')
    expect(ics).toContain('DTEND:20261124T183000Z')
    expect(ics).toContain('החופה 19:30–20:30')
    expect(ics).not.toContain('החתונה 18:30–00:30')
  })
})
