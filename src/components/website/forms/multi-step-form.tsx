import React, { type Dispatch, type SetStateAction, useEffect, useRef } from 'react'

type MultistepRsvpFormProps = {
  children: React.ReactNode
  currentStep: number
  setCurrentStep: Dispatch<SetStateAction<number>>
}

export default function MultistepRsvpForm({
  children,
  currentStep,
  setCurrentStep,
}: MultistepRsvpFormProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const goNext = () => {
    setCurrentStep((prev) => prev + 1)
  }
  const goBack = () => {
    setCurrentStep((prev) => prev - 1)
  }

  const steps = React.Children.toArray(children)
  const currentStepForm = steps[currentStep - 1] // -1 because currentStep is 1 indexed

  useEffect(() => {
    window.scrollTo(0, 0)
    // Steps aren't guaranteed to render an h2, so fall back to the container
    // itself: either way, screen readers get something to announce on focus.
    const heading = containerRef.current?.querySelector('h2')
    const target = heading ?? containerRef.current
    if (target) {
      target.setAttribute('tabindex', '-1')
      ;(target as HTMLElement).focus()
    }
  }, [currentStep])

  const content = React.isValidElement<{ goNext: () => void; goBack: () => void }>(
    currentStepForm
  )
    ? React.cloneElement(currentStepForm, { goNext, goBack })
    : currentStepForm

  return (
    <div ref={containerRef}>
      <p className='sr-only' aria-live='polite'>
        {`שלב ${currentStep} מתוך ${steps.length}`}
      </p>
      {content}
    </div>
  )
}
