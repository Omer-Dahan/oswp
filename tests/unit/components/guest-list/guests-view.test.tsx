import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import GuestsView from '~/components/guest-list/guests-view'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

const mockToggleGuestForm = jest.fn()
const mockRefresh = jest.fn()
const mockHouseholdUpdateMutate = jest.fn()
const mockDashboardInvalidate = jest.fn()
let shouldMutationFail = false
let deferMutationResolution = false
let pendingMutationSuccess: (() => void) | undefined

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

jest.mock('~/components/contexts/guest-form-context', () => ({
  useToggleGuestForm: () => mockToggleGuestForm,
}))

jest.mock('~/components/contexts/event-form-context', () => ({
  useToggleEventForm: () => jest.fn(),
}))

jest.mock('~/components/guest-list/tag-input', () => ({
  TagInput: ({ ariaLabel }: { ariaLabel: string }) => <div data-testid={ariaLabel} />,
}))

jest.mock('~/components/hooks', () => {
  const React = require('react')
  return {
    useOuterClick: () => React.createRef(),
  }
})

jest.mock('~/components/ui/select', () => {
  const _React = require('react')
  return {
    Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({
      children,
      'aria-label': ariaLabel,
    }: {
      children: React.ReactNode
      'aria-label'?: string
    }) => (
      <button type='button' aria-label={ariaLabel}>
        {children}
      </button>
    ),
    SelectValue: () => <span />,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: React.ReactNode; value: string }) => (
      <div>{children}</div>
    ),
  }
})

let mockTagsData: Array<{ id: string; name: string; color?: string | null }> = []

jest.mock('~/trpc/react', () => ({
  api: {
    useUtils: () => ({
      dashboard: {
        getForActiveWorkspace: {
          invalidate: (...args: unknown[]) => mockDashboardInvalidate(...args),
        },
      },
      event: {
        getAllByUserIdWithStats: {
          invalidate: jest.fn(),
        },
      },
      communicationLog: {
        getByHouseholdId: {
          invalidate: jest.fn(),
        },
      },
    }),
    guestTag: {
      getAll: {
        useQuery: () => ({ data: mockTagsData, refetch: jest.fn() }),
      },
      create: {
        useMutation: () => ({ mutate: jest.fn() }),
      },
    },
    communicationLog: {
      getByHouseholdId: {
        useQuery: () => ({ data: [] }),
      },
      addNote: {
        useMutation: () => ({ mutate: jest.fn() }),
      },
      deleteNote: {
        useMutation: () => ({ mutate: jest.fn() }),
      },
    },
    household: {
      update: {
        useMutation: () => ({
          mutate: (
            payload: unknown,
            options?: {
              onSuccess?: () => void
              onError?: () => void
            }
          ) => {
            mockHouseholdUpdateMutate(payload)

            const resolveSuccess = () => options?.onSuccess?.()
            const resolveError = () => options?.onError?.()

            if (deferMutationResolution) {
              pendingMutationSuccess = resolveSuccess
              return
            }

            if (shouldMutationFail) {
              resolveError()
              return
            }

            resolveSuccess()
          },
          isPending: false,
        }),
      },
      delete: {
        useMutation: () => ({
          mutate: (
            _payload: unknown,
            options?: {
              onSuccess?: () => void
              onError?: () => void
            }
          ) => {
            options?.onSuccess?.()
          },
          isPending: false,
        }),
      },
      deleteAll: {
        useMutation: () => ({
          mutate: (
            _payload: unknown,
            options?: {
              onSuccess?: () => void
              onError?: () => void
            }
          ) => {
            options?.onSuccess?.()
          },
          isPending: false,
        }),
      },
    },
    invitation: {
      update: {
        useMutation: () => ({ mutate: jest.fn(), isPending: false }),
      },
    },
    householdInvite: {
      generateLink: {
        useMutation: () => ({
          mutateAsync: jest
            .fn()
            .mockResolvedValue({ url: 'http://localhost:3000/save-the-date/token' }),
          isPending: false,
        }),
      },
    },
    website: {
      getByUserId: {
        useQuery: () => ({ data: { subUrl: 'janeandjohn' } }),
      },
    },
    question: {
      getAnswersByHousehold: {
        useQuery: () => ({ data: [], isLoading: false }),
      },
    },
    wedding: {
      getWorkspace: {
        useQuery: () => ({
          data: {
            organizationId: null,
            weddingId: 'wedding-1',
            role: 'OWNER',
            capabilities: {
              canInviteMembers: true,
              canManageMembers: true,
              canSendInvites: true,
              canViewPlanning: true,
              canAccessSettings: true,
              canDeleteAllGuests: true,
            },
          },
        }),
      },
    },
  },
}))

const events = [
  {
    id: 'event-1',
    name: 'Wedding Day',
    date: new Date('2026-06-01T00:00:00.000Z'),
    startTime: null,
    endTime: null,
    venue: null,
    attire: null,
    description: null,
    weddingId: 'wedding-1',
    questions: [],
  },
  {
    id: 'event-2',
    name: 'Welcome Party',
    date: new Date('2026-05-31T00:00:00.000Z'),
    startTime: null,
    endTime: null,
    venue: null,
    attire: null,
    description: null,
    weddingId: 'wedding-1',
    questions: [],
  },
]

const households: HouseholdWithGuests[] = [
  {
    id: 'household-1',
    weddingId: 'wedding-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    address1: '123 Main St',
    address2: null,
    city: 'Austin',
    state: 'TX',
    zipCode: '73301',
    country: 'US',
    notes: 'Vegetarian meals only',
    guests: [
      {
        id: 1,
        firstName: 'Alex',
        lastName: 'Rivera',
        email: 'alex@example.com',
        phone: '+12025550111',
        householdId: 'household-1',
        weddingId: 'wedding-1',
        isPrimaryContact: true,
        ageGroup: 'ADULT',
        guestTags: [{ tagId: 'family' }],
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
          {
            id: 'inv-2',
            weddingId: 'wedding-1',
            guestId: 1,
            eventId: 'event-2',
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
            id: 'inv-3',
            weddingId: 'wedding-1',
            guestId: 2,
            eventId: 'event-1',
            rsvp: 'Declined',
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
    gifts: [
      {
        id: 'gift-1',
        householdId: 'household-1',
        eventId: 'event-1',
        weddingId: 'wedding-1',
        thankyou: false,
        description: 'Toaster',
        event: { name: 'Wedding Day' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'gift-2',
        householdId: 'household-1',
        eventId: 'event-2',
        weddingId: 'wedding-1',
        thankyou: true,
        description: 'Wine',
        event: { name: 'Welcome Party' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
  },
]

const householdsWithSecondFamily: HouseholdWithGuests[] = [
  ...households,
  {
    id: 'household-2',
    weddingId: 'wedding-1',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    address1: null,
    address2: null,
    city: 'Dallas',
    state: 'TX',
    zipCode: null,
    country: 'US',
    notes: null,
    guests: [
      {
        id: 3,
        firstName: 'Brooke',
        lastName: 'Chen',
        email: 'brooke@example.com',
        phone: null,
        householdId: 'household-2',
        weddingId: 'wedding-1',
        isPrimaryContact: true,
        ageGroup: 'ADULT',
        guestTags: [],
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        invitations: [
          {
            id: 'inv-4',
            weddingId: 'wedding-1',
            guestId: 3,
            eventId: 'event-1',
            rsvp: 'Invited',
            dietaryRestrictions: null,
            submittedBy: null,
            submittedAt: null,
            invitedAt: new Date('2026-01-02T00:00:00.000Z'),
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          },
        ],
      },
    ],
    gifts: [],
  },
]

const householdsWithFilteredGuests: {
  displayed: HouseholdWithGuests[]
  canonical: HouseholdWithGuests[]
} = {
  displayed: [
    {
      ...households[0],
      guests: households[0].guests.filter((guest) => guest.id !== 4),
    },
  ],
  canonical: [
    {
      ...households[0],
      guests: [
        ...households[0].guests,
        {
          id: 4,
          firstName: 'Taylor',
          lastName: 'Rivera',
          email: null,
          phone: null,
          householdId: 'household-1',
          weddingId: 'wedding-1',
          isPrimaryContact: false,
          ageGroup: 'ADULT',
          guestTags: [],
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
          updatedAt: new Date('2026-01-03T00:00:00.000Z'),
          invitations: [
            {
              id: 'inv-5',
              weddingId: 'wedding-1',
              guestId: 4,
              eventId: 'event-2',
              rsvp: 'Attending',
              dietaryRestrictions: null,
              submittedBy: null,
              submittedAt: null,
              invitedAt: new Date('2026-01-03T00:00:00.000Z'),
              createdAt: new Date('2026-01-03T00:00:00.000Z'),
              updatedAt: new Date('2026-01-03T00:00:00.000Z'),
            },
          ],
        },
      ],
    },
  ],
}

const _TAG_FAMILY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const _householdsWithCountries: HouseholdWithGuests[] = [
  { ...households[0], country: 'US' },
  {
    ...householdsWithSecondFamily[1],
    country: 'UK',
  },
]

describe('GuestsView', () => {
  beforeEach(() => {
    mockToggleGuestForm.mockReset()
    mockRefresh.mockReset()
    mockHouseholdUpdateMutate.mockReset()
    mockDashboardInvalidate.mockReset()
    shouldMutationFail = false
    deferMutationResolution = false
    pendingMutationSuccess = undefined
    mockTagsData = []
  })

  it('should save canonical household guest party when members modal is saved from a filtered list', async () => {
    render(
      <GuestsView
        events={events}
        households={householdsWithFilteredGuests.displayed}
        allHouseholds={householdsWithFilteredGuests.canonical}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'ניהול חברים' }))
    fireEvent.click(screen.getByRole('button', { name: 'שמירת חברים' }))

    await waitFor(() => {
      expect(mockHouseholdUpdateMutate).toHaveBeenCalled()
    })

    const payload = mockHouseholdUpdateMutate.mock.calls[0]?.[0] as {
      guestParty: Array<{ guestId: number }>
    }
    expect(payload.guestParty).toHaveLength(3)
    expect(payload.guestParty.map((guest) => guest.guestId)).toEqual([1, 2, 4])
  })

  it('should patch the saved household even if selection changes before mutation resolves', async () => {
    deferMutationResolution = true

    render(
      <GuestsView
        events={events}
        households={householdsWithSecondFamily}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'עריכת פרטי קשר וכתובת' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'דוא״ל' }), {
      target: { value: 'late-success@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'שמירת שינויים' }))

    fireEvent.click(screen.getByRole('button', { name: 'סגירת פרטי אורח' }))
    fireEvent.click(screen.getByRole('button', { name: 'ביטול וסגירה' }))
    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של brooke chen/i }))

    await act(async () => {
      pendingMutationSuccess?.()
    })

    await waitFor(() => {
      expect(mockDashboardInvalidate).toHaveBeenCalled()
    })

    expect(screen.getByText('brooke@example.com')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'סגירת פרטי אורח' }))
    fireEvent.click(screen.getByRole('button', { name: 'ביטול וסגירה' }))
    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    expect(screen.getByText('late-success@example.com')).toBeInTheDocument()
  }, 10000)

  it('should keep search/filter and add guest while rendering slim cards', () => {
    mockTagsData = [{ id: 'family', name: 'Family' }]

    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    expect(screen.getByPlaceholderText('חיפוש אורחים')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'סטטוס RSVP' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'תגית אורח' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ארץ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'משקי בית' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ביקורת אנשים' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'מיון לפי שם' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'מיון לפי גודל קבוצה' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'תצוגת כרטיסים' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'תצוגת טבלה' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'הוספת אורח' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i })
    ).toBeInTheDocument()
  })

  it('should switch to person audit mode and show table headings', () => {
    render(
      <GuestsView
        events={events}
        households={householdsWithSecondFamily}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'ביקורת אנשים' }))

    expect(screen.getByRole('columnheader', { name: 'אדם' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'משק בית' })).toBeInTheDocument()
  })

  it('should show and clear active search state via the Clear control', () => {
    render(
      <GuestsView
        events={events}
        households={householdsWithSecondFamily}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: 'נקה סינון' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('חיפוש אורחים'), { target: { value: 'Brooke' } })

    expect(screen.getByRole('button', { name: 'נקה סינון' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'נקה סינון' }))

    expect(screen.queryByRole('button', { name: 'נקה סינון' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /בחירת משק הבית של brooke chen/i })
    ).toBeInTheDocument()
  })

  it('wires Add Guest and ייבוא אורחים toolbar buttons with non-submit button semantics', () => {
    const onImportClick = jest.fn()
    const setPrefillHousehold = jest.fn()
    mockToggleGuestForm.mockClear()

    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='all'
        setPrefillHousehold={setPrefillHousehold}
        setPrefillEvent={jest.fn()}
        onImportClick={onImportClick}
      />
    )

    const importButton = screen.getByRole('button', { name: 'ייבוא אורחים' })
    const addButton = screen.getByRole('button', { name: 'הוספת אורח' })

    fireEvent.click(importButton)
    fireEvent.click(addButton)

    expect(importButton).toHaveAttribute('type', 'button')
    expect(addButton).toHaveAttribute('type', 'button')
    expect(onImportClick).toHaveBeenCalledTimes(1)
    expect(setPrefillHousehold).toHaveBeenCalledWith(undefined)
    expect(mockToggleGuestForm).toHaveBeenCalledTimes(1)
  })

  it('should show an empty async status when no households match', () => {
    render(
      <GuestsView
        events={events}
        households={[]}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('אין משקי בית עדיין')
  })

  it('should open drawer with section-level edit controls and no full-editor action', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))

    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'דוא״ל' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'עריכת פרטי קשר וכתובת' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'עריכת הערות' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Continue in Full Editor' })
    ).not.toBeInTheDocument()
  })

  it('should render inline tag input for each member in the modal', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'ניהול חברים' }))

    expect(screen.getByTestId('תגיות עבור Alex Rivera')).toBeInTheDocument()
  })

  it('should open ניהול חברי משק הבית modal from Party Members section', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'ניהול חברים' }))

    expect(screen.getByRole('dialog', { name: 'ניהול חברי משק הבית' })).toBeInTheDocument()
  })

  it('should keeps drawer draft intact when members modal is saved', async () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'עריכת פרטי קשר וכתובת' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'דוא״ל' }), {
      target: { value: 'draft-only@example.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'ניהול חברים' }))
    fireEvent.click(screen.getByRole('button', { name: /הוספת אורח/i }))
    fireEvent.change(screen.getByLabelText('שם פרטי (חבר 3)'), {
      target: { value: 'Taylor' },
    })
    fireEvent.change(screen.getByLabelText('שם משפחה (חבר 3)'), {
      target: { value: 'Rivera' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'שמירת חברים' }))

    await waitFor(() => {
      expect(mockHouseholdUpdateMutate).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'שמירת שינויים' })).toBeInTheDocument()
    })

    expect(screen.getAllByText('Taylor Rivera').length).toBeGreaterThan(0)
    expect(screen.getByRole('textbox', { name: 'דוא״ל' })).toHaveValue('draft-only@example.com')
  }, 10000)

  it('should updates drawer party members after adding member in modal and saving', async () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'ניהול חברים' }))

    fireEvent.click(screen.getByRole('button', { name: /הוספת אורח/i }))
    fireEvent.change(screen.getByLabelText('שם פרטי (חבר 3)'), {
      target: { value: 'Taylor' },
    })
    fireEvent.change(screen.getByLabelText('שם משפחה (חבר 3)'), {
      target: { value: 'Rivera' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'שמירת חברים' }))

    await waitFor(() => {
      expect(screen.getAllByText('Taylor Rivera').length).toBeGreaterThan(0)
    })
  })

  it('should initialize newly added household members as not invited to every event', async () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'ניהול חברים' }))

    fireEvent.click(screen.getByRole('button', { name: /הוספת אורח/i }))
    fireEvent.change(screen.getByLabelText('שם פרטי (חבר 3)'), {
      target: { value: 'Taylor' },
    })
    fireEvent.change(screen.getByLabelText('שם משפחה (חבר 3)'), {
      target: { value: 'Rivera' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'שמירת חברים' }))

    await waitFor(() => {
      expect(mockHouseholdUpdateMutate).toHaveBeenCalled()
    })

    const payload = mockHouseholdUpdateMutate.mock.calls[0]?.[0] as {
      guestParty: Array<{ guestId?: number; firstName: string; lastName: string; invites: unknown }>
    }
    const newGuest = payload.guestParty.find(
      (guest) => guest.firstName === 'Taylor' && guest.lastName === 'Rivera'
    )

    expect(newGuest).toMatchObject({
      guestId: undefined,
      invites: {
        'event-1': 'Not Invited',
        'event-2': 'Not Invited',
      },
    })
  })

  it('should keep modal open and preserve draft values when member save fails', async () => {
    shouldMutationFail = true

    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'ניהול חברים' }))

    fireEvent.click(screen.getByRole('button', { name: /הוספת אורח/i }))
    fireEvent.change(screen.getByLabelText('שם פרטי (חבר 3)'), {
      target: { value: 'Taylor' },
    })
    fireEvent.change(screen.getByLabelText('שם משפחה (חבר 3)'), {
      target: { value: 'Rivera' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'שמירת חברים' }))

    await waitFor(() => {
      expect(mockHouseholdUpdateMutate).toHaveBeenCalled()
    })

    expect(screen.getByRole('dialog', { name: 'ניהול חברי משק הבית' })).toBeInTheDocument()
    expect(screen.getByLabelText('שם פרטי (חבר 3)')).toHaveValue('Taylor')
    expect(screen.getByLabelText('שם משפחה (חבר 3)')).toHaveValue('Rivera')
    await waitFor(() => {
      expect(screen.getByText('לא ניתן לשמור את החברים. נסו שוב.')).toBeInTheDocument()
    })
  })

  it('should block member save when required names are missing', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'ניהול חברים' }))
    fireEvent.click(screen.getByRole('button', { name: /הוספת אורח/i }))

    expect(
      screen.getByText('לכל חבר במשק הבית יש להזין שם פרטי ושם משפחה.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'שמירת חברים' }))

    expect(mockHouseholdUpdateMutate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'ניהול חברי משק הבית' })).toBeInTheDocument()
  })

  it('should show remove disabled for current primary until another member is primary', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'ניהול חברים' }))

    expect(screen.getByRole('button', { name: 'הסרת Alex Rivera' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'הגדרת Jamie Rivera כראשי' }))
    expect(screen.getByRole('button', { name: 'הסרת Alex Rivera' })).toBeEnabled()
  })

  it('should show dirty actions and save updated values in drawer', async () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'עריכת פרטי קשר וכתובת' }))

    const emailInput = screen.getByRole('textbox', { name: 'דוא״ל' })
    fireEvent.change(emailInput, { target: { value: 'updated@example.com' } })

    expect(screen.getByText('שינויים שלא נשמרו')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'שמירת שינויים' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ביטול שינויים' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'שמירת שינויים' }))

    await waitFor(() => {
      expect(mockHouseholdUpdateMutate).toHaveBeenCalled()
      expect(mockDashboardInvalidate).toHaveBeenCalled()
    })

    expect(screen.queryByRole('textbox', { name: 'דוא״ל' })).not.toBeInTheDocument()
    expect(screen.getByText('updated@example.com')).toBeInTheDocument()
    expect(screen.queryByText('שינויים שלא נשמרו')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'שמירת שינויים' })).not.toBeInTheDocument()
  })

  it('should discard dirty changes and restore baseline values', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'עריכת הערות' }))

    fireEvent.change(screen.getByPlaceholderText('אין הערות עדיין'), {
      target: { value: 'Bring high chair' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'ביטול שינויים' }))

    expect(screen.queryByRole('textbox', { name: 'דוא״ל' })).not.toBeInTheDocument()
    expect(screen.getByText('Vegetarian meals only')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'שמירת שינויים' })).not.toBeInTheDocument()
  })

  it('should preserve dirty draft when save fails', () => {
    shouldMutationFail = true

    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'עריכת פרטי קשר וכתובת' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'דוא״ל' }), {
      target: { value: 'failed-save@example.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'שמירת שינויים' }))

    expect(screen.getByRole('textbox', { name: 'דוא״ל' })).toHaveValue('failed-save@example.com')
    expect(screen.getByRole('button', { name: 'שמירת שינויים' })).toBeInTheDocument()
  })

  it('clears invalid legacy phone values from the contact editor and save payload', async () => {
    const householdsWithLegacyPhones: HouseholdWithGuests[] = [
      {
        ...households[0],
        guests: households[0].guests.map((guest) => ({
          ...guest,
          phone: guest.isPrimaryContact ? '+1-555-0101' : '+1-555-0102',
        })),
      },
    ]

    render(
      <GuestsView
        events={events}
        households={householdsWithLegacyPhones}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'עריכת פרטי קשר וכתובת' }))

    expect(document.querySelector('input[name="phone"]')).toHaveValue('')

    fireEvent.change(screen.getByRole('textbox', { name: 'דוא״ל' }), {
      target: { value: 'legacy-fixed@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'שמירת שינויים' }))

    await waitFor(() => {
      expect(mockHouseholdUpdateMutate).toHaveBeenCalled()
    })

    const payload = mockHouseholdUpdateMutate.mock.calls[0]?.[0] as {
      guestParty: Array<{ guestId: number; phone: string | null }>
    }

    expect(payload.guestParty).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ guestId: 1, phone: null }),
        expect.objectContaining({ guestId: 2, phone: null }),
      ])
    )
  })

  it('should guard closing when there are unsaved changes', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'עריכת הערות' }))
    fireEvent.change(screen.getByPlaceholderText('אין הערות עדיין'), {
      target: { value: 'Unsaved text' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'סגירת פרטי אורח' }))

    expect(screen.getByText('לבטל שינויים שלא נשמרו?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'המשך עריכה' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ביטול וסגירה' })).toBeInTheDocument()
  })

  it('should include a link to manage RSVPs in events page', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))

    const manageLink = screen.getByRole('link', { name: 'ניהול באירועים' })
    expect(manageLink).toHaveAttribute('href', '/events?eventId=event-1&tab=rsvps')
  })

  it('should reset drawer values when drawer is discarded and closed', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'עריכת פרטי קשר וכתובת' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'דוא״ל' }), {
      target: { value: 'temp@example.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'סגירת פרטי אורח' }))
    fireEvent.click(screen.getByRole('button', { name: 'ביטול וסגירה' }))

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    expect(screen.queryByRole('textbox', { name: 'דוא״ל' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'עריכת פרטי קשר וכתובת' }))
    expect(screen.getByRole('textbox', { name: 'דוא״ל' })).toHaveValue('alex@example.com')
  })

  it('should open another household in display mode with fresh values after closing edit', () => {
    render(
      <GuestsView
        events={events}
        households={householdsWithSecondFamily}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))
    fireEvent.click(screen.getByRole('button', { name: 'עריכת פרטי קשר וכתובת' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'דוא״ל' }), {
      target: { value: 'temp@example.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'סגירת פרטי אורח' }))
    fireEvent.click(screen.getByRole('button', { name: 'ביטול וסגירה' }))
    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של brooke chen/i }))

    expect(screen.queryByRole('textbox', { name: 'דוא״ל' })).not.toBeInTheDocument()
    expect(screen.getByText('brooke@example.com')).toBeInTheDocument()
  })

  it('should show mixed RSVP state in all-events mode for guests with mixed responses', () => {
    const householdsWithMixedRsvp: HouseholdWithGuests[] = [
      {
        ...households[0],
        guests: [
          {
            ...households[0].guests[0],
            invitations: [
              {
                ...households[0].guests[0].invitations[0],
                rsvp: 'Attending',
              },
              {
                ...households[0].guests[0].invitations[1],
                rsvp: 'Declined',
              },
            ],
          },
        ],
      },
    ]

    render(
      <GuestsView
        events={events}
        households={householdsWithMixedRsvp}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))

    expect(screen.getByText('תשובות מעורבות')).toBeInTheDocument()
  })

  it('should show known and missing household details in drawer', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))

    expect(screen.getByText('פרטי קשר וכתובת')).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('+12025550111').length).toBeGreaterThan(0)
    expect(screen.getByText('123 Main St, Austin, TX, 73301, US')).toBeInTheDocument()
  })

  it('should render an accessible event edit button in selected event header', () => {
    const setPrefillEvent = jest.fn()

    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='event-1'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={setPrefillEvent}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'עריכת פרטי האירוע' }))

    expect(setPrefillEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-1',
        eventName: 'Wedding Day',
      })
    )
  })

  it('should filter households by first name', () => {
    render(
      <GuestsView
        events={events}
        households={householdsWithSecondFamily}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('חיפוש אורחים'), { target: { value: 'Brooke' } })

    expect(
      screen.queryByRole('button', { name: /בחירת משק הבית של alex rivera/i })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /בחירת משק הבית של brooke chen/i })
    ).toBeInTheDocument()
  })

  it('should filter households by last name', () => {
    render(
      <GuestsView
        events={events}
        households={householdsWithSecondFamily}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('חיפוש אורחים'), { target: { value: 'Chen' } })

    expect(
      screen.queryByRole('button', { name: /בחירת משק הבית של alex rivera/i })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /בחירת משק הבית של brooke chen/i })
    ).toBeInTheDocument()
  })

  it('should filter households by full name', () => {
    render(
      <GuestsView
        events={events}
        households={householdsWithSecondFamily}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('חיפוש אורחים'), {
      target: { value: 'Alex Rivera' },
    })

    expect(
      screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /בחירת משק הבית של brooke chen/i })
    ).not.toBeInTheDocument()
  })

  it('should filter guests case-insensitively', () => {
    render(
      <GuestsView
        events={events}
        households={householdsWithSecondFamily}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('חיפוש אורחים'), { target: { value: 'alex' } })

    expect(
      screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /בחירת משק הבית של brooke chen/i })
    ).not.toBeInTheDocument()
  })

  it('should sort households by name and reset to default order', () => {
    render(
      <GuestsView
        events={events}
        households={householdsWithSecondFamily}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    const householdButtons = () =>
      screen
        .getAllByRole('button', { name: /בחירת משק הבית של .*/i })
        .map((node) => node.textContent)

    expect(householdButtons()[0]).toContain('Alex Rivera')

    fireEvent.click(screen.getByRole('button', { name: 'מיון לפי שם' }))
    expect(householdButtons()[0]).toContain('Alex Rivera')

    fireEvent.click(screen.getByRole('button', { name: 'מיון לפי שם' }))
    expect(householdButtons()[0]).toContain('Brooke Chen')

    fireEvent.click(screen.getByRole('button', { name: 'מיון לפי שם' }))
    expect(householdButtons()[0]).toContain('Alex Rivera')
  })

  it('should display attendance likelihood section in the drawer', () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))

    expect(screen.getByText('סבירות הגעה')).toBeInTheDocument()
    expect(screen.getByText('גררו את הסליידר כדי לקבוע סבירות')).toBeInTheDocument()
  })

  it('should include likelihoodOfAttending in save payload when slider is changed', async () => {
    render(
      <GuestsView
        events={events}
        households={households}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))

    // Change the slider value — the Radix Slider renders a hidden input
    const slider = screen.getByRole('slider')
    // Simulate changing the slider by setting aria-valuenow via keyboard
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    // Drawer should now show save/discard buttons (dirty state)
    expect(screen.getByRole('button', { name: 'שמירת שינויים' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'שמירת שינויים' }))

    await waitFor(() => {
      expect(mockHouseholdUpdateMutate).toHaveBeenCalled()
    })

    const payload = mockHouseholdUpdateMutate.mock.calls[0]?.[0] as {
      likelihoodOfAttending: number | null
    }
    expect(payload.likelihoodOfAttending).toEqual(expect.any(Number))
  })

  it('should initialize slider with household likelihoodOfAttending value', () => {
    const householdsWithLikelihood: HouseholdWithGuests[] = [
      { ...households[0], likelihoodOfAttending: 4 },
    ]

    render(
      <GuestsView
        events={events}
        households={householdsWithLikelihood}
        selectedEventId='all'
        setPrefillHousehold={jest.fn()}
        setPrefillEvent={jest.fn()}
        onImportClick={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /בחירת משק הבית של alex rivera/i }))

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuenow', '4')
    // "גררו את הסליידר כדי לקבוע סבירות" should NOT be shown when value is set
    expect(screen.queryByText('גררו את הסליידר כדי לקבוע סבירות')).not.toBeInTheDocument()
  })
})
