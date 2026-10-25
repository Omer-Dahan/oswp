/**
 * @jest-environment node
 */

import { householdInviteCookieName } from '~/lib/website/cookies'

jest.mock('~/server/application/household-invite', () => ({
  householdInviteService: {
    getInviteData: jest.fn(),
  },
}))

import { householdInviteService } from '~/server/application/household-invite'

const mockGetInviteData = householdInviteService.getInviteData as jest.Mock

import { GET } from '~/app/w/[websiteSubUrl]/save-the-date/[code]/route'

function makeParams(websiteSubUrl: string, code: string) {
  return { params: Promise.resolve({ websiteSubUrl, code }) }
}

describe('GET /w/[websiteSubUrl]/save-the-date/[code]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('redirects to a relative path with the invite cookie set, regardless of the request host', async () => {
    mockGetInviteData.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000) })

    const request = new Request('http://localhost:3000/w/guests/save-the-date/hh-3brqmw')
    const res = await GET(request, makeParams('guests', 'hh-3brqmw'))

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toBe('/w/guests/save-the-date')
    expect(location).not.toContain('localhost')

    const cookie = res.cookies.get(householdInviteCookieName('guests'))
    expect(cookie?.value).toBe('hh-3brqmw')
  })

  it('redirects to a relative invalid path when the invite is not found', async () => {
    mockGetInviteData.mockResolvedValue(null)

    const request = new Request('http://localhost:3000/w/guests/save-the-date/bad-code')
    const res = await GET(request, makeParams('guests', 'bad-code'))

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toBe('/w/guests/save-the-date?invalid=1')
    expect(location).not.toContain('localhost')
  })
})
