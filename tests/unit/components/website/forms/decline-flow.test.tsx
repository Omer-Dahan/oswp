import { act, fireEvent, render, screen } from '@testing-library/react'
import type { StepFormProps } from '~/app/utils/shared-types'
import MainRsvpForm from '~/components/website/forms/main'

const mockMutate = jest.fn()
let capturedOnSuccess: (() => void) | undefined

const translations: Record<string, string> = {
  'common.back': 'חזרה',
  'common.rsvpFormTitle': 'RSVP',
  'rsvp.declineConfirmTitle': 'לצערנו לא תוכלו להגיע?',
  'rsvp.declineConfirmBody': 'נשמח לדעת בוודאות - אשרו שלא תוכלו להגיע לאירוע כדי לשלוח את התשובה.',
  'rsvp.declineConfirmButton': 'כן, לצערי לא נוכל להגיע',
  'rsvp.sendRsvpTitle': 'שלב אחרון! שליחת אישור ההגעה',
  'rsvp.summaryTitle': 'הכול נראה נכון?',
  'rsvp.summaryAttendingOne': 'אורח אחד מגיע',
  'rsvp.sendRsvp': 'שליחת אישור הגעה',
  'rsvp.sendingRsvp': 'שומר...',
  'rsvp.confirmationThanksName': 'תודה {firstName}',
  'rsvp.confirmationThanksFallback': 'תודה!',
  'rsvp.confirmationDeclinedThanks': 'קלטנו את הבחירה, תודה והמשך יום מקסים',
  'rsvp.backToHomepage': 'חזרה לאתר',
  'rsvp.addToAppleCalendar': 'Apple Calendar',
  'rsvp.addGoogleCalendar': 'Google Calendar',
  'rsvp.navigateToVenue': 'Waze',
}

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const template = translations[`${namespace}.${key}`] ?? key
    return Object.entries(values ?? {}).reduce(
      (copy, [name, value]) => copy.replace(`{${name}}`, String(value)),
      template
    )
  },
}))

jest.mock('next/image', () => {
  const MockImage = ({ alt }: { alt: string }) => <img alt={alt} />
  return MockImage
})

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

const household = {
  id: 'household-1',
  primaryContact: { id: 'guest-1', firstName: 'רון', lastName: 'כהן' },
  guests: [
    {
      id: 'guest-1',
      firstName: 'רון',
      lastName: 'כהן',
      invitations: [
        { eventId: 'wedding', rsvp: 'Invited' },
        { eventId: 'chuppah', rsvp: 'Invited' },
      ],
    },
    {
      id: 'guest-2',
      firstName: 'דנה',
      lastName: 'כהן',
      invitations: [
        { eventId: 'wedding', rsvp: 'Invited' },
        { eventId: 'chuppah', rsvp: 'Invited' },
      ],
    },
  ],
}

let mockFormState: Record<string, unknown>
const mockUpdateForm = jest.fn((update: Record<string, unknown>) => {
  Object.assign(mockFormState, update)
})

jest.mock('~/components/contexts/rsvp-form-context', () => ({
  useRsvpForm: () => mockFormState,
  useUpdateRsvpForm: () => mockUpdateForm,
}))

jest.mock('~/components/hooks', () => ({
  useConfirmReloadPage: jest.fn(),
}))

jest.mock('~/lib/analytics/track', () => ({ track: jest.fn() }))

jest.mock('~/trpc/react', () => ({
  api: {
    website: {
      submitPublicRsvpForm: {
        useMutation: (options: { onSuccess?: () => void }) => {
          capturedOnSuccess = options.onSuccess
          return { mutate: mockMutate, isPending: false }
        },
      },
    },
  },
}))

jest.mock('~/components/website/forms/steps/find-your-invitation', () => () => null)
jest.mock('~/components/website/forms/steps/confirm-name', () => () => null)
jest.mock('~/components/website/forms/steps/children-count', () => () => null)
jest.mock('~/components/website/forms/steps/dietary-notes', () => () => null)
jest.mock('~/components/website/forms/steps/wishes-message', () => () => null)
jest.mock('~/components/website/forms/steps/question-multiple-choice', () => () => null)
jest.mock('~/components/website/forms/steps/question-short-answer', () => () => null)

jest.mock('~/components/website/forms/steps/who-is-coming', () => {
  return function MockWhoIsComing({ goNext }: StepFormProps) {
    return (
      <button type='button' onClick={goNext}>
        Who is coming
      </button>
    )
  }
})

const weddingData = {
  groomFirstName: 'דני',
  brideFirstName: 'נועה',
  website: { subUrl: 'our-wedding', generalQuestions: [] },
  events: [
    {
      id: 'wedding',
      weddingId: 'wedding-1',
      name: 'החתונה',
      collectRsvp: true,
      questions: [],
      venueWazeUrl: 'https://waze.com/ul/example',
    },
    { id: 'chuppah', weddingId: 'wedding-1', name: 'החופה', collectRsvp: true, questions: [] },
  ],
}

describe('decline RSVP flow', () => {
  beforeEach(() => {
    window.scrollTo = jest.fn()
    mockMutate.mockReset()
    mockUpdateForm.mockClear()
    capturedOnSuccess = undefined
    mockFormState = {
      weddingData,
      recognized: true,
      declineIntent: true,
      selectedHousehold: household,
      rsvpResponses: [],
      answersToQuestions: [],
      attendingCount: 2,
      childrenCount: 1,
      dietaryNotes: 'No nuts',
      extraGuestNames: ['Guest'],
    }
  })

  it('submits the only question and renders one minimal final screen', () => {
    const { container } = render(
      <MainRsvpForm weddingData={weddingData as never} basePath='/w/our-wedding' />
    )

    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'לצערנו לא תוכלו להגיע?' })).toBeInTheDocument()
    expect(screen.getByText('שלב 1 מתוך 2')).toBeInTheDocument()
    expect(container.querySelector('[style="width: 50%;"]')).toBeInTheDocument()
    expect(screen.queryByText(/Who is coming|הכול נראה נכון|שלב אחרון/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'כן, לצערי לא נוכל להגיע' }))

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'household-1',
        attendingCount: 0,
        rsvpResponses: [
          { eventId: 'wedding', guestId: 'guest-1', rsvp: 'Declined' },
          { eventId: 'chuppah', guestId: 'guest-1', rsvp: 'Declined' },
          { eventId: 'wedding', guestId: 'guest-2', rsvp: 'Declined' },
          { eventId: 'chuppah', guestId: 'guest-2', rsvp: 'Declined' },
        ],
      })
    )

    act(() => capturedOnSuccess?.())

    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(
      screen.getByRole('heading', {
        name: 'קלטנו את הבחירה, תודה והמשך יום מקסים',
      })
    ).toBeInTheDocument()
    expect(screen.queryByText(/שלב אחרון/)).toBeNull()
    expect(screen.queryByRole('link', { name: /Calendar|Waze/ })).toBeNull()
    expect(screen.queryByText(/No nuts|אישרנו הגעה/)).toBeNull()
    expect(screen.getByRole('button', { name: 'חזרה לאתר' })).toBeInTheDocument()
  })

  it('keeps the attending summary and send controls', () => {
    mockFormState.declineIntent = false
    mockFormState.rsvpResponses = [
      { eventId: 'wedding', guestId: 'guest-1', guestName: 'רון כהן', rsvp: 'Attending' },
    ]
    mockFormState.attendingCount = 1

    render(<MainRsvpForm weddingData={weddingData as never} basePath='/w/our-wedding' />)
    fireEvent.click(screen.getByRole('button', { name: 'Who is coming' }))

    expect(screen.getByRole('heading', { name: 'הכול נראה נכון?' })).toBeInTheDocument()
    expect(screen.getByText('אורח אחד מגיע')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'שליחת אישור הגעה' })).toBeInTheDocument()
  })
})
