import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Dispatch, SetStateAction } from 'react'
import { sharedStyles } from '~/app/utils/shared-styles'
import RsvpPageSkeleton from '~/app/w/[websiteSubUrl]/rsvp/loading'
import MainRsvpForm from '~/components/website/forms/main'

const mockMutate = jest.fn()
let capturedOnError: ((error: unknown) => void) | undefined
let capturedOnSuccess: (() => void) | undefined
let capturedSetCurrentStep: Dispatch<SetStateAction<number>> | undefined

jest.mock('~/components/contexts/rsvp-form-context', () => ({
  useRsvpForm: () => ({
    selectedHousehold: { id: 'household-1', guests: [] },
    rsvpResponses: [],
    answersToQuestions: [],
    childrenCount: 2,
    dietaryNotes: 'Previously saved allergy',
    wishesMessage: 'Congratulations',
  }),
  useUpdateRsvpForm: () => jest.fn(),
}))

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

jest.mock('~/components/hooks', () => ({
  useConfirmReloadPage: jest.fn(),
}))

jest.mock('~/components/website/forms/multi-step-form', () => {
  return function MockMultistepRsvpForm({
    children,
    setCurrentStep,
  }: {
    children: React.ReactNode
    setCurrentStep: Dispatch<SetStateAction<number>>
  }) {
    capturedSetCurrentStep = setCurrentStep
    return <>{children}</>
  }
})

jest.mock('~/components/website/forms/steps/find-your-invitation', () => {
  return function MockFindYourInvitationForm() {
    return <div>Find invitation</div>
  }
})

jest.mock('~/components/website/forms/steps/confirm-name', () => {
  return function MockConfirmNameForm() {
    return <div>Confirm name</div>
  }
})

jest.mock('~/components/website/forms/steps/event-rsvp', () => {
  return function MockEventRsvpForm() {
    return <div>Event RSVP</div>
  }
})

jest.mock('~/components/website/forms/steps/question-multiple-choice', () => {
  return function MockQuestionMultipleChoice() {
    return <div>Question multiple choice</div>
  }
})

jest.mock('~/components/website/forms/steps/question-short-answer', () => {
  return function MockQuestionShortAnswer() {
    return <div>Question short answer</div>
  }
})

jest.mock('~/components/website/forms/steps/send-rsvp', () => {
  return function MockSendRsvp() {
    return <div>Send RSVP</div>
  }
})

jest.mock('~/components/website/forms/steps/who-is-coming', () => {
  return function MockWhoIsComingForm() {
    return <div>Who is coming</div>
  }
})

jest.mock('~/components/website/forms/steps/children-count', () => {
  return function MockChildrenCountForm() {
    return <div>Children count</div>
  }
})

jest.mock('~/components/website/forms/steps/dietary-notes', () => {
  return function MockDietaryNotesForm() {
    return <div>Dietary notes</div>
  }
})

jest.mock('~/components/website/forms/steps/wishes-message', () => {
  return function MockWishesMessageForm() {
    return <div>Wishes message</div>
  }
})

jest.mock('~/components/website/rsvp-confirmation', () => {
  return function MockRsvpConfirmation() {
    return <div>RSVP confirmation</div>
  }
})

jest.mock('~/trpc/react', () => ({
  api: {
    website: {
      submitPublicRsvpForm: {
        useMutation: (options: { onError?: (error: unknown) => void; onSuccess?: () => void }) => {
          capturedOnError = options.onError
          capturedOnSuccess = options.onSuccess

          return {
            mutate: mockMutate,
            isPending: false,
          }
        },
      },
    },
  },
}))

describe('Main RSVP layout', () => {
  beforeEach(() => {
    mockMutate.mockReset()
    capturedOnError = undefined
    capturedOnSuccess = undefined
    capturedSetCurrentStep = undefined
  })

  it('uses a mobile-first responsive width contract for the main form', () => {
    const { container } = render(
      <MainRsvpForm
        weddingData={{ events: [], website: { generalQuestions: [] } } as never}
        basePath='/wedding'
      />
    )

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    const classTokens = form?.className.split(' ') ?? []
    expect(classTokens).toContain('w-full')
    expect(classTokens).toContain('max-w-[450px]')
    expect(classTokens).not.toContain('w-[450px]')
  })

  it('reserves top space so content clears the fixed progress bar', () => {
    const { container } = render(
      <MainRsvpForm
        weddingData={{ events: [], website: { generalQuestions: [] } } as never}
        basePath='/wedding'
      />
    )

    // The form's wrapper pads the top to clear the fixed "RSVP" header bar,
    // otherwise the first step's copy renders underneath it.
    const wrapper = container.querySelector('form')?.parentElement
    expect(wrapper?.className.split(' ')).toContain('pt-24')
  })

  it('keeps loaded and loading close controls clear of the language toggle', () => {
    const renderedForm = render(
      <MainRsvpForm
        weddingData={{ events: [], website: { generalQuestions: [] } } as never}
        basePath='/wedding'
      />
    )

    expect(screen.getByRole('button', { name: 'סגרו טופס RSVP' })).toHaveClass('end-20')
    renderedForm.unmount()

    const { container } = render(<RsvpPageSkeleton />)
    expect(container.querySelector('svg')).toHaveClass('end-20')
  })

  it('uses responsive side pane footer widths for mobile screens', () => {
    expect(sharedStyles.sidebarFormWidth).toContain('w-full')
    expect(sharedStyles.sidebarFormWidth).toContain('max-w-')
    expect(sharedStyles.sidebarFormWidth).not.toContain('w-[525px]')
  })

  it.each([
    [[], ['Who is coming', 'Send RSVP']],
    [['children-count'], ['Who is coming', 'Children count', 'Send RSVP']],
    [
      ['wishes-message', 'dietary-notes', 'children-count'],
      ['Who is coming', 'Wishes message', 'Dietary notes', 'Children count', 'Send RSVP'],
    ],
    [
      ['unknown-step', 'wishes-message', 'wishes-message', 'children-count'],
      ['Who is coming', 'Wishes message', 'Children count', 'Send RSVP'],
    ],
  ])('renders configured RSVP steps in order for %j', (rsvpSteps, expectedOrder) => {
    render(
      <MainRsvpForm
        weddingData={{ rsvpSteps, events: [], website: { generalQuestions: [] } } as never}
        basePath='/wedding'
      />
    )

    const renderedPositions = expectedOrder.map((label) => screen.getByText(label))
    for (let index = 1; index < renderedPositions.length; index += 1) {
      expect(
        renderedPositions[index - 1]?.compareDocumentPosition(renderedPositions[index] as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    }
  })

  it('omits disabled step values from the submission payload', () => {
    const { container } = render(
      <MainRsvpForm
        weddingData={
          {
            rsvpSteps: [],
            events: [],
            website: { subUrl: 'our-wedding', generalQuestions: [] },
          } as never
        }
        basePath='/wedding'
      />
    )

    act(() => {
      capturedSetCurrentStep?.(4)
    })
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        childrenCount: undefined,
        dietaryNotes: undefined,
        wishesMessage: undefined,
      })
    )
  })

  it('keeps progress in normal flow when embedded below wedding navigation', () => {
    render(
      <MainRsvpForm
        weddingData={{ events: [], website: { generalQuestions: [] } } as never}
        basePath='/wedding'
        embedded
      />
    )
    const progress = screen.getByText('RSVP', { selector: 'p' }).parentElement
    expect(progress).not.toHaveClass('fixed')
    expect(progress).toHaveClass('relative')
  })

  it('renders inline submit errors without using window alert', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined)

    const { container } = render(
      <MainRsvpForm
        weddingData={{ events: [], website: { generalQuestions: [] } } as never}
        basePath='/wedding'
      />
    )

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form as HTMLFormElement)
    act(() => {
      capturedOnError?.({ message: 'RSVP service unavailable' })
    })

    expect(screen.getByRole('alert')).toHaveTextContent('RSVP service unavailable')
    expect(alertSpy).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })

  it('does not show the unsent RSVP confirmation after submission is complete', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    const { container } = render(
      <MainRsvpForm
        weddingData={
          { events: [], website: { subUrl: 'our-wedding', generalQuestions: [] } } as never
        }
        basePath='#wedding'
      />
    )

    expect(capturedSetCurrentStep).toBeDefined()
    expect(capturedOnSuccess).toBeDefined()

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    act(() => {
      // Step 6 is the send step when there are no dynamic event/question steps.
      capturedSetCurrentStep?.(6)
    })
    fireEvent.submit(form as HTMLFormElement)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        subUrl: 'our-wedding',
        householdId: 'household-1',
        rsvpResponses: [],
        answersToQuestions: [],
      })
    )

    act(() => {
      capturedOnSuccess?.()
    })
    fireEvent.click(screen.getByRole('button', { name: 'סגרו טופס RSVP' }))

    expect(confirmSpy).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('shows the unsent RSVP confirmation while submission is still in progress', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <MainRsvpForm
        weddingData={
          { events: [], website: { subUrl: 'our-wedding', generalQuestions: [] } } as never
        }
        basePath='#wedding'
      />
    )

    expect(capturedSetCurrentStep).toBeDefined()
    act(() => {
      capturedSetCurrentStep?.(2)
    })
    fireEvent.click(screen.getByRole('button', { name: 'סגרו טופס RSVP' }))

    expect(confirmSpy).toHaveBeenCalledWith('האם אתם בטוחים? ה-RSVP שלכם לא נשלח.')

    confirmSpy.mockRestore()
  })
})
