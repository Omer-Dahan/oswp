import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import MultistepRsvpForm from '~/components/website/forms/multi-step-form'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

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
  beforeEach(() => {
    mockPush.mockReset()
    window.scrollTo = jest.fn()
  })

  it('navigates to the invitation page from the first step', () => {
    render(<TestFlow initialStep={1} />)

    fireEvent.click(screen.getByRole('button', { name: 'חזרה ראשונה' }))

    expect(mockPush).toHaveBeenCalledWith('/w/guests')
  })

  it('returns to the previous form step after the first step', () => {
    render(<TestFlow initialStep={2} />)

    fireEvent.click(screen.getByRole('button', { name: 'חזרה שנייה' }))

    expect(screen.getByRole('button', { name: 'חזרה ראשונה' })).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
