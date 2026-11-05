import { fireEvent, render, screen } from '@testing-library/react'

import { GuestCard } from '~/components/guest-list/v2/list/guest-card'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

const mockGetInviteMessageFetch = jest.fn().mockResolvedValue({ message: '' })

jest.mock('~/trpc/react', () => ({
  api: {
    useUtils: () => ({
      sms: {
        getInviteMessage: {
          fetch: mockGetInviteMessageFetch,
        },
      },
    }),
  },
}))

const mockHousehold: HouseholdWithGuests = {
  id: 'household-1',
  weddingId: 'wedding-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  address1: null,
  address2: null,
  city: 'Austin',
  state: 'TX',
  zipCode: null,
  country: 'USA',
  notes: null,
  guests: [
    {
      id: 1,
      firstName: 'Alex',
      lastName: 'Rivera',
      email: 'alex@example.com',
      phone: null,
      householdId: 'household-1',
      weddingId: 'wedding-1',
      isPrimaryContact: true,
      ageGroup: 'ADULT',
      guestTags: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      invitations: [
        {
          id: 'inv-1',
          weddingId: 'wedding-1',
          guestId: 1,
          eventId: 'event-1',
          rsvp: 'Attending',
          dietaryRestrictions: null,
          submittedBy: null,
          submittedAt: null,
          invitedAt: new Date('2026-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    },
    {
      id: 2,
      firstName: 'Jamie',
      lastName: 'Rivera',
      email: null,
      phone: null,
      householdId: 'household-1',
      weddingId: 'wedding-1',
      isPrimaryContact: false,
      ageGroup: 'ADULT',
      guestTags: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      invitations: [
        {
          id: 'inv-2',
          weddingId: 'wedding-1',
          guestId: 2,
          eventId: 'event-1',
          rsvp: 'Invited',
          dietaryRestrictions: null,
          submittedBy: null,
          submittedAt: null,
          invitedAt: new Date('2026-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    },
  ],
  gifts: [],
}

type MockGuest = (typeof mockHousehold.guests)[number]
const mockGuest0 = mockHousehold.guests[0] as MockGuest
const mockGuest1 = mockHousehold.guests[1] as MockGuest

const mockHouseholdWithTagAlong: HouseholdWithGuests = {
  ...mockHousehold,
  guests: [
    mockGuest0, // Regular guest: Attending
    {
      ...mockGuest1,
      id: 3,
      firstName: 'Baby',
      lastName: 'Rivera',
      isTagAlong: true,
      invitations: [
        {
          id: 'inv-3',
          weddingId: 'wedding-1',
          guestId: 3,
          eventId: 'event-1',
          rsvp: 'Attending',
          dietaryRestrictions: null,
          submittedBy: null,
          submittedAt: null,
          invitedAt: new Date('2026-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    },
  ],
}

const mockHouseholdTagAlongNoInvitations: HouseholdWithGuests = {
  ...mockHousehold,
  guests: [
    mockGuest0, // Regular guest: Attending
    {
      ...mockGuest1,
      id: 4,
      firstName: 'Toddler',
      lastName: 'Rivera',
      isTagAlong: true,
      invitations: [], // No invitations (event doesn't allow tag-alongs)
    },
  ],
}

describe('GuestCard', () => {
  it('should render polished identity, location, and summary details', () => {
    render(<GuestCard household={mockHousehold} onSelectHousehold={jest.fn()} />)

    // No "+1" suffix on the name - the household size is already implied by the arrival count.
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument()
    expect(screen.getAllByText('AR').length).toBeGreaterThan(0)
    // Alex is Attending, Jamie is still Invited: one arriving out of two invited.
    expect(screen.getByText('מגיע').closest('div')).toHaveTextContent('1')
    expect(screen.getByText(/מתוך 2 שהוזמנו/)).toBeInTheDocument()
  })

  it('uses selected styling when card is active', () => {
    render(<GuestCard household={mockHousehold} onSelectHousehold={jest.fn()} isSelected />)

    expect(screen.getByLabelText(/בחירת משק הבית של Alex Rivera/i).parentElement).toHaveClass(
      'ring-1',
      'ring-primary/30'
    )
  })

  it('should call selection callback with household id', () => {
    const onSelectHousehold = jest.fn()

    render(<GuestCard household={mockHousehold} onSelectHousehold={onSelectHousehold} />)

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של Alex Rivera/i }))

    expect(onSelectHousehold).toHaveBeenCalledWith(expect.objectContaining({ id: 'household-1' }))
  })

  it('should include tag-along invitations in RSVP summary', () => {
    render(<GuestCard household={mockHouseholdWithTagAlong} onSelectHousehold={jest.fn()} />)

    // Both regular guest and tag-along are "Attending"
    expect(screen.getByText('מגיעים').closest('div')).toHaveTextContent('2')
  })

  it('should not count tag-alongs without invitations in RSVP summary', () => {
    render(
      <GuestCard household={mockHouseholdTagAlongNoInvitations} onSelectHousehold={jest.fn()} />
    )

    // Only the regular guest has invitations
    expect(screen.getByText('מגיע').closest('div')).toHaveTextContent('1')
  })

  it('should not double-count a guest attending both the wedding and the chuppah', () => {
    const weddingEvent = { id: 'event-1', name: 'החתונה', isPrimary: true, collectRsvp: true }
    const chuppahEvent = { id: 'event-2', name: 'החופה', collectRsvp: true }
    const householdWithChuppah: HouseholdWithGuests = {
      ...mockHousehold,
      attendingCount: 1,
      guests: [
        {
          ...mockGuest0,
          invitations: [
            ...mockGuest0.invitations,
            {
              id: 'inv-1-chuppah',
              weddingId: 'wedding-1',
              guestId: 1,
              eventId: 'event-2',
              rsvp: 'Attending',
              dietaryRestrictions: null,
              submittedBy: null,
              submittedAt: null,
              invitedAt: new Date('2026-01-01T00:00:00.000Z'),
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
        },
      ],
    }

    render(
      <GuestCard
        household={householdWithChuppah}
        onSelectHousehold={jest.fn()}
        events={[weddingEvent, chuppahEvent]}
      />
    )

    // Only one guest RSVPed Attending to the wedding; the chuppah invitation
    // must not add a second count.
    expect(screen.getByText('מגיע').closest('div')).toHaveTextContent('1')
    expect(screen.queryByText('2 מגיעים')).not.toBeInTheDocument()
    // attendingCount (1) matches the named wedding count (1), so it must not
    // be printed a second time as a confusing extra figure.
    expect(screen.queryByText(/לפי דיווח האורח/)).not.toBeInTheDocument()
  })

  it('shows a dedicated chuppah-only state when the household answered only the chuppah', () => {
    const weddingEvent = { id: 'event-1', name: 'החתונה', isPrimary: true, collectRsvp: true }
    const chuppahEvent = { id: 'event-2', name: 'החופה', collectRsvp: true }
    const chuppahOnlyHousehold: HouseholdWithGuests = {
      ...mockHousehold,
      guests: [
        {
          ...mockGuest0,
          invitations: [{ ...mockGuest0.invitations[0]!, eventId: 'event-2', rsvp: 'Attending' }],
        },
      ],
    }

    render(
      <GuestCard
        household={chuppahOnlyHousehold}
        onSelectHousehold={jest.fn()}
        events={[weddingEvent, chuppahEvent]}
      />
    )

    // The chuppah count and label drive the main state...
    expect(screen.getByText('מגיע לחופה').closest('div')).toHaveTextContent('1')
    expect(screen.getByText('החתונה טרם השיבה')).toBeInTheDocument()
    // ...so the household must never read as entirely unanswered, nor get
    // the separate mixed-event line (the state above already says it), nor
    // a "לפי דיווח האורח" figure for a reception nobody answered.
    expect(screen.queryByText('טרם השיבו')).not.toBeInTheDocument()
    expect(screen.queryByText(/לפי דיווח האורח/)).not.toBeInTheDocument()
    expect(screen.queryByText('מגיע לחופה · החתונה טרם השיבה')).not.toBeInTheDocument()
  })

  it('shows no mixed-event line when both events are answered the same way', () => {
    const weddingEvent = { id: 'event-1', name: 'החתונה', isPrimary: true, collectRsvp: true }
    const chuppahEvent = { id: 'event-2', name: 'החופה', collectRsvp: true }
    const bothAttendingHousehold: HouseholdWithGuests = {
      ...mockHousehold,
      guests: [
        {
          ...mockGuest0,
          invitations: [
            mockGuest0.invitations[0]!,
            {
              ...mockGuest0.invitations[0]!,
              id: 'inv-1-chuppah',
              eventId: 'event-2',
              rsvp: 'Attending',
            },
          ],
        },
      ],
    }

    render(
      <GuestCard
        household={bothAttendingHousehold}
        onSelectHousehold={jest.fn()}
        events={[weddingEvent, chuppahEvent]}
      />
    )

    expect(screen.queryByText(/טרם השיבה/)).not.toBeInTheDocument()
  })

  it('copies the bride-side signature for a newly created bride-side household', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    mockGetInviteMessageFetch.mockResolvedValueOnce({
      message: 'דוד יעקב, שלום רב.\n\nבברכה - משה ומירב בן הרוש',
    })

    const brideHousehold: HouseholdWithGuests = { ...mockHousehold, side: 'כלה' }
    render(<GuestCard household={brideHousehold} onSelectHousehold={jest.fn()} />)

    fireEvent.keyDown(screen.getByRole('button', { name: 'פעולות עבור Alex Rivera' }), {
      key: 'ArrowDown',
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'העתקת הודעת הזמנה' }))

    fireEvent.keyDown(screen.getByRole('button', { name: 'פעולות עבור Alex Rivera' }), {
      key: 'ArrowDown',
    })
    await screen.findByText('ההודעה הועתקה')

    expect(mockGetInviteMessageFetch).toHaveBeenCalledWith({ householdId: 'household-1' })
    expect(writeText).toHaveBeenCalledWith('דוד יעקב, שלום רב.\n\nבברכה - משה ומירב בן הרוש')
  })

  it('shows "לא מגיעים" instead of a zero count when every guest declined', () => {
    const declinedHousehold: HouseholdWithGuests = {
      ...mockHousehold,
      guests: [
        { ...mockGuest0, invitations: [{ ...mockGuest0.invitations[0]!, rsvp: 'Declined' }] },
      ],
    }

    render(<GuestCard household={declinedHousehold} onSelectHousehold={jest.fn()} />)

    expect(screen.getByText('לא מגיעים')).toBeInTheDocument()
    expect(screen.getByText('מתוך 1 שהוזמן')).toBeInTheDocument()
    expect(screen.queryByText(/0 מגיעים/)).not.toBeInTheDocument()
  })

  it('never renders "0 מגיעים", even when nobody has answered', () => {
    const unansweredHousehold: HouseholdWithGuests = {
      ...mockHousehold,
      guests: [mockGuest1], // Still "Invited", nobody attending yet
    }

    render(<GuestCard household={unansweredHousehold} onSelectHousehold={jest.fn()} />)

    expect(screen.getByText('טרם השיבו')).toBeInTheDocument()
    expect(screen.getByText('1 הוזמן')).toBeInTheDocument()
    expect(screen.queryByText(/0 מגיעים/)).not.toBeInTheDocument()
    expect(screen.queryByText(/מגיעים/)).not.toBeInTheDocument()
  })

  it('renders the arrival number at 22px', () => {
    render(<GuestCard household={mockHousehold} onSelectHousehold={jest.fn()} />)

    expect(screen.getByText('מגיע').closest('div')).toHaveClass('text-[22px]')
  })

  it('never appends a "+N" suffix to the household name', () => {
    render(<GuestCard household={mockHousehold} onSelectHousehold={jest.fn()} />)

    expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument()
  })

  it('lets the guest name wrap on card layouts from the sm breakpoint', () => {
    render(<GuestCard household={mockHousehold} onSelectHousehold={jest.fn()} />)

    expect(screen.getByText('Alex Rivera')).toHaveClass(
      'min-w-0',
      'truncate',
      'sm:line-clamp-2',
      'sm:whitespace-normal'
    )
  })
})
