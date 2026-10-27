import { getClientIp } from '~/server/application/rsvp-submission/rsvp-submission.service'

describe('getClientIp', () => {
  it('uses the proxy-appended address instead of a spoofable forwarded prefix', () => {
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.10, 203.0.113.25',
    })

    expect(getClientIp(headers)).toBe('203.0.113.25')
  })
})
