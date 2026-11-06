import { fireEvent, render, screen } from '@testing-library/react'

import { GuestDetailPanelContent } from '~/components/guest-list/guest-detail-panel-content'
import type { HouseholdWithGuests } from '~/server/application/dashboard/dashboard.types'

const mockRefresh = jest.fn()
const mockHouseholdUpdateMutate = jest.fn()
const mockDashboardInvalidate = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

jest.mock('~/trpc/react', () => ({
  api: {
    useUtils: () => ({
      dashboard: {
        getForActiveWorkspace: {
          invalidate: (...args: unknown[]) => mockDashboardInvalidate(...args),
        },
      },
      sms: {
        getInviteMessage: {
          fetch: jest.fn().mockResolvedValue({ message: 'הודעת הזמנה' }),
        },
      },
    }),
    website: {
      getByUserId: {
        useQuery: () => ({ data: { id: 'site-1' } }),
      },
    },
    guestTag: {
      getAll: {
        useQuery: () => ({ data: [], refetch: jest.fn() }),
      },
    },
    household: {
      update: {
        useMutation: (options?: { onSuccess?: () => void; onError?: () => void }) => ({
          mutate: (payload: unknown) => {
            mockHouseholdUpdateMutate(payload)
            options?.onSuccess?.()
          },
          isPending: false,
        }),
      },
    },
  },
}))

const buildHousehold = (
  overrides: Partial<HouseholdWithGuests> = {}
): HouseholdWithGuests => ({
  id: 'household-1',
  weddingId: 'wedding-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  address1: null,
  address2: null,
  city: null,
  state: null,
  zipCode: null,
  country: null,
  likelihoodOfAttending: null,
  notes: null,
  invitedCount: 2,
  side: null,
  groupName: null,
  attendingCount: null,
  childrenCount: null,
  dietaryNotes: null,
  wishesMessage: null,
  guests: [
    {
      id: 1,
      firstName: 'דנה',
      lastName: 'כהן',
      email: 'dana@example.com',
      phone: null,
      householdId: 'household-1',
      weddingId: 'wedding-1',
      isPrimaryContact: true,
      ageGroup: 'ADULT',
      isTagAlong: false,
      guestTags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      invitations: [],
    },
  ],
  gifts: [],
  rsvpSubmissions: [],
  ...overrides,
})

const renderPanel = (household: HouseholdWithGuests) => {
  const drawerDraft = {
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    notes: '',
    likelihoodOfAttending: null,
    side: '',
    groupName: '',
  }

  return render(
    <GuestDetailPanelContent
      selectedHousehold={household}
      allHouseholds={[household]}
      selectedEventId='all'
      events={[]}
      communicationLog={[]}
      householdAnswers={[]}
      editingSections={new Set()}
      toggleEditingSection={jest.fn()}
      drawerDraft={drawerDraft}
      setDrawerDraft={jest.fn()}
      rsvpManageHref='/guests'
      onSaveMembers={jest.fn().mockResolvedValue(true)}
    />
  )
}

describe('GuestDetailPanelContent - guest counts editor', () => {
  beforeEach(() => {
    mockHouseholdUpdateMutate.mockReset()
    mockDashboardInvalidate.mockReset()
    mockRefresh.mockReset()
  })

  it('shows the invited/attending counts and opens the editor', () => {
    renderPanel(buildHousehold({ invitedCount: 3, attendingCount: null }))

    expect(screen.getByText('מוזמן 3 · מגיע לא צוין')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'עריכת מספר מגיעים' }))

    expect(screen.getByLabelText('מספר מוזמנים')).toBeInTheDocument()
    expect(screen.getByLabelText('כמה יגיעו בפועל')).toBeInTheDocument()
    expect(screen.getByText('עדכון כאן לא משנה את האישור של האורח')).toBeInTheDocument()
  })

  it('saves the typed attending count through household.update', () => {
    renderPanel(buildHousehold({ invitedCount: 3, attendingCount: null }))

    fireEvent.click(screen.getByRole('button', { name: 'עריכת מספר מגיעים' }))
    fireEvent.change(screen.getByLabelText('כמה יגיעו בפועל'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }))

    expect(mockHouseholdUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'household-1',
        invitedCount: 3,
        attendingCount: 2,
      })
    )
  })

  it('sends null when the attending count is cleared', () => {
    renderPanel(buildHousehold({ invitedCount: 3, attendingCount: 2 }))

    fireEvent.click(screen.getByRole('button', { name: 'עריכת מספר מגיעים' }))
    fireEvent.change(screen.getByLabelText('כמה יגיעו בפועל'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }))

    expect(mockHouseholdUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'household-1',
        invitedCount: 3,
        attendingCount: null,
      })
    )
  })
})
