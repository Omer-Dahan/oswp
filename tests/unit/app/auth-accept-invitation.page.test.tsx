import { render, screen } from '@testing-library/react'

import AcceptInvitationPage from '~/app/auth/accept-invitation/page'
import { auth } from '~/lib/auth'

const mockAcceptInvitationCard = jest.fn(() => (
  <div data-testid='accept-invitation-card'>Accept invitation</div>
))

jest.mock('@daveyplate/better-auth-ui', () => ({
  AcceptInvitationCard: (props: Record<string, unknown>) => mockAcceptInvitationCard(props),
}))

jest.mock('next/headers', () => ({
  headers: jest.fn(async () => new Headers()),
}))

jest.mock('~/lib/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}))

const mockGetSession = auth.api.getSession as jest.Mock

describe('AcceptInvitationPage', () => {
  beforeEach(() => {
    mockAcceptInvitationCard.mockClear()
    mockGetSession.mockReset()
  })

  it('renders invite-aware auth handoff when visitor is unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)

    const page = await AcceptInvitationPage({
      searchParams: Promise.resolve({ invitationId: 'inv_123' }),
    })

    render(page)

    expect(screen.queryByTestId('accept-invitation-card')).not.toBeInTheDocument()
    expect(screen.getByText('הוזמנתם להצטרף לסביבת עבודה לחתונה')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'התחברות להמשך' })).toHaveAttribute(
      'href',
      '/auth/sign-in?redirectTo=%2Fauth%2Faccept-invitation%3FinvitationId%3Dinv_123'
    )
    expect(screen.getByRole('link', { name: 'יצירת חשבון להמשך' })).toHaveAttribute(
      'href',
      '/auth/sign-up?redirectTo=%2Fauth%2Faccept-invitation%3FinvitationId%3Dinv_123'
    )
  })

  it('renders authenticated invitation acceptance card when session exists', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user_1' },
      session: { id: 'session_1' },
    })

    const page = await AcceptInvitationPage({
      searchParams: Promise.resolve({ invitationId: 'inv_123' }),
    })

    render(page)

    expect(screen.getByTestId('accept-invitation-card')).toBeInTheDocument()
    expect(mockAcceptInvitationCard).toHaveBeenCalled()
  })

  it('shows explicit invalid-state guidance when invitationId is missing', async () => {
    mockGetSession.mockResolvedValue(null)

    const page = await AcceptInvitationPage({
      searchParams: Promise.resolve({}),
    })

    render(page)

    expect(screen.getByText('קישור ההזמנה אינו תקין')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'עברו להתחברות' })).toHaveAttribute(
      'href',
      '/auth/sign-in'
    )
  })
})
