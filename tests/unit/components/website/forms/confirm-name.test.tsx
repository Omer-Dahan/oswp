import { fireEvent, render, screen } from '@testing-library/react'

import ConfirmNameForm from '~/components/website/forms/steps/confirm-name'

const translations: Record<string, string> = {
  'common.continue': 'CONTINUE',
  'rsvp.foundInGuestList': 'FOUND IN GUEST LIST',
  'rsvp.notYou': 'NOT YOU?',
  'rsvp.recognizedInvitation': 'RECOGNIZED INVITATION',
  'rsvp.searchAgain': 'SEARCH AGAIN',
}

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    translations[`${namespace}.${key}`] ?? key,
}))

const mockUpdateRsvpForm = jest.fn()
let mockFormState: {
  matchedHouseholds?: unknown[]
  selectedHousehold?: unknown
  recognized?: boolean
  weddingData?: unknown
}

jest.mock('~/components/contexts/rsvp-form-context', () => ({
  useRsvpForm: () => mockFormState,
  useUpdateRsvpForm: () => mockUpdateRsvpForm,
}))

// Selecting a household re-fetches its private fields (dietary notes, wishes
// message) via this query, gated behind a matching `searchText` — see
// confirm-name.tsx's `onContinue`.
jest.mock('~/trpc/react', () => ({
  api: {
    household: {
      getPublicHouseholdDetails: {
        useQuery: () => ({
          refetch: jest.fn().mockResolvedValue({ data: undefined }),
          isFetching: false,
        }),
      },
    },
  },
}))

const household = (id: string, firstName: string) => ({
  id,
  guests: [
    {
      id: 1,
      firstName,
      lastName: 'Weasley',
      isPrimaryContact: true,
      isTagAlong: false,
      invitations: [],
      guestTagAssignments: [],
    },
  ],
})

describe('ConfirmNameForm', () => {
  beforeEach(() => {
    mockUpdateRsvpForm.mockReset()
    mockFormState = { matchedHouseholds: [], selectedHousehold: undefined, weddingData: {} }
  })

  it('pre-selects the household when there is exactly one match', () => {
    mockFormState = { matchedHouseholds: [household('h1', 'Ron')], weddingData: {} }
    render(<ConfirmNameForm goNext={jest.fn()} goBack={jest.fn()} />)

    // A single match is auto-selected so CONTINUE is immediately actionable.
    expect(screen.getByRole('radio')).toBeChecked()
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeEnabled()
  })

  it('does not pre-select when there are multiple matches', () => {
    mockFormState = {
      matchedHouseholds: [household('h1', 'Ron'), household('h2', 'Harry')],
      weddingData: {},
    }
    render(<ConfirmNameForm goNext={jest.fn()} goBack={jest.fn()} />)

    const radios = screen.getAllByRole('radio')
    expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true)
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'SEARCH AGAIN' })).toBeInTheDocument()
  })

  it('offers a "Not you?" escape that clears the recognized match and goes back to search', () => {
    const goBack = jest.fn()
    mockFormState = { matchedHouseholds: [household('h1', 'Ron')], recognized: true, weddingData: {} }
    render(<ConfirmNameForm goNext={jest.fn()} goBack={goBack} />)

    fireEvent.click(screen.getByRole('button', { name: 'NOT YOU?' }))

    expect(mockUpdateRsvpForm).toHaveBeenCalledWith(
      expect.objectContaining({ recognized: false, matchedHouseholds: [] })
    )
    expect(goBack).toHaveBeenCalledTimes(1)
  })
})
