import { render, screen } from '@testing-library/react'

import AuthenticatedAppShell from '~/components/layout/authenticated-app-shell'

const mockEttaChat = jest.fn(() => <div data-testid='etta-chat' />)

jest.mock('~/components/nav/sidebar-nav', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid='sidebar-state'>{isOpen ? 'open' : 'closed'}</div>
  ),
}))

jest.mock('~/components/etta/EttaChat', () => ({
  EttaChat: (props: Record<string, unknown>) => {
    mockEttaChat(props)
    return <div data-testid='etta-chat' />
  },
}))

describe('AuthenticatedAppShell', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  it('passes Etta availability into the chat panel', () => {
    localStorage.setItem('etta-panel-open', 'true')
    render(
      <AuthenticatedAppShell showEttaPanel weddingId='wedding-1' isEttaConfigured={false}>
        <div>Content</div>
      </AuthenticatedAppShell>
    )

    expect(screen.getAllByTestId('etta-chat')).toHaveLength(2)
    expect(mockEttaChat).toHaveBeenCalledWith(
      expect.objectContaining({
        weddingId: 'wedding-1',
        persona: 'planner',
        isConfigured: false,
      })
    )
  })

  it('keeps the panel closed by default when nothing is stored', () => {
    render(
      <AuthenticatedAppShell showEttaPanel weddingId='wedding-1' isEttaConfigured={false}>
        <div>Content</div>
      </AuthenticatedAppShell>
    )

    expect(screen.queryByTestId('etta-chat')).not.toBeInTheDocument()
  })

  it('opens the panel when etta-panel-open is stored as true', () => {
    localStorage.setItem('etta-panel-open', 'true')
    render(
      <AuthenticatedAppShell showEttaPanel weddingId='wedding-1' isEttaConfigured={false}>
        <div>Content</div>
      </AuthenticatedAppShell>
    )

    expect(screen.getAllByTestId('etta-chat')).toHaveLength(2)
  })

  it('keeps the panel closed when etta-panel-open is stored as false', () => {
    localStorage.setItem('etta-panel-open', 'false')
    render(
      <AuthenticatedAppShell showEttaPanel weddingId='wedding-1' isEttaConfigured={false}>
        <div>Content</div>
      </AuthenticatedAppShell>
    )

    expect(screen.queryByTestId('etta-chat')).not.toBeInTheDocument()
  })
})
