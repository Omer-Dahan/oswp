import { render, screen } from '@testing-library/react'

import RsvpConfirmation from '~/components/website/rsvp-confirmation'

const translations: Record<string, string> = {
  'common.addToCalendar': 'ADD TO CALENDAR',
  'common.downloadIcs': 'DOWNLOAD ICS',
  'rsvp.confirmationThanksFamily': 'THANK YOU, THE {lastName} FAMILY',
  'rsvp.confirmationThanksName': 'THANK YOU, {firstName}',
  'rsvp.confirmationThanksFallback': 'THANK YOU',
  'rsvp.confirmationCount': 'WE CONFIRMED {count} GUESTS',
  'rsvp.confirmationCountWithChildren': 'WE CONFIRMED {count} GUESTS · {children} CHILDREN',
  'rsvp.backToHomepage': 'BACK TO HOMEPAGE',
  'rsvp.accepted': 'ACCEPTED',
  'rsvp.declined': 'DECLINED',
  'rsvp.dietaryNotesTitle': 'DIETARY NOTES',
  'rsvp.addToAppleCalendar': 'ADD TO APPLE CALENDAR',
  'rsvp.addGoogleCalendar': 'ADD TO GOOGLE CALENDAR',
  'rsvp.navigateToVenue': 'NAVIGATE TO VENUE',
}

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const template = translations[`${namespace}.${key}`] ?? key
    if (!values) return template
    return Object.entries(values).reduce(
      (acc, [name, value]) => acc.replace(`{${name}}`, String(value)),
      template
    )
  },
}))

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
  return MockLink
})

jest.mock('next/image', () => {
  const MockImage = ({ alt }: { alt: string }) => <img alt={alt} />
  return MockImage
})

let mockFormState: {
  weddingData: { groomFirstName?: string; brideFirstName?: string; events: unknown[] }
  rsvpResponses: unknown[]
  selectedHousehold?: unknown
  attendingCount?: number
  childrenCount?: number
  dietaryNotes?: string
}

jest.mock('~/components/contexts/rsvp-form-context', () => ({
  useRsvpForm: () => mockFormState,
}))

describe('RsvpConfirmation', () => {
  it('offers ONE calendar entry for the whole evening instead of one per event', () => {
    mockFormState = {
      weddingData: {
        groomFirstName: 'Ron',
        brideFirstName: 'Hermione',
        website: { subUrl: 'the-wedding' },
        events: [
          {
            id: 'e1',
            name: 'Wedding Ceremony',
            date: new Date('2026-06-01T00:00:00.000Z'),
            startTime: '19:30',
            endTime: '20:30',
            venue: 'The Hall',
          },
          {
            id: 'e2',
            name: 'Reception',
            date: new Date('2026-06-01T00:00:00.000Z'),
            startTime: '18:30',
            endTime: '00:30',
            venue: 'The Hall',
          },
        ],
      },
      rsvpResponses: [
        { eventId: 'e1', guestId: 'g1', guestName: 'Harry Potter', rsvp: 'Attending' },
        { eventId: 'e2', guestId: 'g1', guestName: 'Harry Potter', rsvp: 'Attending' },
      ],
      attendingCount: 1,
    }

    render(<RsvpConfirmation basePath='/site' />)

    // Two side-by-side links — one for Apple (a real .ics URL so iOS offers
    // "Add to Calendar") and one for Google — not a pair per event.
    const appleLink = screen.getByRole('link', { name: 'ADD TO APPLE CALENDAR' })
    expect(appleLink).toHaveAttribute(
      'href',
      '/api/calendar/wedding/the-wedding?event=e1&event=e2'
    )
    const googleLinks = screen
      .getAllByRole('link')
      .filter((link) =>
        (link as HTMLAnchorElement).href.startsWith('https://calendar.google.com/calendar/render')
      )
    expect(googleLinks).toHaveLength(1)
    expect(screen.queryByText(/ADD TO CALENDAR · /)).toBeNull()

    // Both events still appear, each with its own time, and the evening reads as
    // a single span from the reception to after midnight.
    expect(screen.getByText('Wedding Ceremony')).toBeInTheDocument()
    expect(screen.getByText('Reception')).toBeInTheDocument()
    expect(screen.getByText(/18:30–00:30/)).toBeInTheDocument()
  })

  it('shows the dietary note verbatim when the household submitted one', () => {
    mockFormState = {
      weddingData: {
        groomFirstName: 'Ron',
        brideFirstName: 'Hermione',
        website: { subUrl: 'the-wedding' },
        events: [],
      },
      rsvpResponses: [],
      attendingCount: 2,
      dietaryNotes: 'No nuts for Harry',
    }

    render(<RsvpConfirmation basePath='/site' />)

    expect(screen.getByText('No nuts for Harry')).toBeInTheDocument()
  })

  it('scopes the Apple calendar link to a chuppah-only response', () => {
    mockFormState = {
      weddingData: {
        groomFirstName: 'Ron',
        brideFirstName: 'Hermione',
        website: { subUrl: 'the-wedding' },
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
      rsvpResponses: [
        { eventId: 'chuppah', guestId: 'g1', guestName: 'Harry Potter', rsvp: 'Attending' },
      ],
      attendingCount: 1,
    }

    render(<RsvpConfirmation basePath='/site' />)

    expect(screen.getByRole('link', { name: 'ADD TO APPLE CALENDAR' })).toHaveAttribute(
      'href',
      '/api/calendar/wedding/the-wedding?event=chuppah'
    )
  })
})
