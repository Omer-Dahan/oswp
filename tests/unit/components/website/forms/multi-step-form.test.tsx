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
  label: string
}

function Step({ goBack, label }: StepProps) {
  return (
    <button type='button' onClick={goBack}>
      {label}
    </button>
  )
}

function TestFlow({ initialStep }: { initialStep: number }) {
  const [currentStep, setCurrentStep] = useState(initialStep)

  return (
    <MultistepRsvpForm
      currentStep={currentStep}
      setCurrentStep={setCurrentStep}
      basePath='/w/guests'
    >
      <Step label='חזרה ראשונה' />
      <Step label='חזרה שנייה' />
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
    render(<TestFlow initialStep={1} />)

    fireEvent.click(screen.getByRole('button', { name: 'חזרה ראשונה' }))

    expect(mockAssign).toHaveBeenCalledWith('/w/guests')
  })

  it('returns to the previous form step after the first step', () => {
    render(<TestFlow initialStep={2} />)

    fireEvent.click(screen.getByRole('button', { name: 'חזרה שנייה' }))

    expect(screen.getByRole('button', { name: 'חזרה ראשונה' })).toBeInTheDocument()
    expect(mockAssign).not.toHaveBeenCalled()
  })
})
