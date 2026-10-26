import { fireEvent, render, screen } from '@testing-library/react'

import { InviteLinkPanel } from '~/components/guest-list/invite-link-panel'

jest.mock('~/components/guest-list/self-invite-link-manager', () => ({
  SelfInviteLinkManager: () => <div data-testid='self-invite-link-manager' />,
}))

describe('InviteLinkPanel', () => {
  it('renders "קישור הזמנה" button', () => {
    render(<InviteLinkPanel />)
    expect(screen.getByRole('button', { name: 'קישור הזמנה' })).toBeInTheDocument()
  })

  it('panel is hidden initially', () => {
    render(<InviteLinkPanel />)
    expect(screen.queryByTestId('self-invite-link-manager')).not.toBeInTheDocument()
  })

  it('button has aria-expanded="false" initially', () => {
    render(<InviteLinkPanel />)
    expect(screen.getByRole('button', { name: 'קישור הזמנה' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('clicking shows SelfInviteLinkManager', () => {
    render(<InviteLinkPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'קישור הזמנה' }))
    expect(screen.getByTestId('self-invite-link-manager')).toBeInTheDocument()
  })

  it('button aria-expanded="true" after clicking', () => {
    render(<InviteLinkPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'קישור הזמנה' }))
    expect(screen.getByRole('button', { name: 'קישור הזמנה' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  it('clicking again hides the panel', () => {
    render(<InviteLinkPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'קישור הזמנה' }))
    expect(screen.getByTestId('self-invite-link-manager')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'קישור הזמנה' }))
    expect(screen.queryByTestId('self-invite-link-manager')).not.toBeInTheDocument()
  })
})
