import React, {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'

type MultistepRsvpFormProps = {
  children: React.ReactNode
  currentStep: number
  setCurrentStep: Dispatch<SetStateAction<number>>
  basePath: string
}

export const clampRsvpStep = (step: number, stepCount: number) =>
  Math.min(Math.max(step, 1), Math.max(stepCount, 1))

const stepKey = (step: React.ReactNode) => {
  if (!React.isValidElement(step) || step.key === null) return null

  const key = String(step.key)
  const explicitKeyMarker = key.lastIndexOf('$')
  return explicitKeyMarker >= 0 ? key.slice(explicitKeyMarker + 1) : key
}

export default function MultistepRsvpForm({
  children,
  currentStep,
  setCurrentStep,
  basePath,
}: MultistepRsvpFormProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const steps = React.Children.toArray(children)
  const previousStepsRef = useRef(steps)
  const previousActiveStepRef = useRef(clampRsvpStep(currentStep, steps.length))
  const previousSteps = previousStepsRef.current
  const stepListChanged =
    previousSteps.length !== steps.length ||
    previousSteps.some((step, index) => stepKey(step) !== stepKey(steps[index]))

  let activeStep = clampRsvpStep(currentStep, steps.length)
  if (stepListChanged) {
    const previousIndex = previousActiveStepRef.current - 1
    const activeKey = stepKey(previousSteps[previousIndex])
    let nextIndex = activeKey === null ? -1 : steps.findIndex((step) => stepKey(step) === activeKey)

    for (let index = previousIndex - 1; nextIndex < 0 && index >= 0; index -= 1) {
      const previousKey = stepKey(previousSteps[index])
      if (previousKey !== null) {
        nextIndex = steps.findIndex((step) => stepKey(step) === previousKey)
      }
    }

    activeStep = nextIndex >= 0 ? nextIndex + 1 : activeStep
  }

  const goToStep = (step: SetStateAction<number>) => {
    setCurrentStep((previousStep) => {
      const requestedStep = typeof step === 'function' ? step(previousStep) : step
      return clampRsvpStep(requestedStep, steps.length)
    })
  }
  const goNext = () => goToStep((prev) => prev + 1)
  const goBack = () => {
    if (activeStep === 1) {
      window.location.assign(basePath)
      return
    }
    goToStep(activeStep - 1)
  }

  const currentStepForm = steps[activeStep - 1] // -1 because currentStep is 1 indexed

  useLayoutEffect(() => {
    previousStepsRef.current = steps
    previousActiveStepRef.current = activeStep
    if (currentStep !== activeStep) {
      goToStep(activeStep)
    }
  })

  useEffect(() => {
    if (currentStep !== activeStep) return

    window.scrollTo(0, 0)
    // Steps aren't guaranteed to render an h2, so fall back to the container
    // itself: either way, screen readers get something to announce on focus.
    const heading = containerRef.current?.querySelector('h2')
    const target = heading ?? containerRef.current
    if (target) {
      target.setAttribute('tabindex', '-1')
      ;(target as HTMLElement).focus()
    }
  }, [activeStep, currentStep])

  const content = React.isValidElement<{
    goNext: () => void
    goBack: () => void
  }>(currentStepForm)
    ? React.cloneElement(currentStepForm, { goNext, goBack })
    : currentStepForm

  return (
    <div ref={containerRef}>
      <p className='sr-only' aria-live='polite'>
        {`שלב ${activeStep} מתוך ${steps.length}`}
      </p>
      {content}
    </div>
  )
}
