import { render, screen } from '@testing-library/react'

import RsvpConfirmation from '~/components/website/rsvp-confirmation'

const translations: Record<string, string> = {
  'common.addToCalendar': 'ADD TO CALENDAR',
  'common.downloadIcs': 'DOWNLOAD ICS',
  'rsvp.confirmationTitle': 'CONFIRMATION',
  'rsvp.backToHomepage': 'BACK TO HOMEPAGE',
  'rsvp.yourRsvpResponse': 'YOUR RESPONSE',
  'rsvp.updateResponse': 'UPDATE RESPONSE',
}

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    translations[`${namespace}.${key}`] ?? key,
}))

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
  return MockLink
})

let mockFormState: {
  weddingData: { groomFirstName?: string; brideFirstName?: string; events: unknown[] }
  rsvpResponses: unknown[]
}

jest.mock('~/components/contexts/rsvp-form-context', () => ({
  useRsvpForm: () => mockFormState,
}))

describe('RsvpConfirmation', () => {
  it('renders a working Google Calendar link for a dated event and no calendar control for an undated event', () => {
    mockFormState = {
      weddingData: {
        groomFirstName: 'Ron',
        brideFirstName: 'Hermione',
        events: [
          { id: 'e1', name: 'Wedding Ceremony', date: new Date('2026-06-01T00:00:00.000Z') },
          { id: 'e2', name: 'Rehearsal Dinner', date: null },
        ],
      },
      rsvpResponses: [
        { eventId: 'e1', guestId: 'g1', guestName: 'Harry Potter', rsvp: 'Attending' },
        { eventId: 'e2', guestId: 'g1', guestName: 'Harry Potter', rsvp: 'Attending' },
      ],
    }

    render(<RsvpConfirmation basePath='/site' setCurrentStep={jest.fn()} />)

    const googleLinks = screen.getAllByRole('link').filter((link) =>
      (link as HTMLAnchorElement).href.startsWith('https://calendar.google.com/calendar/render')
    )
    expect(googleLinks).toHaveLength(1)
    expect(googleLinks[0]).toHaveAccessibleName(expect.stringContaining('Wedding Ceremony'))

    expect(screen.getByText('Wedding Ceremony')).toBeInTheDocument()
    expect(screen.getByText('Rehearsal Dinner')).toBeInTheDocument()
    expect(screen.queryByText('DOWNLOAD ICS')).toBeInTheDocument()
  })
})
