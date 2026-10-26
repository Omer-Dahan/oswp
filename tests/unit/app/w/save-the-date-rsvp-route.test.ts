/**
 * @jest-environment node
 */

import { householdInviteCookieName } from '~/lib/website/cookies'

jest.mock('~/server/application/household-invite', () => ({
  householdInviteService: {
    getRecognizedRsvpHousehold: jest.fn(),
  },
}))

jest.mock('~/server/application/rsvp-submission', () => ({
  rsvpSubmissionService: {
    submitRsvp: jest.fn(),
  },
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

import { cookies } from 'next/headers'
import { householdInviteService } from '~/server/application/household-invite'
import { rsvpSubmissionService } from '~/server/application/rsvp-submission'

const mockGetRecognizedRsvpHousehold =
  householdInviteService.getRecognizedRsvpHousehold as jest.Mock
const mockSubmitRsvp = rsvpSubmissionService.submitRsvp as jest.Mock
const mockCookies = cookies as jest.Mock

import { POST } from '~/app/w/[websiteSubUrl]/save-the-date/rsvp/route'

function makeParams(websiteSubUrl: string) {
  return { params: Promise.resolve({ websiteSubUrl }) }
}

function makeRequest(body: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(body)) formData.set(key, value)
  return new Request('http://localhost:3000/w/guests/save-the-date/rsvp', {
    method: 'POST',
    body: formData,
  })
}

const household = {
  id: 'household-1',
  invitedCount: 2,
  attendingCount: null,
  childrenCount: null,
  dietaryNotes: null,
  guests: [
    {
      id: 1,
      firstName: 'A',
      lastName: 'A',
      isPrimaryContact: true,
      isTagAlong: false,
      ageGroup: 'ADULT' as const,
      invitations: [
        { id: 'inv-1', eventId: 'wedding-event', rsvp: 'Invited' },
        { id: 'inv-2', eventId: 'chuppah-event', rsvp: 'Invited' },
      ],
    },
    {
      id: 2,
      firstName: 'B',
      lastName: 'B',
      isPrimaryContact: false,
      isTagAlong: false,
      ageGroup: 'ADULT' as const,
      invitations: [{ id: 'inv-3', eventId: 'wedding-event', rsvp: 'Invited' }],
    },
  ],
}

describe('POST /w/[websiteSubUrl]/save-the-date/rsvp', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCookies.mockResolvedValue({
      get: (name: string) =>
        name === householdInviteCookieName('guests') ? { value: 'hh-code' } : undefined,
    })
  })

  it('sets Attending on the chosen event for every guest invited to it, leaving the other event alone', async () => {
    mockGetRecognizedRsvpHousehold.mockResolvedValue(household)
    mockSubmitRsvp.mockResolvedValue({ success: true })

    const res = await POST(
      makeRequest({ intent: 'attend', eventId: 'wedding-event' }),
      makeParams('guests')
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      '/w/guests/save-the-date?rsvp=attending&event=wedding-event'
    )
    expect(mockSubmitRsvp).toHaveBeenCalledWith({
      rsvpResponses: [
        { eventId: 'wedding-event', guestId: 1, rsvp: 'Attending' },
        { eventId: 'wedding-event', guestId: 2, rsvp: 'Attending' },
      ],
      answersToQuestions: [],
    })
  })

  it('is idempotent: submitting the same attend action twice sends the same update both times', async () => {
    mockGetRecognizedRsvpHousehold.mockResolvedValue(household)
    mockSubmitRsvp.mockResolvedValue({ success: true })

    await POST(makeRequest({ intent: 'attend', eventId: 'wedding-event' }), makeParams('guests'))
    await POST(makeRequest({ intent: 'attend', eventId: 'wedding-event' }), makeParams('guests'))

    expect(mockSubmitRsvp).toHaveBeenCalledTimes(2)
    expect(mockSubmitRsvp.mock.calls[0]).toEqual(mockSubmitRsvp.mock.calls[1])
  })

  it('marks every invitation the household holds as Declined', async () => {
    mockGetRecognizedRsvpHousehold.mockResolvedValue(household)
    mockSubmitRsvp.mockResolvedValue({ success: true })

    const res = await POST(makeRequest({ intent: 'decline' }), makeParams('guests'))

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/w/guests/save-the-date?rsvp=declined')
    expect(mockSubmitRsvp).toHaveBeenCalledWith({
      rsvpResponses: [
        { eventId: 'wedding-event', guestId: 1, rsvp: 'Declined' },
        { eventId: 'chuppah-event', guestId: 1, rsvp: 'Declined' },
        { eventId: 'wedding-event', guestId: 2, rsvp: 'Declined' },
      ],
      answersToQuestions: [],
    })
  })

  it('redirects to the invalid invite state without writing when the household cannot be resolved', async () => {
    mockGetRecognizedRsvpHousehold.mockResolvedValue(null)

    const res = await POST(makeRequest({ intent: 'decline' }), makeParams('guests'))

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/w/guests/save-the-date?invalid=1')
    expect(mockSubmitRsvp).not.toHaveBeenCalled()
  })
})
