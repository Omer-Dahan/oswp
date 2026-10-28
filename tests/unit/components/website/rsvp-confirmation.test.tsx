import { fireEvent, render, screen } from '@testing-library/react'

import RsvpConfirmation from '~/components/website/rsvp-confirmation'

const translations: Record<string, string> = {
  'common.addToCalendar': 'ADD TO CALENDAR',
  'common.downloadIcs': 'DOWNLOAD ICS',
  'rsvp.confirmationThanksFamily': 'תודה משפחת {lastName}',
  'rsvp.confirmationThanksName': 'תודה {firstName}',
  'rsvp.confirmationThanksFallback': 'תודה!',
  'rsvp.confirmationDeclinedThanks': 'תודה שעדכנתם אותנו 🤍',
  'rsvp.confirmationReception': 'קבלת פנים',
  'rsvp.confirmationChuppah': 'חופה וקידושין',
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
    if (namespace === 'rsvp' && key.startsWith('confirmationCount')) {
      const count = Number(values?.count)
      const children = Number(values?.children ?? 0)
      const guestCopy = count === 1 ? 'אישרנו הגעה לאורח אחד' : `אישרנו הגעה ל-${count} אורחים`
      if (key === 'confirmationCountWithChildren') {
        return `${guestCopy} · ${children === 1 ? 'ילד אחד' : `${children} ילדים`}`
      }
      return guestCopy
    }
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

const mockRouterPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

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
  beforeEach(() => {
    mockRouterPush.mockClear()
  })

  it('navigates home from the real confirmation state', () => {
    mockFormState = {
      weddingData: {
        groomFirstName: 'Ron',
        brideFirstName: 'Hermione',
        events: [],
      },
      rsvpResponses: [],
      attendingCount: 1,
    }

    render(<RsvpConfirmation basePath='/site' />)

    fireEvent.click(screen.getByRole('button', { name: 'BACK TO HOMEPAGE' }))

    expect(mockRouterPush).toHaveBeenCalledWith('/site')
  })

  it('renders a single guest heading, singular count, and both resolved event times', () => {
    const primaryGuest = { id: 'g1', firstName: 'עומר', lastName: 'דהן' }
    mockFormState = {
      weddingData: {
        groomFirstName: 'רון',
        brideFirstName: 'הרמיוני',
        events: [
          {
            id: 'wedding',
            name: 'החתונה',
            date: new Date('2026-11-24T00:00:00.000Z'),
            hebrewDateOverride: 'י״ד כסלו',
            startTime: '18:30',
            endTime: '00:30',
            venue: 'אגדתא',
          },
          {
            id: 'chuppah',
            name: 'החופה',
            date: new Date('2026-11-24T00:00:00.000Z'),
            hebrewDateOverride: 'י״ד כסלו',
            startTime: '19:30',
            endTime: '20:30',
            venue: 'אגדתא',
          },
        ],
      },
      selectedHousehold: { guests: [primaryGuest], primaryContact: primaryGuest },
      rsvpResponses: [
        { eventId: 'wedding', guestId: 'g1', guestName: 'עומר דהן', rsvp: 'Attending' },
        { eventId: 'chuppah', guestId: 'g1', guestName: 'עומר דהן', rsvp: 'Attending' },
      ],
      attendingCount: 1,
    }

    render(<RsvpConfirmation basePath='/site' />)

    expect(screen.getByRole('heading', { name: 'תודה עומר' })).toBeInTheDocument()
    expect(screen.getByText('אישרנו הגעה לאורח אחד')).toBeInTheDocument()
    expect(
      screen.getByText((_, element) => element?.textContent === 'קבלת פנים · י״ד כסלו · 18:30')
    ).toBeInTheDocument()
    expect(
      screen.getByText((_, element) => element?.textContent === 'חופה וקידושין · י״ד כסלו · 19:30')
    ).toBeInTheDocument()
    expect(screen.queryByText(/00:30|20:30/)).toBeNull()
  })

  it.each([
    [3, 0, 'אישרנו הגעה ל-3 אורחים'],
    [3, 2, 'אישרנו הגעה ל-3 אורחים · 2 ילדים'],
    [1, 1, 'אישרנו הגעה לאורח אחד · ילד אחד'],
  ])('renders the grammatical count for %i guests and %i children', (count, children, copy) => {
    mockFormState = {
      weddingData: { events: [] },
      rsvpResponses: [
        { eventId: 'wedding', guestId: 'g1', guestName: 'עומר דהן', rsvp: 'Attending' },
      ],
      attendingCount: count,
      childrenCount: children,
    }

    render(<RsvpConfirmation basePath='/site' />)

    expect(screen.getByText(copy)).toBeInTheDocument()
  })

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
    expect(appleLink).toHaveAttribute('href', '/api/calendar/wedding/the-wedding?event=e1&event=e2')
    const googleLinks = screen
      .getAllByRole('link')
      .filter((link) =>
        (link as HTMLAnchorElement).href.startsWith('https://calendar.google.com/calendar/render')
      )
    expect(googleLinks).toHaveLength(1)
    expect(screen.queryByText(/ADD TO CALENDAR · /)).toBeNull()

    expect(screen.queryByText(/18:30–00:30/)).toBeNull()
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
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' && element.textContent?.startsWith('חופה וקידושין') === true
      )
    ).toHaveTextContent('19:30')
    expect(screen.queryByText(/קבלת פנים/)).toBeNull()
    expect(screen.queryByText(/20:30/)).toBeNull()
  })

  it('keeps the decline copy without an attendance count', () => {
    mockFormState = {
      weddingData: { events: [] },
      rsvpResponses: [
        { eventId: 'wedding', guestId: 'g1', guestName: 'עומר דהן', rsvp: 'Declined' },
      ],
      attendingCount: 0,
    }

    render(<RsvpConfirmation basePath='/site' />)

    expect(screen.getByRole('heading', { name: 'תודה שעדכנתם אותנו 🤍' })).toBeInTheDocument()
    expect(screen.queryByText(/אישרנו הגעה/)).toBeNull()
  })

  it('renders the resolved Waze URL as a large accessible link', () => {
    mockFormState = {
      weddingData: {
        website: { subUrl: 'the-wedding' },
        events: [
          {
            id: 'wedding',
            name: 'החתונה',
            date: new Date('2026-11-24T00:00:00.000Z'),
            startTime: '18:30',
            endTime: '00:30',
            venueWazeUrl: 'https://waze.com/ul/hsv8sxty41',
          },
        ],
      },
      rsvpResponses: [
        { eventId: 'wedding', guestId: 'g1', guestName: 'עומר דהן', rsvp: 'Attending' },
      ],
      attendingCount: 1,
    }

    render(<RsvpConfirmation basePath='/site' />)

    const directions = screen.getByRole('link', { name: 'NAVIGATE TO VENUE' })
    expect(directions).toHaveAttribute('href', 'https://waze.com/ul/hsv8sxty41')
    expect(directions).toHaveClass('min-h-14', 'w-full', 'text-lg')
  })
})
