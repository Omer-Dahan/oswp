import { render, screen, waitFor } from '@testing-library/react'

import { RsvpFormProvider, useRsvpForm } from '~/components/contexts/rsvp-form-context'
import MainRsvpForm from '~/components/website/forms/main'

let weddingDataRenderCount = 0

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

jest.mock('~/components/hooks', () => ({
  useConfirmReloadPage: jest.fn(),
}))

jest.mock('~/components/website/forms/multi-step-form', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('~/components/website/forms/steps/find-your-invitation', () => () => null)
jest.mock('~/components/website/forms/steps/confirm-name', () => () => null)
jest.mock('~/components/website/forms/steps/decline-confirm', () => () => null)
jest.mock('~/components/website/forms/steps/children-count', () => () => null)
jest.mock('~/components/website/forms/steps/dietary-notes', () => () => null)
jest.mock('~/components/website/forms/steps/wishes-message', () => () => null)
jest.mock('~/components/website/forms/steps/question-multiple-choice', () => () => null)
jest.mock('~/components/website/forms/steps/question-short-answer', () => () => null)
jest.mock('~/components/website/forms/steps/send-rsvp', () => () => null)
jest.mock('~/components/website/rsvp-confirmation', () => () => null)

jest.mock('~/components/website/forms/steps/who-is-coming', () => ({
  __esModule: true,
  default: function WeddingDataProbe() {
    weddingDataRenderCount += 1
    const { weddingData } = useRsvpForm()

    return <div>{weddingData.groomFirstName}</div>
  },
}))

jest.mock('~/trpc/react', () => ({
  api: {
    website: {
      submitPublicRsvpForm: {
        useMutation: () => ({ mutate: jest.fn(), isPending: false }),
      },
    },
  },
}))

describe('MainRsvpForm context synchronization', () => {
  beforeEach(() => {
    weddingDataRenderCount = 0
  })

  it('seeds stable wedding data without repeatedly updating the provider', async () => {
    const weddingData = {
      groomFirstName: 'יואב',
      events: [],
      website: { generalQuestions: [] },
    }

    render(
      <RsvpFormProvider>
        <MainRsvpForm weddingData={weddingData as never} basePath='/w/our-wedding' />
      </RsvpFormProvider>
    )

    expect(await screen.findByText('יואב')).toBeInTheDocument()
    await waitFor(() => expect(weddingDataRenderCount).toBeLessThanOrEqual(2))
  })
})
