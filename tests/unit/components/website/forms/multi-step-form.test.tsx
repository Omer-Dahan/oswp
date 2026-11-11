import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import MultistepRsvpForm from '~/components/website/forms/multi-step-form'

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

type StepProps = {
  goBack?: () => void
  goNext?: () => void
  label: string
}

function Step({ goBack, goNext, label }: StepProps) {
  return (
    <div>
      <button type='button' onClick={goBack}>
        {label}
      </button>
      <button type='button' onClick={goNext}>
        Next
      </button>
    </div>
  )
}

function TestFlow({
  initialStep,
  steps = ['first', 'second'],
}: {
  initialStep: number
  steps?: string[]
}) {
  const [currentStep, setCurrentStep] = useState(initialStep)

  return (
    <MultistepRsvpForm
      currentStep={currentStep}
      setCurrentStep={setCurrentStep}
      basePath='/w/guests'
    >
      {steps.map((step) => (
        <Step key={step} label={step} />
      ))}
    </MultistepRsvpForm>
  )
}

describe('MultistepRsvpForm back navigation', () => {
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
    mockAssign.mockReset()
    window.scrollTo = jest.fn()
  })

  it('navigates to the invitation page from the first step', () => {
    render(<TestFlow initialStep={1} steps={['חזרה ראשונה', 'חזרה שנייה']} />)

    fireEvent.click(screen.getByRole('button', { name: 'חזרה ראשונה' }))

    expect(mockAssign).toHaveBeenCalledWith('/w/guests')
  })

  it('returns to the previous form step after the first step', () => {
    render(<TestFlow initialStep={2} steps={['חזרה ראשונה', 'חזרה שנייה']} />)

    fireEvent.click(screen.getByRole('button', { name: 'חזרה שנייה' }))

    expect(screen.getByRole('button', { name: 'חזרה ראשונה' })).toBeInTheDocument()
    expect(mockAssign).not.toHaveBeenCalled()
  })

  it('keeps the same step identity when a preselected event changes the list', () => {
    const { rerender } = render(
      <TestFlow initialStep={3} steps={['household', 'questions', 'summary']} />
    )

    rerender(<TestFlow initialStep={3} steps={['household', 'chuppah', 'questions', 'summary']} />)

    expect(screen.getByRole('button', { name: 'summary' })).toBeInTheDocument()
  })

  it('renders the nearest existing step when a chuppah-only selection collapses the list', () => {
    const { rerender } = render(
      <TestFlow initialStep={3} steps={['household', 'children', 'dietary', 'summary']} />
    )

    rerender(<TestFlow initialStep={3} steps={['household', 'summary']} />)

    expect(screen.getByRole('button', { name: 'household' })).toBeInTheDocument()
  })

  it('does not advance beyond the last step', () => {
    render(<TestFlow initialStep={2} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('button', { name: 'second' })).toBeInTheDocument()
    expect(screen.getByText('שלב 2 מתוך 2')).toBeInTheDocument()
  })
})
