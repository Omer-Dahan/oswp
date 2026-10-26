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
      attendingCount: 1,
    }

    render(<RsvpConfirmation basePath='/site' />)

    const googleLinks = screen.getAllByRole('link').filter((link) =>
      (link as HTMLAnchorElement).href.startsWith('https://calendar.google.com/calendar/render')
    )
    expect(googleLinks).toHaveLength(1)
    expect(googleLinks[0]).toHaveAccessibleName(expect.stringContaining('Wedding Ceremony'))

    expect(screen.getByText('Wedding Ceremony')).toBeInTheDocument()
    expect(screen.getByText('Rehearsal Dinner')).toBeInTheDocument()
    expect(screen.queryByText('DOWNLOAD ICS')).toBeInTheDocument()
  })

  it('shows the dietary note verbatim when the household submitted one', () => {
    mockFormState = {
      weddingData: {
        groomFirstName: 'Ron',
        brideFirstName: 'Hermione',
        events: [],
      },
      rsvpResponses: [],
      attendingCount: 2,
      dietaryNotes: 'No nuts for Harry',
    }

    render(<RsvpConfirmation basePath='/site' />)

    expect(screen.getByText('No nuts for Harry')).toBeInTheDocument()
  })
})
