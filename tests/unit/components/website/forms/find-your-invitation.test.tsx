import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import FindYourInvitationForm from '~/components/website/forms/steps/find-your-invitation'

const translations: Record<string, string> = {
  'common.searching': 'SEARCHING',
  'common.genericError': 'GENERIC ERROR',
  'rsvp.weddingTitle': 'WEDDING TITLE',
  'rsvp.groupNote': 'GROUP NOTE',
  'rsvp.fullNamePlaceholder': 'Full name',
  'rsvp.notFound': 'NOT FOUND',
  'rsvp.findInvitation': 'FIND INVITATION',
  'rsvp.selfAddCta': 'SELF ADD CTA',
  'rsvp.selfAddFullNameLabel': 'Self add full name',
  'rsvp.selfAddPhoneLabel': 'Self add phone',
  'rsvp.selfAddAttendingCountLabel': 'Self add attending count',
  'rsvp.selfAddSubmit': 'SELF ADD SUBMIT',
  'rsvp.selfAddAlreadyListed': 'ALREADY LISTED',
}

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    translations[`${namespace}.${key}`] ?? key,
}))

const mockUpdateRsvpForm = jest.fn()
jest.mock('~/components/contexts/rsvp-form-context', () => ({
  useRsvpForm: () => ({
    weddingData: { website: { subUrl: 'the-wedding' } },
    declineIntent: false,
  }),
  useUpdateRsvpForm: () => mockUpdateRsvpForm,
}))

const mockRefetch = jest.fn()
const mockSelfAddMutate = jest.fn()
let capturedOnSuccess: ((result: { kind: string; inviteCode: string }) => void) | undefined
let capturedOnError: ((error: unknown) => void) | undefined
let mockIsPending = false

const mockAssign = jest.fn()
type LocationImplementation = { assign: (url: string) => void }
const locationImplementationSymbol = Object.getOwnPropertySymbols(window.location).find(
  (symbol) => symbol.description === 'impl'
)
if (!locationImplementationSymbol) throw new Error('JSDOM location implementation is unavailable')
const locationImplementation = (
  window.location as unknown as Record<symbol, LocationImplementation>
)[locationImplementationSymbol]
const originalAssign = locationImplementation.assign

jest.mock('~/trpc/react', () => ({
  api: {
    household: {
      findBySearchPublic: {
        useQuery: () => ({
          refetch: mockRefetch,
          isFetching: false,
        }),
      },
      addSelfPublic: {
        useMutation: (options: {
          onSuccess?: (result: { kind: string; inviteCode: string }) => void
          onError?: (error: unknown) => void
        }) => {
          capturedOnSuccess = options.onSuccess
          capturedOnError = options.onError
          return {
            mutate: mockSelfAddMutate,
            isPending: mockIsPending,
          }
        },
      },
    },
  },
}))

describe('FindYourInvitationForm self-add', () => {
  beforeAll(() => {
    Object.defineProperty(locationImplementation, 'assign', {
      configurable: true,
      value: mockAssign,
    })
  })

  afterAll(() => {
    Object.defineProperty(locationImplementation, 'assign', {
      configurable: true,
      value: originalAssign,
    })
  })

  beforeEach(() => {
    mockUpdateRsvpForm.mockReset()
    mockRefetch.mockReset()
    mockSelfAddMutate.mockReset()
    mockAssign.mockReset()
    capturedOnSuccess = undefined
    capturedOnError = undefined
    mockIsPending = false
  })

  it('does not show the self-add CTA before any search has run', () => {
    render(<FindYourInvitationForm goNext={jest.fn()} />)
    expect(screen.queryByText('SELF ADD CTA')).not.toBeInTheDocument()
  })

  it('shows the self-add CTA only after a search returns zero results', async () => {
    mockRefetch.mockResolvedValue({ data: [] })
    render(<FindYourInvitationForm goNext={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Full name'), {
      target: { value: 'Nobody Here' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'FIND INVITATION' }))

    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('SELF ADD CTA')).toBeInTheDocument()
  })

  it('does not show the CTA when the search errors out', async () => {
    mockRefetch.mockResolvedValue({ error: new Error('network error') })
    render(<FindYourInvitationForm goNext={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Full name'), {
      target: { value: 'Nobody Here' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'FIND INVITATION' }))

    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('NOT FOUND')).toBeInTheDocument()
    expect(screen.queryByText('SELF ADD CTA')).not.toBeInTheDocument()
  })

  const openSelfAddForm = async () => {
    mockRefetch.mockResolvedValue({ data: [] })
    render(<FindYourInvitationForm goNext={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Full name'), {
      target: { value: 'Nobody Here' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'FIND INVITATION' }))
    fireEvent.click(await screen.findByText('SELF ADD CTA'))
  }

  it('submits the trimmed values and hard-navigates to the invite link on success', async () => {
    await openSelfAddForm()

    fireEvent.change(screen.getByPlaceholderText('Self add full name'), {
      target: { value: '  Dana Levi  ' },
    })
    fireEvent.change(screen.getByPlaceholderText('Self add phone'), {
      target: { value: '  0501234567  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'SELF ADD SUBMIT' }))

    expect(mockSelfAddMutate).toHaveBeenCalledWith({
      subUrl: 'the-wedding',
      fullName: 'Dana Levi',
      phone: '0501234567',
      attendingCount: 1,
    })

    act(() => capturedOnSuccess?.({ kind: 'created', inviteCode: 'abc123' }))

    expect(mockAssign).toHaveBeenCalledWith(
      '/w/the-wedding/save-the-date/abc123'
    )
  })

  it('navigates to the existing invite code and notes the guest is already listed', async () => {
    await openSelfAddForm()

    fireEvent.change(screen.getByPlaceholderText('Self add full name'), {
      target: { value: 'Dana Levi' },
    })
    fireEvent.change(screen.getByPlaceholderText('Self add phone'), {
      target: { value: '0501234567' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'SELF ADD SUBMIT' }))

    act(() => capturedOnSuccess?.({ kind: 'already_listed', inviteCode: 'existing-code' }))

    expect(mockAssign).toHaveBeenCalledWith(
      '/w/the-wedding/save-the-date/existing-code'
    )
    expect(screen.getByText('ALREADY LISTED')).toBeInTheDocument()
  })

  it('shows field validation errors inline and keeps the typed values', async () => {
    await openSelfAddForm()

    fireEvent.change(screen.getByPlaceholderText('Self add full name'), {
      target: { value: 'Dana Levi' },
    })
    fireEvent.change(screen.getByPlaceholderText('Self add phone'), {
      target: { value: '123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'SELF ADD SUBMIT' }))

    act(() =>
      capturedOnError?.({
        data: {
          zodError: {
            fieldErrors: {
              phone: ['הזינו מספר טלפון נייד ישראלי תקין'],
            },
          },
        },
      })
    )

    expect(
      await screen.findByText('הזינו מספר טלפון נייד ישראלי תקין')
    ).toBeInTheDocument()
    expect(mockAssign).not.toHaveBeenCalled()
    // A network/validation failure must not lose what the guest already typed.
    expect(screen.getByPlaceholderText('Self add full name')).toHaveValue('Dana Levi')
    expect(screen.getByPlaceholderText('Self add phone')).toHaveValue('123')
  })
})
