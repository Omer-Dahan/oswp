import { render, screen } from '@testing-library/react'
import WeddingWebsiteLayout from '~/app/w/[websiteSubUrl]/layout'
import { StepShell } from '~/components/website/forms/steps/step-ui'

const mockProvider = jest.fn()
const mockGetLocale = jest.fn()
const mockGetMessages = jest.fn()
const mockLoadVisitorWedding = jest.fn()

jest.mock('next-intl', () => ({
  NextIntlClientProvider: ({
    children,
    messages,
  }: {
    children: React.ReactNode
    messages: unknown
  }) => {
    mockProvider(messages)
    return <>{children}</>
  },
}))

jest.mock('next-intl/server', () => ({
  getLocale: () => mockGetLocale(),
  getMessages: () => mockGetMessages(),
}))

jest.mock('~/app/w/[websiteSubUrl]/_lib/load-visitor-wedding', () => ({
  loadVisitorWedding: (...args: unknown[]) => mockLoadVisitorWedding(...args),
}))

jest.mock('~/components/locale-toggle', () => ({
  LocaleToggle: () => <button type='button'>Language</button>,
}))

beforeEach(() => {
  mockProvider.mockReset()
  mockGetLocale.mockReset().mockResolvedValue('en')
  mockGetMessages.mockReset().mockResolvedValue({})
  mockLoadVisitorWedding.mockReset()
})

it('shows the guest language switch on wedding websites', async () => {
  render(
    await WeddingWebsiteLayout({
      children: <div>Wedding website</div>,
      params: Promise.resolve({ websiteSubUrl: 'john-and-jane' }),
    })
  )

  expect(screen.getByText('Wedding website')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Language' })).toBeInTheDocument()
})

it('merges wedding RSVP copy into Hebrew guest messages', async () => {
  mockGetLocale.mockResolvedValue('he')
  mockGetMessages.mockResolvedValue({
    rsvp: { whoIsComingTitle: 'מי מגיע?', childrenCountTitle: 'כמה ילדים יגיעו?' },
  })
  mockLoadVisitorWedding.mockResolvedValue({
    loadResult: {
      status: 'ready',
      weddingData: { rsvpCopy: { whoIsComingTitle: 'מי חוגג\nאיתנו?' } },
    },
  })

  render(
    await WeddingWebsiteLayout({
      children: <div>Wedding website</div>,
      params: Promise.resolve({ websiteSubUrl: 'john-and-jane' }),
    })
  )

  expect(mockProvider).toHaveBeenCalledWith({
    rsvp: {
      whoIsComingTitle: 'מי חוגג\nאיתנו?',
      childrenCountTitle: 'כמה ילדים יגיעו?',
    },
  })
  expect(mockLoadVisitorWedding).toHaveBeenCalledWith('john-and-jane')
})

it('keeps the built-in message when the wedding override is empty', async () => {
  mockGetLocale.mockResolvedValue('he')
  mockGetMessages.mockResolvedValue({ rsvp: { whoIsComingTitle: 'מי מגיע?' } })
  mockLoadVisitorWedding.mockResolvedValue({
    loadResult: { status: 'ready', weddingData: { rsvpCopy: {} } },
  })

  render(
    await WeddingWebsiteLayout({
      children: <div>Wedding website</div>,
      params: Promise.resolve({ websiteSubUrl: 'john-and-jane' }),
    })
  )

  expect(mockProvider).toHaveBeenCalledWith({ rsvp: { whoIsComingTitle: 'מי מגיע?' } })
})

it('renders multiline RSVP copy with preserved line breaks', () => {
  render(
    <StepShell>
      <span>שורה ראשונה{`\n`}שורה שנייה</span>
    </StepShell>
  )

  const text = screen.getByText(/שורה ראשונה/)
  expect(text.textContent).toBe('שורה ראשונה\nשורה שנייה')
  expect(text.parentElement).toHaveClass('whitespace-pre-line')
})
